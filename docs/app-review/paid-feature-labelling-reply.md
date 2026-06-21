# App Review Reply — Paid feature labelling (Guideline 2.3.2)

Submission ID `d009d9c8-a01d-46cb-a289-39b4950c0555` (1.0 build 16, rejected 2026-06-17).

The §2.3.2 fix is a metadata edit, not a code change — Apple's complaint was that the App Description in the previous submission referenced paid features without flagging them as Premium-only. The corrected description lives in the repo at `app/store-listing/full-description.md` and is the source we paste into the App Store Connect "Description" field for the next submission.

Use the text below as a short reviewer reply alongside (or instead of) re-pasting the description into App Store Connect.

---

## Reviewer reply (paste this into the §2.3.2 reply box)

Thanks for the feedback. We updated the app description to clearly identify which features require a Premium subscription. Specifically:

1. **Up-front disclosure**, immediately under the tagline:
   > Free to try (1 full session). Ongoing styling, image previews, and persistent style memory require a Premium subscription — see Pricing below.
2. **Inline "(Premium)" labels** on every paid feature bullet in the "What it does" section. Previously, "Generates style previews on the fly" and "Remembers your sessions" were presented without any qualifier; they now read "Generates style previews on the fly (Premium)" and "Remembers your sessions (Premium)" respectively.
3. **Restated free vs. paid scope** at the end of the "How it works" section: "Your first session is free. After that, ongoing styling sessions (up to 30 per calendar month), image-preview generation, and persistent style memory across sessions require a Premium subscription."
4. **Pricing section** lists each paid tier explicitly with length, price, and auto-renew disclosure (Premium Monthly €14.99/month, Premium Annual €119.99/year), plus standard Apple auto-renew fineprint.
5. **Functional links** to the Terms of Use (EULA), Privacy Policy, and Community Guidelines are included at the end of the Pricing section.

The corrected description is what we have submitted in this build. There is no metadata text remaining that implies a paid feature is included for free.

---

## Where the corrected text lives

- Source of truth: `app/store-listing/full-description.md` in the repo.
- The same wording should appear in the App Store Connect "Description" field for the resubmitted build.
- Shorter surfaces aligned at the same time: `short-description.txt`, `release-notes.md` (the latter already said "Free trial (1 session), then €14.99/mo" pre-fix, so no change needed there).

---

## Verbatim quotes from the corrected description

**Up-front disclosure (immediately after the tagline):**

> Free to try (1 full session). Ongoing styling, image previews, and persistent style memory require a Premium subscription — see Pricing below.

**"What it does" bullets that are now Premium-labelled:**

> - **Generates style previews on the fly (Premium).** Want to see yourself with a fringe? Navy frames? A bold lip? She'll show you a quick preview image right there.
> - **Remembers your sessions (Premium).** Past advice carries forward. "Last time I noticed your eyes pop in green — let's lean into that today."

**Free-vs-paid restatement under "How it works":**

> Your first session is free. After that, ongoing styling sessions (up to 30 per calendar month), image-preview generation, and persistent style memory across sessions require a Premium subscription.

**Pricing section:**

> - **Free trial** — 1 full session at signup, no credit card needed.
> - **Premium Monthly** — €14.99 per month (1 month, auto-renewing). Up to 30 styling sessions per calendar month, full preview generation, persistent style memory.
> - **Premium Annual** — €119.99 per year (12 months, auto-renewing). Same Premium features, billed annually.

---

## Internal checklist before submitting

- [ ] Paste the corrected `app/store-listing/full-description.md` text into the App Store Connect "Description" field for the new build.
- [ ] Confirm the App Store Connect "Promotional Text" / "What's New" / Subtitle don't independently imply any Premium feature is free.
- [ ] Paste the reviewer reply above into the §2.3.2 reply box.
- [ ] (Optional) confirm the marketing site (https://livestylist.app/#pricing) is consistent with the App Description, so the App Review reviewer cross-checking sees the same vocabulary.
