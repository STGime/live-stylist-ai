# LiveStylist AI — Design Specification

> For designers building the React Native Android app.
> Backend is live at `https://livestylist-backend-833955805931.us-central1.run.app`

---

## 1. App Overview

LiveStylist is a real-time AI beauty and style assistant. The user opens the app, points their camera at themselves, and has a live voice conversation with an AI that can see them and give personalized style feedback on their hair, makeup, and clothing.

**Key characteristics:**
- Feels like a FaceTime call with a stylist friend
- Voice-first — the AI talks, the user talks back
- Camera always showing the user's face/upper body
- Sessions are 5 minutes max
- Minimal UI — the conversation IS the experience

---

## 2. Screen Map

```
Onboarding (first launch only)
    ↓
Home
    ↓
Live Session
    ↓
Session Summary
```

There are only 4 screens. Keep it simple.

---

## 3. Screens & Flows

### 3.1 Onboarding Screen (First Launch Only)

**When:** App launches for the first time (no device ID stored locally).

**Purpose:** Collect minimal personalization info and register the device.

**Elements:**
- App logo + tagline ("Your AI Style Assistant")
- **Name input** — text field, required, max 50 chars, letters only
- **Favorite color input** — either a text field or a color picker/palette selector
- **"Get Started" button** — registers the user, transitions to Home

**Flow:**
1. App generates a UUID (device ID) and stores it locally
2. User fills in name and favorite color
3. Taps "Get Started"
4. App calls `POST /register` with device ID, name, favorite color
5. On success → navigate to Home
6. On error → show inline error, let user retry

**Design notes:**
- Single screen, no multi-step wizard
- Warm, inviting tone — this is a beauty app
- Consider a subtle gradient or illustration background
- The color input could be a row of popular color swatches (pink, blue, red, green, purple, black, white, gold) with an "other" option

---

### 3.2 Home Screen

**When:** Every app launch after onboarding.

**Purpose:** Start a session or manage profile.

**Elements:**
- **Greeting** — "Hey {name}!" or time-based ("Good morning, {name}!")
- **Session card** — large, prominent CTA
  - Shows remaining sessions today (e.g., "1 session available" or "0 sessions left")
  - **"Start Session" button** — primary action, full-width
  - If no sessions left: button is disabled, shows "Come back tomorrow" or upgrade prompt
- **Subscription badge** — small indicator: "Free" or "Premium"
- **Upgrade banner** (free users only) — "Get 5 sessions/day — Go Premium"
- **Profile icon** (top-right) — opens profile edit sheet
- **Settings gear** (top-left, optional for MVP)

**States:**
| State | Session card | Button |
|-------|-------------|--------|
| Sessions available | "1 of 1 sessions remaining" | "Start Session" (enabled) |
| No sessions left | "You've used all sessions today" | "Come back tomorrow" (disabled) |
| Premium user | "3 of 5 sessions remaining" | "Start Session" (enabled) |
| Loading | Skeleton/shimmer | Disabled |
| Error | "Couldn't load your profile" | "Retry" |

**Flow:**
1. App loads profile via `GET /profile`
2. Displays greeting + session availability
3. User taps "Start Session"
4. App requests camera + microphone permissions (if not already granted)
5. App calls `POST /start-session`
6. On success → navigate to Live Session with token data
7. On 429 (limit exceeded) → show "no sessions left" state
8. On error → show toast/snackbar with error message

---

### 3.3 Live Session Screen

**When:** After successful `/start-session` response.

**Purpose:** The core experience — live video + voice conversation with the AI.

**This is the most important screen in the app.**

**Layout:**
```
┌─────────────────────────┐
│  ● 4:32  [End Session]  │  ← Top bar (timer + end button)
│                         │
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │   CAMERA FEED   │   │
│   │  (front-facing) │   │
│   │                 │   │
│   │   ╭─────────╮   │   │
│   │   │  FACE   │   │   │  ← Face/upper body guide overlay
│   │   │  GUIDE  │   │   │
│   │   ╰─────────╯   │   │
│   │                 │   │
│   └─────────────────┘   │
│                         │
│   ◉ AI is listening...  │  ← Status indicator
│                         │
│  ┌───┐                  │
│  │🔇│                  │  ← Mute toggle (optional)
│  └───┘                  │
└─────────────────────────┘
```

**Elements:**
- **Camera preview** — full-screen or near-full-screen, front-facing camera
- **Face/upper body guide** — subtle oval or rounded-rectangle overlay showing the ideal framing zone (face + shoulders). Semi-transparent, non-intrusive. Think portrait mode guide.
- **Timer** — countdown from 5:00, prominently displayed top-center
  - Normal: white text
  - Under 1:00: amber/orange text
  - Under 0:30: red text, possibly pulsing
- **End Session button** — top-right, small "X" or "End" pill button
- **AI status indicator** — bottom area, shows current state:
  - "AI is listening..." (when user is speaking)
  - "AI is thinking..." (brief processing)
  - "AI is speaking..." (when AI responds)
  - Could use an animated waveform/orb visualization
- **Mute button** (optional) — toggle microphone on/off
- **Audio visualizer** (optional) — subtle waveform showing AI speech activity

**Flow:**
1. Screen opens → camera preview starts immediately
2. App connects to Gemini Live WebSocket using ephemeral token from `/start-session`
3. App sends system prompt in WebSocket setup message
4. App connects to backend control WebSocket (`/ws/session`)
5. App starts streaming:
   - Audio from microphone → Gemini WebSocket
   - Video frames (720p, 15fps) → Gemini WebSocket
