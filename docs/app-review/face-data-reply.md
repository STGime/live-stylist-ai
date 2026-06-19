# App Review Reply — Face Data (Guideline 2.1)

Submission ID `d009d9c8-a01d-46cb-a289-39b4950c0555` (1.0 build 16, rejected 2026-06-17).

Paste these answers into the App Store Connect "App Review" reply box. Each answer references the published Privacy Policy at <https://livestylist.app/privacy.html> §2 "Face Data".

---

**1. What face data does your app collect?**

LiveStylist captures short-lived **cropped frames** from the user's front-facing camera during an active styling session. The crops cover three regions around a face-guide oval shown on screen: the **eye region**, the **mouth region**, and the **upper-body / outfit region**. No raw full-frame photo or video is recorded or saved. Frames are streamed only while the session is active and discarded immediately after.

(Privacy Policy §2, bullet "What face data is collected".)

---

**2. Provide a complete and clear explanation of all planned uses of the collected face data.**

Face data is used **only** for real-time AI styling and beauty commentary — i.e. the on-screen stylist character can comment on the user's hair, makeup, eye and lip colour choices, accessories, and upper-body outfit, in real time during the session.

Face data is **not** used for:

- identification of any person,
- biometric matching or face recognition,
- attractiveness scoring,
- advertising or profile building,
- training any AI/ML model,
- any purpose outside the active live session.

(Privacy Policy §2, bullet "All planned uses of face data".)

---

**3. Will face data be shared with any third parties? Where will this information be stored?**

Yes, the cropped face frames are sent over TLS to one third-party AI sub-processor:

- **Google (Gemini API)** — performs the real-time computer-vision inference that powers the stylist's comments. Google processes the frames under its Enterprise Privacy Commitment. Frames are processed in memory and are not retained by Google for training.

The frames are **not** stored in our own database. The backend that forwards them to Google is stateless with respect to face data.

Generated style-preview images (which may include the user's likeness) are returned via Fal.ai's CDN and served from there for a short window only; these are user-initiated previews and are not retained by LiveStylist on its servers.

Face data is **never** sold and is **never** shared with advertisers, data brokers, or analytics providers. LiveStylist uses no third-party analytics or ad SDKs.

(Privacy Policy §2, bullet "Who face data is shared with, and where it is stored"; also §4 "Data Sharing & Sub-processors".)

---

**4. How long will face data be retained?**

Face data is **not retained**. Cropped camera frames are processed in memory only and are **never written to disk** on our servers. When the session ends (or is cancelled, or the user backgrounds the app), the frames are gone. The only post-session artifact is a short text summary of the styling advice given ("session memory"), which does not contain face data or any biometric information.

LiveStylist does **not** create, derive, or store a biometric template, face embedding, or any identifier that could be used to recognise the user across sessions or apps.

(Privacy Policy §2, bullets "Retention of face data" and "No biometric identifier".)

---

**5. Where in the privacy policy do you explain the collection, use, disclosure, sharing, and retention of face data?**

Section 2 of the Privacy Policy is titled **"Face Data"** and is dedicated to this disclosure. It is published at:

<https://livestylist.app/privacy.html>

The Face Data section is also referenced from §4 "Data Sharing & Sub-processors" (which names Google Gemini as the sub-processor that receives the frames) and §5 "Data Retention" (which restates that camera frames are processed in memory only and not stored).

---

**6. Quote the specific text in your privacy policy concerning the collection and use of face data.**

Verbatim, from Privacy Policy §2 "Face Data" at <https://livestylist.app/privacy.html>:

> Because LiveStylist's camera frames include the user's face, we treat face imagery as a distinct, sensitive category and disclose it explicitly here.
>
> - **What face data is collected:** During an active styling session, the app captures short-lived cropped frames from your front-facing camera covering your face — specifically the eye region, the mouth region, and the upper-body / outfit region around a face-guide oval shown on screen. No raw full-frame photos or videos are saved.
> - **All planned uses of face data:** real-time style and beauty analysis only — i.e. commentary on hair, makeup, eye/lip color choices, accessories, and upper-body outfit. Face data is **not** used for identification, biometric matching, attractiveness scoring, advertising, profile building, or training any AI model.
> - **Who face data is shared with, and where it is stored:** the cropped frames are sent over a TLS-encrypted connection to our backend, which forwards them to **Google (Gemini API)** for in-memory computer-vision inference. Google processes them under its Enterprise Privacy Commitment. Face frames are **not** persisted to our database, are **not** sold, and are **not** shared with advertisers. Generated style-preview images (which may include your likeness) are returned via Fal.ai's CDN and served for a short window only.
> - **Retention of face data:** camera frames containing your face are processed in memory and are **never written to disk** on our servers. Nothing facial is retained after the session ends. The only post-session artifact is a short text summary of the styling advice ("session memory"), which does not contain face data.
> - **No biometric identifier:** LiveStylist does **not** create, derive, or store a biometric template, face embedding, or any identifier that could be used to recognise you across sessions or apps. Apple's on-device Face ID is not used by LiveStylist.

---

## Internal checklist before submitting

- [ ] Verify <https://livestylist.app/privacy.html> is live and §2 "Face Data" is reachable.
- [ ] Confirm the App Store Connect "Privacy Policy URL" field points at that URL and is functional.
- [ ] Paste the six answers above into the App Review reply, verbatim where quoted.
- [ ] Re-submit the build (1.0 build 17 or later) once the §5.1.1(i) consent gate, the §3.1.2(c) EULA link, and the §2.3.2 description fixes are also in.
