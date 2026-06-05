import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the structured log so we can assert the computed cost breakdown.
// vi.hoisted lets the (hoisted) vi.mock factory reference this mock safely.
const { infoMock } = vi.hoisted(() => ({ infoMock: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
  logger: { info: infoMock, warn: vi.fn(), error: vi.fn() },
}));

import { SessionCostTracker } from '../../src/services/cost-tracker';

function lastCostLog(): any {
  const call = [...infoMock.mock.calls].reverse().find((c) => c[1] === 'Session cost');
  return call?.[0];
}

describe('SessionCostTracker', () => {
  beforeEach(() => infoMock.mockClear());

  it('prices voice (modality-aware), vision and summary and sums them', () => {
    const t = new SessionCostTracker('s1', 'd1');

    // Two Live snapshots — cumulative, so the larger-total one must win and the
    // smaller (earlier) one must be ignored even though it arrives in between.
    t.recordLiveUsage({ totalTokenCount: 50, promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 50 }] });
    t.recordLiveUsage({
      totalTokenCount: 14640,
      cachedContentTokenCount: 0,
      promptTokensDetails: [
        { modality: 'TEXT', tokenCount: 1000 },
        { modality: 'AUDIO', tokenCount: 9600 },
      ],
      responseTokensDetails: [
        { modality: 'AUDIO', tokenCount: 3840 },
        { modality: 'TEXT', tokenCount: 200 },
      ],
    });

    // 3 vision calls (gemini-2.5-flash): 1000 in / 200 out each.
    for (let i = 0; i < 3; i++) {
      t.recordVisionUsage({ promptTokenCount: 1000, candidatesTokenCount: 200 });
    }

    // 1 summary call (gemini-2.0-flash): 2000 in / 500 out.
    t.recordSummaryUsage({ promptTokenCount: 2000, candidatesTokenCount: 500 });

    t.recordPreview();
    t.recordPreview();

    t.logTotals(300);
    const log = lastCostLog();
    expect(log).toBeDefined();

    // Voice: (1000*0.5 + 9600*3 + 200*2 + 3840*12) / 1e6 = 0.07578 -> 0.0758
    expect(log.breakdown.voice.usd).toBe(0.0758);
    expect(log.breakdown.voice.inputAudioTok).toBe(9600);
    expect(log.breakdown.voice.inputTextTok).toBe(1000);
    expect(log.breakdown.voice.outputAudioTok).toBe(3840);
    expect(log.breakdown.voice.outputTextTok).toBe(200);
    expect(log.breakdown.voice.snapshots).toBe(2);
    expect(log.breakdown.voice.modalityDetailsSeen).toBe(true);

    // Vision: input 3000, output 600 -> (3000*0.3 + 600*2.5)/1e6 = 0.0024
    expect(log.breakdown.vision.usd).toBe(0.0024);
    expect(log.breakdown.vision.calls).toBe(3);
    expect(log.breakdown.vision.inputTok).toBe(3000);
    expect(log.breakdown.vision.outputTok).toBe(600);

    // Summary: (2000*0.1 + 500*0.4)/1e6 = 0.0004
    expect(log.breakdown.summary.usd).toBe(0.0004);

    // Total = 0.0758 + 0.0024 + 0.0004 = 0.0786
    expect(log.estCostUsd).toBe(0.0786);
    expect(log.previews).toBe(2);
    expect(log.durationSeconds).toBe(300);
  });

  it('counts thinking tokens as output on generateContent calls', () => {
    const t = new SessionCostTracker('s2', 'd2');
    // 500 candidates + 300 thoughts -> 800 billable output tokens.
    t.recordVisionUsage({ promptTokenCount: 1000, candidatesTokenCount: 500, thoughtsTokenCount: 300 });
    t.logTotals(10);
    const log = lastCostLog();
    expect(log.breakdown.vision.outputTok).toBe(800);
    // (1000*0.3 + 800*2.5)/1e6 = 0.0023
    expect(log.breakdown.vision.usd).toBe(0.0023);
  });

  it('falls back to an audio-priced approximation when modality details are missing', () => {
    const t = new SessionCostTracker('s3', 'd3');
    t.recordLiveUsage({ totalTokenCount: 1200, promptTokenCount: 1000, responseTokenCount: 200 });
    t.logTotals(10);
    const log = lastCostLog();
    expect(log.breakdown.voice.modalityDetailsSeen).toBe(false);
    // prompt -> audio in, response -> audio out: (1000*3 + 200*12)/1e6 = 0.0054
    expect(log.breakdown.voice.usd).toBe(0.0054);
    expect(log.breakdown.voice.inputAudioTok).toBe(1000);
    expect(log.breakdown.voice.outputAudioTok).toBe(200);
  });
});
