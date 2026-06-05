import { logger } from '../utils/logger.js';

/**
 * Per-session token + estimated-cost accounting.
 *
 * This is a *measurement* tool, not a billing source of truth — it exists so
 * we can see real token usage and a rough $/session before deciding which cost
 * optimizations are worth doing (see GitHub issue #48). Always calibrate the
 * `estCostUsd` it logs against the actual Google Cloud billing dashboard before
 * trusting it for decisions.
 *
 * Three usage sources are tracked:
 *  - Gemini Live (voice coordinator, native audio)  — modality-aware (audio vs
 *    text cost very differently).
 *  - Vision agents (`gemini-2.5-flash`, generateContent ×3 per trigger).
 *  - Session summary (`gemini-2.0-flash`, generateContent ×1 at session end).
 *
 * Fal.ai style previews are billed separately (not token-based); we only count
 * how many ran, for context.
 */

// Prices are USD per 1,000,000 tokens. Verified against
// https://ai.google.dev/gemini-api/docs/pricing (June 2026). Keep in sync when
// Google changes pricing or we switch models.
const PRICING = {
  // gemini-2.5-flash-native-audio-* (Live API). Audio and text are billed at
  // very different rates, so we keep them split.
  liveNativeAudio: {
    inputText: 0.5,
    inputAudio: 3.0,
    outputText: 2.0,
    outputAudio: 12.0,
  },
  // gemini-2.5-flash (standard, non-live) — vision agents.
  flash25: { input: 0.3, output: 2.5 },
  // gemini-2.0-flash — session summary.
  flash20: { input: 0.1, output: 0.4 },
} as const;

const PER_MILLION = 1_000_000;

/**
 * Minimal structural shape of the usageMetadata returned by both
 * `generateContent` responses and Live server messages. Field names vary
 * slightly between the two (candidates* vs response*), so everything is
 * optional and read defensively.
 */
export interface UsageLike {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  responseTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
  candidatesTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
  responseTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
}

