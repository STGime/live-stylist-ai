# App Review Reply — EULA + subscription metadata (Guideline 3.1.2(c))

Apple's second-round message reads:

> The submission still did not include all the required information for apps offering auto-renewable subscriptions. The following information needs to be included in the App Store metadata: a functional link to the Terms of Use (EULA). […] Once the app and metadata includes all of the required information, or if they already do, reply to this message with a screen recording to confirm.

The wording is the giveaway. Apple is asking for a **screen recording** confirming the in-app and metadata details are in place. The fix is already shipped (PR #58, issue #56); this round is about demonstrating it.

---

## What's in place (verifiable)

### In the app

`app/src/screens/PaywallScreen.tsx` displays for every subscription package:

- **Title** — "Monthly" or "Annual" (PackageRow `pkgTitle`).
- **Length** — "1 month • auto-renews" or "12 months • auto-renews" (PackageRow `pkgLength`, added in PR #58 specifically to satisfy this guideline).
- **Price** — `product.priceString` from RevenueCat, locale-aware (e.g. €14.99 / $14.99).
- **Functional Privacy Policy link** — tappable, opens https://livestylist.app/privacy.html.
- **Functional Terms of Use (EULA) link** — tappable, opens https://livestylist.app/terms.html.
- **Functional Community Guidelines link** — tappable, opens https://livestylist.app/community-guidelines.html.
- **Auto-renew disclosure**: "Subscriptions auto-renew until cancelled. Manage in your device's subscription settings."

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

## Screen recording to attach to the reply

Record one ~30-second screen capture demonstrating the subscription compliance in the app. The reviewer will mainly want to see the paywall meet the four required items:

1. Open the app, tap **Start Session** until the paywall appears (or navigate to the tier badge → tap Free → paywall).
2. Slowly pan over the package rows so the recording captures:
   - "Monthly" / "Annual" titles
   - "1 month • auto-renews" / "12 months • auto-renews" length labels
   - Price strings (€14.99, €119.99)
3. Scroll to the fineprint at the bottom of the paywall.
4. Tap each link — Terms, Privacy, Community Guidelines — and let the page open in Safari briefly so the recording captures the live URLs.
5. (Optional) Return to App Store Connect in the recording and pan over the App Description showing the Terms / Privacy / Community Guidelines block.

Save as MP4 and attach via the App Store Connect reply UI.

---

## Reviewer reply (paste this alongside the recording)

Thanks for the additional review. All of the required information for auto-renewable subscriptions is in place — in the app and in the App Store metadata. We've attached a screen recording showing:

1. The paywall screen lists, for each package: **title** ("Monthly", "Annual"), **length** ("1 month • auto-renews", "12 months • auto-renews"), and **price** (locale-aware, currently €14.99 / €119.99 in the recording).
2. The paywall fineprint contains **functional tappable links** to the **Privacy Policy** (https://livestylist.app/privacy.html), the **Terms of Use / EULA** (https://livestylist.app/terms.html), and the **Community Guidelines** (https://livestylist.app/community-guidelines.html). The recording shows each link opening in Safari.
3. The auto-renew disclosure ("Subscriptions auto-renew until cancelled. Manage in your device's subscription settings.") is displayed below the package rows on the paywall.
4. In App Store Connect, the App Description contains a functional **Terms of Use (EULA) link** to https://livestylist.app/terms.html alongside the Privacy Policy link, near the Pricing section. The Privacy Policy URL field is also populated with the same URL.

We've also added this information to the App Review Information **Notes field** for future submissions per your guidance.

---

## Internal checklist before re-submitting

- [ ] Verify https://livestylist.app/terms.html is reachable (status 200, no redirect chain).
- [ ] Verify the App Store Connect Privacy Policy URL field still points at https://livestylist.app/privacy.html.
- [ ] Confirm the App Description in App Store Connect contains the three legal URLs (Terms / Privacy / Community Guidelines) at the bottom of the Pricing section — paste from `app/store-listing/full-description.md`.
- [ ] Record the screen capture above on a build where in-app purchase is configured (TestFlight prod or a Sandbox account).
- [ ] Add the same compliance summary (paywall shows title/length/price + Terms + Privacy + EULA in App Description) to the App Review Information → Notes field for future submissions, as Apple's reply requested.
- [ ] Paste the reviewer reply above into the §3.1.2(c) reply box and attach the MP4.
