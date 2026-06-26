# App Review Reply — EULA + subscription metadata (Guideline 3.1.2(c))

**Round 3.** Apple's wording (2026-06-23 re-review of 1.0 (18)) is the same as round 2:

> Once the app and metadata includes all of the required information, or if they already do, reply to this message with a screen recording to confirm. **Include this information in the Notes field of the App Review Information section in App Store Connect for future submissions.**

Translation: the fix is in place; Apple is asking you to (a) attach the screen recording and (b) populate the App Review Information → Notes field so future reviewers don't have to repeat this loop. Both are manual App Store Connect actions, not code.

---

## What's in place (verifiable)

### In the app

`app/src/screens/PaywallScreen.tsx` displays for the Premium Monthly package:

- **Title** — "Monthly" (PackageRow `pkgTitle`).
- **Length** — "1 month • auto-renews" (PackageRow `pkgLength`, added in PR #58 specifically to satisfy this guideline).
- **Price** — `product.priceString` from RevenueCat, locale-aware (€17.99 / $17.99).
- **Functional Privacy Policy link** — tappable, opens https://livestylist.app/privacy.html.
- **Functional Terms of Use (EULA) link** — tappable, opens https://livestylist.app/terms.html.
- **Functional Community Guidelines link** — tappable, opens https://livestylist.app/community-guidelines.html.
- **Auto-renew disclosure**: "Subscriptions auto-renew until cancelled. Manage in your device's subscription settings."

Premium is monthly only — there is no annual tier in this submission. The PaywallScreen `PackageRow` component still has conditional rendering for an `ANNUAL` package type, so if an annual tier is added later it will render correctly with title "Annual", length "12 months • auto-renews", and the existing "Save ~33%" saving label.

### In App Store metadata

`app/store-listing/full-description.md` (the source we paste into App Store Connect) includes, near the Pricing section:

> - Terms of Use (EULA): https://livestylist.app/terms.html
> - Privacy Policy: https://livestylist.app/privacy.html
> - Community Guidelines: https://livestylist.app/community-guidelines.html

Plus the full auto-renew fineprint required by 3.1.2(c):

> Subscriptions auto-renew until cancelled. Manage or cancel anytime from your device's subscription settings. Payment is charged to your Apple ID account at confirmation of purchase. Your account will be charged for renewal within 24 hours prior to the end of the current period, at the price disclosed in the App Store. Free trial sessions are limited to 1 lifetime session per account.

### In App Store Connect

- **Privacy Policy URL field** — points at https://livestylist.app/privacy.html (confirm this is still set).
- **App Description** — should contain the EULA URL above (paste from `full-description.md`).

---

## Screen recording

You already have one: `livestylist_promo/ScreenRecording_06-25-2026_compressed.mp4` (2.2 MB H.264, 720×1565). It shows the paywall displaying €17.99 monthly + the three links (Terms, Privacy, Community Guidelines) opening from the subscription page. Attach this directly to the §3.1.2(c) reply in App Store Connect.

If a fresh take is ever needed, the four required items to capture in any future recording are:

1. **Title** of the auto-renewing subscription — "Monthly" on the PaywallScreen package row.
2. **Length** — "1 month • auto-renews" beneath the title.
3. **Price** — the price string from RevenueCat (locale-aware; €17.99 or local equivalent).
4. **Functional links** — Privacy Policy and Terms of Use (EULA) opening in Safari from the paywall fineprint.

## App Review Information → Notes field (NEW this round)

Apple explicitly asked for this. In App Store Connect → App Review Information → Notes field, paste:

> LiveStylist offers a single auto-renewable subscription: **Premium Monthly, €17.99/month, 1 month length, auto-renewing**. The in-app paywall (PaywallScreen) displays the title ("Monthly"), length ("1 month • auto-renews"), price (locale-aware via RevenueCat), and functional tappable links to the Privacy Policy (https://livestylist.app/privacy.html), Terms of Use / EULA (https://livestylist.app/terms.html), and Community Guidelines (https://livestylist.app/community-guidelines.html). The same Privacy Policy and Terms of Use (EULA) links are also present in the App Description, alongside the Pricing section. The Privacy Policy URL field in App Store Connect points at https://livestylist.app/privacy.html.

This stays in Notes across future submissions so reviewers don't have to re-verify the same compliance items.

---

## Reviewer reply (paste this alongside the recording)

Thanks for the additional review. All of the required information for auto-renewable subscriptions is in place — in the app and in the App Store metadata. We've attached a screen recording showing:

1. The paywall screen lists, for the Premium Monthly package: **title** ("Monthly"), **length** ("1 month • auto-renews"), and **price** (locale-aware, €17.99 in the recording). Premium is monthly only in this submission.
2. The paywall fineprint contains **functional tappable links** to the **Privacy Policy** (https://livestylist.app/privacy.html), the **Terms of Use / EULA** (https://livestylist.app/terms.html), and the **Community Guidelines** (https://livestylist.app/community-guidelines.html). The recording shows each link opening in Safari.
3. The auto-renew disclosure ("Subscriptions auto-renew until cancelled. Manage in your device's subscription settings.") is displayed below the package rows on the paywall.
4. In App Store Connect, the App Description contains a functional **Terms of Use (EULA) link** to https://livestylist.app/terms.html alongside the Privacy Policy link, near the Pricing section. The Privacy Policy URL field is also populated with the same URL.

We've also added this information to the App Review Information **Notes field** for future submissions per your guidance.

---

## Internal checklist before re-submitting

- [ ] Confirm https://livestylist.app/terms.html and https://livestylist.app/privacy.html return 200 (no redirect chain that the reviewer's user-agent might fail).
- [ ] Confirm App Store Connect Privacy Policy URL field still points at https://livestylist.app/privacy.html.
- [ ] Paste `app/store-listing/full-description.md` verbatim into the App Store Connect Description field (this also satisfies §3.1.2(c) since the EULA URL is in the description).
- [ ] **Paste the Notes-field text above into App Review Information → Notes.** This is the explicit Apple-requested action from this round; without it, the next submission will get the same flag.
- [ ] Attach `livestylist_promo/ScreenRecording_06-25-2026_compressed.mp4` to the §3.1.2(c) reply box.
- [ ] Paste the reviewer reply above into the §3.1.2(c) reply box alongside the video.