6. Gemini streams audio responses back → play through speaker
7. **User talks naturally** — Gemini responds in real-time
8. **Interruption works** — user can talk over the AI, it stops and listens

**Session lifecycle events (from backend control WebSocket):**
- `session_ending_soon` (at 4:30) → App receives text to inject into Gemini conversation ("The session will end soon. Ask if the user has final questions."). Timer turns amber.
- `session_expired` (at 5:00) → App closes Gemini connection, navigates to Session Summary
- `session_ended` (manual end or server-side) → Navigate to Session Summary

**Edge cases:**
- **Permission denied** (camera/mic) → Show overlay explaining why permissions are needed, with button to open settings
- **Connection lost** → Show "Reconnecting..." overlay for 10 seconds, then end session
- **No network** → End session, show error on summary screen

**Design notes:**
- Camera feed should feel immersive — minimal chrome
- The face guide should be subtle enough to not distract during conversation
- AI status indicator should feel alive — consider a small animated gradient orb or waveform
- Dark/dim mode works well here to keep focus on the camera feed
- Timer should be always visible but not dominant

---

### 3.4 Session Summary Screen

**When:** After a session ends (timer, manual, or error).

**Purpose:** Confirm the session is over, show stats, encourage return.

**Elements:**
- **Session complete message** — "Great session, {name}!"
- **Duration** — "4 minutes 32 seconds"
- **Reason** — "Time's up" / "You ended the session" / "Connection lost"
- **Remaining sessions** — "You have 0 sessions left today" or "2 sessions remaining today"
- **"Back to Home" button** — returns to Home screen
- **Upgrade prompt** (free users) — "Want more sessions? Go Premium"

**Design notes:**
- Celebratory but brief — the user just had their experience
- Could include a subtle confetti animation or checkmark animation
- Keep it short — user should be able to get back to Home in one tap

---

## 4. Profile Edit (Bottom Sheet / Modal)

**Triggered from:** Home screen profile icon.

**Elements:**
- **Name field** — editable, pre-filled
- **Favorite color field** — editable, pre-filled
- **Subscription status** — "Free" / "Premium" (read-only display)
- **"Save" button** — calls `PUT /profile`
- **"Manage Subscription" button** → opens RevenueCat paywall

---

## 5. Subscription / Paywall

**Triggered from:** Home screen upgrade banner, or Session Summary upgrade prompt.

**Elements:**
- RevenueCat native paywall UI
- Show comparison: Free (1 session/day) vs Premium (5 sessions/day)
- Both tiers have 5-minute session limit

**Design notes:**
- Keep it clean and non-aggressive
- Focus on the value: "5x more sessions"

---

## 6. Permissions Flow

The app needs **Camera** and **Microphone** permissions.

**When to request:** Just before the first session starts (not at app launch).

**If denied:**
- Show an explanatory screen: "LiveStylist needs your camera and microphone to give you personalized style advice"
- "Open Settings" button → deep link to app settings
- "Not Now" → return to Home

---

## 7. Visual Design Direction

### Mood
- Modern, warm, approachable
- Think: beauty brand meets tech — clean but not cold
- Confident, not clinical

### Color Palette Suggestions
- **Primary:** Soft coral, warm pink, or rose gold
- **Secondary:** Deep plum or charcoal for contrast
- **Accent:** Gold or champagne for premium elements
- **Background:** Off-white or very light warm gray (light mode), deep charcoal (session screen)

### Typography
- Clean sans-serif (Inter, SF Pro, or similar)
- Large, confident headings
- Friendly copy tone throughout

### Iconography
- Rounded, filled icons (not outlined)
- Minimal icon set needed: profile, settings, close, microphone, mute

---

## 8. Animation & Motion

| Element | Animation |
|---------|-----------|
| Session start | Camera preview fades in, timer counts from 5:00 |
| AI status | Gentle pulsing orb or waveform, changes with state |
| Timer warning | Color transition white → amber → red, subtle pulse at <30s |
| Session end | Smooth transition to summary, optional confetti |
| Screen transitions | Slide or fade, 300ms duration |
| Loading states | Skeleton shimmer, not spinners |

---

## 9. Error States

| Scenario | Display |
|----------|---------|
| No internet | Toast: "No connection. Check your network." |
| Server error | Toast: "Something went wrong. Try again." |
| Session limit reached | Home card updates, button disabled |
| Registration failed | Inline error on onboarding form |
| Camera/mic denied | Full-screen explanation with settings link |
| Session dropped mid-call | Overlay: "Connection lost" → auto-navigate to summary after 5s |

---

## 10. API Reference (for Designer Context)

| Endpoint | What it does |
|----------|-------------|
| `POST /register` | Creates user account (onboarding) |
| `GET /profile` | Gets user info + session count (home screen) |
| `PUT /profile` | Updates name/color (profile edit) |
| `POST /start-session` | Returns AI connection token (session start) |
| `POST /end-session` | Ends session manually |
| `WebSocket /ws/session` | Real-time session events (timer warnings) |

All requests require `X-Device-ID` header (UUID stored on device).

---

## 11. Key Interaction Principles

1. **Voice-first** — The live session has almost no touch interaction. The user just talks.
2. **Camera is the hero** — During a session, the camera feed dominates. Everything else is minimal overlay.
3. **Time is precious** — 5 minutes goes fast. Don't make users wait or navigate during a session.
4. **Warm, not clinical** — This is a beauty/style app. Every piece of copy should feel like advice from a friend.
5. **One primary action per screen** — Onboarding: "Get Started". Home: "Start Session". Session: just talk. Summary: "Back to Home".
