# App Review Reply — Paid feature labelling (Guideline 2.3.2)

**Round 3.** Apple re-rejected build 1.0 (18) on 2026-06-23 with the same §2.3.2 wording: "we continue to notice that the app's metadata refers to paid content or features, but they are not clearly identified as requiring additional purchase." Root cause: even after the round-2 Free/Premium structural split, the hero paragraph, "How it works", and "Why it works" sections still described the paid experience without per-section paid-app labels. This round we add an unmissable up-front paid-subscription disclaimer and label every prose section that describes the experience.

The corrected description lives at `app/store-listing/full-description.md` in the repo.

---

## What we changed in this round (round 3, vs. the round-2 submission Apple just rejected)

1. **Added an unmissable up-front paid-app disclaimer** — the very first block under the title is now a bracketed all-caps disclaimer reading "PAID SUBSCRIPTION REQUIRED FOR ONGOING USE" with the price (€17.99/month) and the explicit statement that ALL features described below require the subscription after the single free trial session. Reviewers cannot reach the body copy without seeing this.
2. **Qualified the hero paragraph** so it no longer reads as a description of unlimited free features — it now ends with "The free trial gives you one 5-minute session to experience this; everything beyond that single trial session requires the Premium subscription described under 'Pricing' below."
3. **Renamed "How it works" → "How it works (each session, free trial or Premium)"** and re-tightened the closing line to: "There is no way to use the app beyond a single 5-minute session without subscribing."
4. **Renamed "Why it works" → "Why it works (Premium subscription required to access beyond the free trial)"** and the closing line now says "try your free trial session, then continue with Premium (€17.99/month)".
5. **Retained the round-2 structural split** ("What's included in the FREE trial" / "What's included in PREMIUM (paid subscription)") plus the round-2 Pricing section with the EULA / Privacy / Community Guidelines URLs.
6. **Removed in round 1, kept removed:** the "Outfit matching with real products" reference (feature not in v1, `PRODUCT_SUGGESTIONS_DEFERRED` in HomeScreen).

There is no remaining text in the App Description, Subtitle, Promotional Text, Keywords, or Release Notes that implies a paid feature is included for free. Every section that describes the experience now carries a per-section "Premium subscription required" qualifier or is explicitly inside the FREE-trial subheading.

## IMPORTANT — paste the corrected text VERBATIM into App Store Connect

The previous round's App Store Connect Description had stray asterisks (e.g. "Same live camera analysis" preceded by a `.*`) from a Markdown-paste artifact, plus an ad-hoc edit ("Premium unlocks 1 session per day") that contradicted the actual 30-per-month cap. **Both undermine §2.3.2 compliance independently.** This round: paste the text of `app/store-listing/full-description.md` verbatim into the App Store Connect Description field. Do not paraphrase, do not retype, do not strip the `>>> <<<` bracketed disclaimer. If the locale you're submitting requires the local currency, localise only the €17.99 figure — do not edit anything else.

---

## Reviewer reply (paste this into the §2.3.2 reply box)

Thanks for the further review. We've now added a fully prominent paid-subscription disclaimer at the top of the App Description and qualified every prose section that previously described the experience without an explicit subscription label.

Specifically, the App Description now opens with an unmissable bracketed disclaimer:

> >>> PAID SUBSCRIPTION REQUIRED FOR ONGOING USE. New users receive 1 free 5-minute trial session at signup (no credit card needed). After the trial session ends, ALL features described below — including live voice conversation, live camera analysis, style previews, and style memory — require an active Premium subscription (€17.99/month, auto-renewing). Detailed pricing and free-vs-paid breakdown below. <<<

Every prose section that previously read as "what the app does" now carries an explicit paid-tier qualifier:

1. The hero paragraph now ends with "The free trial gives you one 5-minute session to experience this; everything beyond that single trial session requires the Premium subscription described under 'Pricing' below."
2. "How it works" has been renamed to "How it works (each session, free trial or Premium)" and closes with: "There is no way to use the app beyond a single 5-minute session without subscribing."
3. "Why it works" has been renamed to "Why it works (Premium subscription required to access beyond the free trial)" and closes with: "try your free trial session, then continue with Premium (€17.99/month)".
4. The structural split ("What's included in the FREE trial" / "What's included in PREMIUM (paid subscription)") and the Pricing section with EULA / Privacy / Community Guidelines URLs are retained from the previous round.

The Premium subscription is monthly only — €17.99/month, auto-renewing, no annual tier. Length (1 month • auto-renews), price, Terms of Use (EULA) link, and Privacy Policy link are all shown on the in-app paywall.

There is no remaining text in any metadata field that implies a paid feature is included for free.

---

## Verbatim quotes from the corrected description

**Top-of-description paid-app disclaimer (NEW this round):**

> >>> PAID SUBSCRIPTION REQUIRED FOR ONGOING USE. New users receive 1 free 5-minute trial session at signup (no credit card needed). After the trial session ends, ALL features described below — including live voice conversation, live camera analysis, style previews, and style memory — require an active Premium subscription (€17.99/month, auto-renewing). Detailed pricing and free-vs-paid breakdown below. <<<

**Free-trial section:**

> ## What's included in the FREE trial
>
> - **One full 5-minute live styling session**, no credit card. That's it. The free trial is a single lifetime session per account; after it ends, ongoing use requires Premium (see Pricing).
>
> During that one free session you get:
>
> - Live voice conversation with the AI stylist (real-time spoken back-and-forth).
> - Live camera analysis — the stylist sees your hair, makeup and outfit in real time.

**Premium section:**

> ## What's included in PREMIUM (paid subscription)
>
> Premium is an auto-renewing monthly subscription (€17.99/month — see Pricing below). Every Premium feature listed here requires an active subscription:
>
> - **Up to 30 live styling sessions per calendar month (Premium).**
> - **Live voice conversation in every session (Premium, after the free trial).**
> - **Live camera analysis in every session (Premium, after the free trial).**
> - **Style preview image generation (Premium).**
> - **Persistent style memory across sessions (Premium).**
> - **Session history and social features (Premium).**

**"How it works" closing line (NEW this round):**

> There is no way to use the app beyond a single 5-minute session without subscribing.

**"Why it works" closing line (NEW this round):**

> Ready when you are — try your free trial session, then continue with Premium (€17.99/month).

---

## Internal checklist before re-submitting

- [ ] **Replace the App Store Connect "Description" field with the full verbatim text of `app/store-listing/full-description.md`** — including the `>>> <<<` bracketed disclaimer at the very top. Do not paraphrase. Do not retype. Do not skip the disclaimer. Past rejections introduced stray asterisks and an ad-hoc "1 session per day" line via in-place editing; this round we eliminate that risk by pasting verbatim.
- [ ] If the locale you're publishing requires the local currency, **only** change the €17.99 figure to the locale equivalent. Leave the structure, headings, and bracketed disclaimer alone.
- [ ] Confirm Subtitle, Promotional Text, and Keywords don't independently imply any Premium feature is free. (Current Subtitle: "Real-time AI style advice" — fine. Keywords are a comma list — fine. Confirm Promotional Text if you use one.)
- [ ] Paste the reviewer reply above into the §2.3.2 reply box.