function modalityTokens(
  details: Array<{ modality?: string; tokenCount?: number }> | undefined,
  modality: 'TEXT' | 'AUDIO',
): number {
  if (!details) return 0;
  return details
    .filter((d) => (d.modality ?? '').toUpperCase() === modality)
    .reduce((sum, d) => sum + (d.tokenCount ?? 0), 0);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export class SessionCostTracker {
  // Gemini Live (cumulative — see recordLiveUsage). Latest snapshot wins.
  private live = {
    inputTextTok: 0,
    inputAudioTok: 0,
    outputTextTok: 0,
    outputAudioTok: 0,
    cachedTok: 0,
    totalTok: 0,
    snapshots: 0,
    modalityDetailsSeen: false,
  };

  // generateContent buckets, keyed 'vision' | 'summary'.
  private buckets: Record<string, { calls: number; inputTok: number; outputTok: number }> = {
    vision: { calls: 0, inputTok: 0, outputTok: 0 },
    summary: { calls: 0, inputTok: 0, outputTok: 0 },
  };

  private previews = 0;

  constructor(
    private readonly sessionId: string,
    private readonly deviceId: string,
  ) {}

  /**
   * Record a Live API usageMetadata snapshot.
   *
   * The Live API reports usageMetadata cumulatively over the session (each
   * snapshot is the running total to-date), so we keep the snapshot with the
   * largest totalTokenCount rather than summing — summing would multiply the
   * count by the number of snapshots. NOTE: validate this assumption against
   * the billing dashboard on first real traffic; if $/session reads ~Nx low,
   * the API is reporting per-turn deltas and this should switch to summing.
   */
  recordLiveUsage(u: UsageLike | undefined): void {
    if (!u) return;
    this.live.snapshots += 1;
    const total = u.totalTokenCount ?? 0;
    // Only adopt a snapshot that advances the cumulative total.
    if (total < this.live.totalTok) return;

    const promptDetails = u.promptTokensDetails;
    const respDetails = u.responseTokensDetails ?? u.candidatesTokensDetails;
    const hasDetails = !!(promptDetails?.length || respDetails?.length);

    if (hasDetails) {
      this.live.modalityDetailsSeen = true;
      this.live.inputTextTok = modalityTokens(promptDetails, 'TEXT');
      this.live.inputAudioTok = modalityTokens(promptDetails, 'AUDIO');
      this.live.outputTextTok = modalityTokens(respDetails, 'TEXT');
      this.live.outputAudioTok = modalityTokens(respDetails, 'AUDIO');
    } else {
      // No modality breakdown — approximate conservatively (over-estimate):
      // bill all prompt tokens as audio ($3 > $0.5) and all response tokens as
      // audio ($12 > $2), since this model's output is audio. Flagged in the
      // log via modalityDetailsSeen=false so we know the number is coarse.
      const prompt = u.promptTokenCount ?? 0;
      const resp = u.responseTokenCount ?? u.candidatesTokenCount ?? 0;
      this.live.inputTextTok = 0;
      this.live.inputAudioTok = prompt;
      this.live.outputTextTok = 0;
      this.live.outputAudioTok = resp;
    }
    this.live.cachedTok = u.cachedContentTokenCount ?? 0;
    this.live.totalTok = total;
  }

  private recordGenerateContent(bucket: 'vision' | 'summary', u: UsageLike | undefined): void {
    const b = this.buckets[bucket];
    b.calls += 1;
    if (!u) return;
    b.inputTok += u.promptTokenCount ?? 0;
    // Output is billed = candidates + thoughts (thinking tokens bill at the
    // output rate on 2.5 models).
    b.outputTok += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  }

  recordVisionUsage(u: UsageLike | undefined): void {
    this.recordGenerateContent('vision', u);
  }

  recordSummaryUsage(u: UsageLike | undefined): void {
    this.recordGenerateContent('summary', u);
  }

  recordPreview(): void {
    this.previews += 1;
  }

  private liveCost(): number {
    const p = PRICING.liveNativeAudio;
    return (
      (this.live.inputTextTok * p.inputText +
        this.live.inputAudioTok * p.inputAudio +
        this.live.outputTextTok * p.outputText +
        this.live.outputAudioTok * p.outputAudio) /
      PER_MILLION
    );
  }

  private bucketCost(bucket: 'vision' | 'summary'): number {
    const b = this.buckets[bucket];
    const p = bucket === 'vision' ? PRICING.flash25 : PRICING.flash20;
    return (b.inputTok * p.input + b.outputTok * p.output) / PER_MILLION;
  }

  /**
   * Emit one structured `Session cost` log line with the full breakdown.
   * Call once, after the session summary has finished (so its tokens count).
   */
  logTotals(durationSeconds: number): void {
    const voiceUsd = this.liveCost();
    const visionUsd = this.bucketCost('vision');
    const summaryUsd = this.bucketCost('summary');
    const estCostUsd = round4(voiceUsd + visionUsd + summaryUsd);

    logger.info(
      {
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        durationSeconds,
        estCostUsd,
        breakdown: {
          voice: {
            usd: round4(voiceUsd),
            inputAudioTok: this.live.inputAudioTok,
            inputTextTok: this.live.inputTextTok,
            outputAudioTok: this.live.outputAudioTok,
            outputTextTok: this.live.outputTextTok,
            cachedTok: this.live.cachedTok,
            totalTok: this.live.totalTok,
            snapshots: this.live.snapshots,
            modalityDetailsSeen: this.live.modalityDetailsSeen,
          },
          vision: {
            usd: round4(visionUsd),
            calls: this.buckets.vision.calls,
            inputTok: this.buckets.vision.inputTok,
            outputTok: this.buckets.vision.outputTok,
          },
          summary: {
            usd: round4(summaryUsd),
            calls: this.buckets.summary.calls,
            inputTok: this.buckets.summary.inputTok,
            outputTok: this.buckets.summary.outputTok,
          },
        },
        // Fal.ai previews are billed separately (not token-based); count only.
        previews: this.previews,
      },
      'Session cost',
    );
  }
}
