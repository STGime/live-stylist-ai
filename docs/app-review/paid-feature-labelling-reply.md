# App Review Reply — Paid feature labelling (Guideline 2.3.2)

Submission resubmitted after initial rejection on 2026-06-17. This is the **second-round reply** — Apple flagged §2.3.2 again because the first fix didn't go far enough. This round we restructure the description so every feature is unambiguously inside either the Free trial or the Premium subscription, and we remove a feature reference that didn't exist in the shipped app.

The corrected description lives at `app/store-listing/full-description.md` in the repo.

---

## What we changed in this round (vs. the previous submission)

1. **Removed the "Outfit matching with real products" bullet.** That feature is deferred for v1 (the UI block is commented out in `app/src/screens/HomeScreen.tsx`, marker `PRODUCT_SUGGESTIONS_DEFERRED`). Listing a feature that isn't accessible in the shipped app was an inaccurate-metadata issue on its own.
2. **Split "What it does" into two explicit subsections** — "What's included in the FREE trial" and "What's included in PREMIUM (paid subscription)" — so a reviewer reading the description top-to-bottom never sees a feature without knowing which tier it belongs to.
3. **Labelled every Premium feature with `(Premium)`** in the bullet headline itself, not as a parenthetical aside at the bottom.
4. **Restated the free-vs-paid scope** at the end of "How it works" so the reviewer doesn't have to back-reference.
5. **Tightened "Why it works"** to make the Premium-only image-preview generation explicit there too.

There is no remaining text in the App Description, Subtitle, Promotional Text, Keywords, or Release Notes that implies a paid feature is included for free.

---

## Reviewer reply (paste this into the §2.3.2 reply box)

Thanks for the further feedback. We've restructured the entire description so every feature is unambiguously inside either the Free trial or the Premium subscription. Specifically:

1. **Removed a feature reference that wasn't in the shipped app.** The previous description mentioned outfit matching with real products. That feature is deferred and not accessible in this build, so the reference has been removed entirely.
2. **Split features under two explicit subheadings** — "What's included in the FREE trial" and "What's included in PREMIUM (paid subscription)" — so the boundary between free and paid is structural, not implied. Each Premium bullet is also labelled "(Premium)" in its headline.
3. **Made repeat-use explicit.** The Free trial is exactly one lifetime 5-minute session. Live voice and live camera analysis are available in that one free session and then again in every Premium session — both are now explicitly listed under Premium with the "(Premium, after the free trial)" qualifier so the reader cannot conclude they are unlimited at the free tier.
4. **Reinforced the boundary at the end of "How it works"** with: "Your first session is free. Every session after that — and every Premium feature listed above — requires the Premium subscription described in the Pricing section below."
5. **Pricing section** — Premium Monthly €17.99/month explicitly with length, price, and auto-renew disclosure, plus functional links to the Terms of Use (EULA), Privacy Policy and Community Guidelines. Monthly only — no annual tier.

There is no remaining text in any metadata field that implies a paid feature is included for free.

---

## Verbatim quotes from the corrected description

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

**Boundary restatement under "How it works":**

> Your first session is free. Every session after that — and every Premium feature listed above — requires the Premium subscription described in the Pricing section below.

---

## Internal checklist before re-submitting

- [ ] Replace the App Store Connect "Description" field with the full text of the updated `app/store-listing/full-description.md` — do **not** paraphrase or trim. The previous round mixed an ad-hoc edit ("Premium unlocks 1 session per day") into the App Store Connect Description that contradicted the actual monthly cap; use the repo file verbatim instead so app, paywall, and metadata all say "up to 30 sessions per calendar month".
- [ ] Confirm the Subtitle, Promotional Text, and Keywords don't independently imply any Premium feature is free. (Current Subtitle: "Real-time AI style advice" — fine. Keywords are a comma list — fine. Confirm Promotional Text if you use one.)
- [ ] Paste the reviewer reply above into the §2.3.2 reply box.
