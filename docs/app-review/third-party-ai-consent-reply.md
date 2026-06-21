# App Review Reply — Third-party AI data sharing (Guidelines 5.1.1(i) & 5.1.2(i))

Submission ID `d009d9c8-a01d-46cb-a289-39b4950c0555` (1.0 build 16, rejected 2026-06-17).

Apple's four requirements:

1. Disclose what data will be sent
2. Specify who the data is sent to
3. Obtain the user's permission before sending data
4. Identify in the privacy policy what data the app collects, how it collects that data, all uses of that data, and confirm any third party the app shares data with provides the same or equal protection

Each requirement is answered below with a reference to the app and to the published Privacy Policy at <https://livestylist.app/privacy.html>.

---

## 1. What data will be sent

Two streams of personal data are sent to third-party AI services, and only during an **active styling session** that the user explicitly starts by tapping **Start Session**:

- **Live cropped camera frames** from the front-facing camera, covering the user's face (eye region, mouth region) and upper-body / outfit region around an on-screen face-guide oval. No raw full-frame photos or videos are captured.
- **Microphone audio** for the live spoken conversation with the AI stylist.
- **Optionally**, a source image when the user explicitly asks the stylist to generate a style-preview image of a suggested look.

No additional personal data is sent to any third-party AI service — no email (we don't collect one), no real name, no contacts, no location, no device identifiers.

(Privacy Policy §2 "Face Data" and §3 "How We Use Your Information".)

---

## 2. Who the data is sent to

Two third-party AI sub-processors:

- **Google (Gemini API)** — performs the real-time spoken voice conversation (Gemini Live) and the multi-agent computer-vision inference over the camera frames (Gemini 2.5 Flash). Receives the camera frames and microphone audio while a session is active.
- **Fal.ai** — performs the style-preview image generation (model: Gemini 2.5 Flash Image, hosted via Fal). Receives only the user-initiated preview source image and a short text prompt; does not receive the live camera stream or microphone audio.

Both sub-processors are listed by name in the Privacy Policy §4 "Data Sharing & Sub-processors" alongside the specific data each receives.

---

## 3. How the user's permission is obtained before any data is sent

LiveStylist presents an **affirmative consent gate before the first session ever starts**. The consent flow lives in the app at:

- Component: `app/src/components/AiConsentSheet.tsx`
- Trigger: gates `handleStartSession` in `app/src/screens/HomeScreen.tsx` (the only entry point to a session)
- Persistence: AsyncStorage key `@livestylist_ai_data_consent_v1` — the version suffix is bumped if the disclosure ever materially changes, re-prompting all users

The consent sheet:

- Names **Google (Gemini API)** and **Fal.ai** explicitly, in user-visible UI text, not buried in fine print.
- Itemises the data sent (live cropped camera frames, microphone audio, optional source image for previews).
- States plainly that frames and audio are processed in memory, are not stored on our servers, are not used for advertising, are not used for identification, and are not used for AI model training.
- Provides a tappable link to the live Privacy Policy at <https://livestylist.app/privacy.html>.
- Requires the user to actively tap **"I agree & continue"** before the session can start.
- Provides a **Cancel** path that closes the sheet without starting a session.

Only after the user affirmatively agrees does the app open the WebSocket to the backend that forwards frames and audio to Gemini.

The consent flow can be reproduced in App Review on a fresh install by tapping **Start Session** for the first time.

---

## 4. Privacy-policy disclosure

The Privacy Policy at <https://livestylist.app/privacy.html> covers each Apple-required item in dedicated sections:

| What Apple requires | Privacy Policy location |
|---|---|
| What data the app collects | §1 "Information We Collect" + §2 "Face Data" |
| How the data is collected | §1 and §2 (each item names the collection mechanism — e.g. "front-facing camera streams cropped frames", "microphone audio is streamed in real time") |
| All uses of the data | §3 "How We Use Your Information" + §2 (face-data-specific uses) |
| Confirmation that third parties provide same or equal protection | §4 "Data Sharing & Sub-processors" — final paragraph explicitly states that all sub-processors are bound to equivalent data-protection standards. Google in particular operates under its Enterprise Privacy Commitment, which provides equivalent protections to our own. Fal.ai serves preview images via a short-lived CDN and does not retain user-initiated source content beyond the serving window. |

---

## Verbatim quotes from the Privacy Policy

**From §2 "Face Data" (about camera-frame disclosure):**

> Because LiveStylist's camera frames include the user's face, we treat face imagery as a distinct, sensitive category and disclose it explicitly here. […] The cropped frames are sent over a TLS-encrypted connection to our backend, which forwards them to **Google (Gemini API)** for in-memory computer-vision inference. […] Face frames are **not** persisted to our database, are **not** sold, and are **not** shared with advertisers. Generated style-preview images (which may include your likeness) are returned via Fal.ai's CDN and served for a short window only.

**From §4 "Data Sharing & Sub-processors" (about Google + Fal.ai by name):**

> We do not sell your personal data. To run the service, the following sub-processors handle data on our behalf:
>
> - **Google (Gemini API):** Real-time voice conversation and computer-vision analysis of camera frames. Data is processed under Google's Enterprise Privacy Commitment.
> - **Fal.ai:** AI image generation for style previews (model: Gemini 2.5 Flash Image, hosted via Fal). Source images and prompts are sent to Fal for inference; generated images are returned via Fal's CDN.
>
> All sub-processors listed above are contractually or commercially bound to data-protection standards equivalent to LiveStylist's own — no third party may use the personal data we forward to them for advertising, profile building, or AI model training, and none retain camera frames or microphone audio.

**From §5 "Data Retention":**

> - **Camera frames:** processed in memory only; not stored.
> - **Audio:** processed in real time by Google Gemini Live; not stored by us.
> - **Generated preview images:** served from Fal.ai's CDN for a short window (typically up to 24 hours) and not retained by us.

---

## Internal checklist before re-submitting

- [ ] Verify <https://livestylist.app/privacy.html> §4 carries the explicit "all sub-processors […] equivalent" sentence (added in this submission round).
- [ ] Verify the in-app `AiConsentSheet` shows on the first **Start Session** of a fresh install — record a short screen capture for the reviewer reply.
- [ ] Confirm the App Store Connect Privacy Policy URL field still points at <https://livestylist.app/privacy.html>.
- [ ] Paste sections 1–4 above into the App Store Connect reviewer reply, verbatim where quoted.
- [ ] Attach the short screen capture of the consent flow (Apple often asks).
