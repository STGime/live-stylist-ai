# App Review Reply — Paid feature labelling (Guideline 2.3.2)

**Round 3.** Apple re-rejected build 1.0 (18) on 2026-06-23 with the same §2.3.2 wording: "we continue to notice that the app's metadata refers to paid content or features, but they are not clearly identified as requiring additional purchase." Root cause: even after the round-2 Free/Premium structural split, the hero paragraph, "How it works", and "Why it works" sections still described the paid experience without per-section paid-app labels. This round we add an unmissable up-front paid-subscription disclaimer and label every prose section that describes the experience.

The corrected description lives at `app/store-listing/full-description.md` in the repo.

---

## What we changed in this round (round 3, vs. the round-2 submission Apple just rejected)

1. **Added an unmissable up-front paid-app disclaimer** — the very first paragraph below the title now reads "Paid subscription required for ongoing use" and explicitly lists every feature that requires the Premium subscription (live voice conversation, live camera analysis, style previews, and style memory) with the price (€17.99/month). Reviewers cannot reach any feature description without seeing this paragraph first.
2. **Qualified the hero paragraph** so it no longer reads as a description of unlimited free features — it now ends with "The free trial gives you one 5-minute session to experience this; everything beyond that single trial session requires Premium."
3. **Renamed "How it works" → "How a session works (free trial or Premium)"** and closes with: "There is no way to use the app beyond a single 5-minute session without subscribing."
4. **Retained the Free / Premium structural split** ("Free trial" section vs. "Premium (paid subscription)" section) with every Premium bullet explicitly labelled "(Premium)".
5. **Removed the "Why it works" marketing section** — it was paid-feature marketing prose that was hard to keep §2.3.2-compliant without being repetitive. The disclaimer at the top + the labelled Premium section already make the same point.
6. **Trimmed the description below the 4000-char App Store cap** (now 3457 chars vs. ~5100 last round) and stripped all Markdown formatting (`##`, `**`, `>>> <<<` brackets) that the App Store Connect "Description" field doesn't render — past rounds left visible stray asterisks in the live listing because Markdown got pasted into a plain-text field.
7. **Removed in round 1, kept removed:** the "Outfit matching with real products" reference (feature not in v1, `PRODUCT_SUGGESTIONS_DEFERRED` in HomeScreen).

There is no remaining text in the App Description, Subtitle, Promotional Text, Keywords, or Release Notes that implies a paid feature is included for free. Every section that describes the experience now carries a per-section "Premium subscription required" qualifier or is explicitly inside the FREE-trial subheading.

## IMPORTANT — paste the corrected text VERBATIM into App Store Connect

The previous round's App Store Connect Description had stray asterisks (e.g. "Same live camera analysis" preceded by a `.*`) from a Markdown-paste artifact, plus an ad-hoc edit ("Premium unlocks 1 session per day") that contradicted the actual 30-per-month cap. **Both undermine §2.3.2 compliance independently.** This round, the source file is plain text — no `##`, no `**`, no `*`, no `>` brackets — so the Markdown-paste artefact cannot recur. Paste the text of `app/store-listing/full-description.md` verbatim into the App Store Connect Description field. Do not paraphrase, do not retype. If the locale you're submitting requires the local currency, localise only the €17.99 figure — do not edit anything else.

---

## Reviewer reply (paste this into the §2.3.2 reply box)

Thanks for the further review. We've now added a fully prominent paid-subscription disclaimer at the top of the App Description and qualified every prose section that previously described the experience without an explicit subscription label.

The App Description now opens with this paragraph (immediately below the app name, before any feature description):

> Paid subscription required for ongoing use. New users receive 1 free 5-minute trial session at signup (no credit card needed). After the trial session ends, all features described below — including live voice conversation, live camera analysis, style previews, and style memory — require an active Premium subscription (€17.99/month, auto-renewing). Detailed pricing and free-vs-paid breakdown below.

Every prose section that previously read as "what the app does" now carries an explicit paid-tier qualifier:

1. The hero paragraph now ends with: "The free trial gives you one 5-minute session to experience this; everything beyond that single trial session requires Premium."
2. The "How a session works (free trial or Premium)" section closes with: "There is no way to use the app beyond a single 5-minute session without subscribing."
3. The "Free trial" and "Premium (paid subscription)" sections are explicit subheadings — every Premium bullet is labelled "(Premium)" in its headline.
4. The Pricing section lists Premium Monthly with length, price, auto-renew disclosure, and functional links to the Terms of Use (EULA), Privacy Policy and Community Guidelines.

The Premium subscription is monthly only — €17.99/month, auto-renewing, no annual tier. Length (1 month • auto-renews), price, Terms of Use (EULA) link, and Privacy Policy link are all shown on the in-app paywall.

There is no remaining text in any metadata field that implies a paid feature is included for free.

---

## Verbatim quotes from the corrected description

**Top-of-description paid-app disclaimer (NEW this round, plain text):**

> Paid subscription required for ongoing use. New users receive 1 free 5-minute trial session at signup (no credit card needed). After the trial session ends, all features described below — including live voice conversation, live camera analysis, style previews, and style memory — require an active Premium subscription (€17.99/month, auto-renewing). Detailed pricing and free-vs-paid breakdown below.

**Free trial section:**

> Free trial
>
> One full 5-minute live styling session, no credit card. A single lifetime session per account; after it ends, ongoing use requires Premium.
>
> During that one free session you get live voice conversation with the AI stylist, and live camera analysis — the stylist sees your hair, makeup and outfit in real time.

**Premium section:**

> Premium (paid subscription)
>
> Premium is an auto-renewing monthly subscription, €17.99/month. Every feature listed here requires an active Premium subscription:
>
> - Up to 30 live styling sessions per calendar month (Premium).
> - Live voice conversation in every session (Premium, after the free trial).
> - Live camera analysis in every session (Premium, after the free trial).
> - Style preview image generation (Premium) — preview images of suggested looks alongside the conversation.
> - Persistent style memory across sessions (Premium) — past advice carries forward.
> - Session history and social features (Premium) — follow friends, see their session summaries.

**"How a session works" closing line (NEW this round):**

> Your one free trial session is available at signup. Every session after that requires the Premium subscription below. There is no way to use the app beyond a single 5-minute session without subscribing.

---

## Internal checklist before re-submitting

- [ ] **Replace the App Store Connect "Description" field with the full verbatim text of `app/store-listing/full-description.md`.** The file is now 3457 chars (under the 4000-char App Store cap) and contains zero Markdown — no `##`, no `**`, no `*`, no `>` characters. Pasting it as-is into App Store Connect will render exactly as written.
- [ ] If the locale you're publishing requires the local currency, change **only** the €17.99 figure (appears twice) to the locale equivalent. Leave everything else untouched.
- [ ] Confirm Subtitle, Promotional Text, and Keywords don't independently imply any Premium feature is free. (Current Subtitle: "Real-time AI style advice" — fine. Keywords are a comma list — fine. Confirm Promotional Text if you use one.)
- [ ] Paste the reviewer reply above into the §2.3.2 reply box.
