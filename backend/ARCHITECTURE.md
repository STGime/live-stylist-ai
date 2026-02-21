```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Native App                             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐                        │
│  │ Camera   │  │ Mic      │  │ Speaker   │                        │
│  │ (2s fps) │  │ (16kHz)  │  │ (24kHz)   │                        │
│  └────┬─────┘  └────┬─────┘  └─────▲─────┘                        │
│       │              │              │                               │
│  frame-cropper       │              │                               │
│  (3 crops)           │              │                               │
│       │              │              │                               │
│       ▼              ▼              │                               │
│  ┌──────────────────────────────────┴──────┐                       │
│  │       Single WebSocket to Backend        │                       │
│  │  sends: frame, audio, mute, ping        │                       │
│  │  recv:  audio, state, transcript, etc    │                       │
│  └────────────────────┬────────────────────┘                       │
└───────────────────────┼─────────────────────────────────────────────┘
                        │
                        │ wss://backend/ws/adk
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                   Backend (adk-session.ws.ts)                        │
│                                                                     │
│  incoming message                                                   │
│       │                                                             │
│       ├── type: "audio"                                             │
│       │       │                                                     │
│       │       ▼                                                     │
│       │   liveRequestQueue.sendRealtime(pcm)                        │
│       │       │                                                     │
│       │       │         ┌──────────────────────────────────┐        │
│       │       └────────►│     ADK Coordinator Agent        │        │
│       │                 │  (gemini-2.5-flash-native-audio) │        │
│       │                 │                                  │        │
│       │                 │  BIDI streaming via ADK           │        │
│       │                 │  - receives audio from queue      │        │
│       │                 │  - generates voice responses      │◄──┐   │
│       │                 │  - reads vision results from      │   │   │
│       │                 │    injected text context           │   │   │
│       │                 └──────────┬───────────────────────┘   │   │
│       │                            │                            │   │
│       │                   yields ADK Events                     │   │
│       │                   (audio chunks, text,                  │   │
│       │                    turnComplete, etc.)                   │   │
│       │                            │                            │   │
│       │                            ▼                            │   │
│       │                   processAdkEvent()                     │   │
│       │                   → sends to client                     │   │
│       │                                                         │   │
│       │                                                         │   │
│       ├── type: "frame"                                         │   │
│       │       │                                                 │   │
│       │       ▼                                                 │   │
│       │   runVisionPipeline(eye, mouth, body)                   │   │
│       │       │                                                 │   │
│       │       │  ┌──────────────────────────────────────────┐   │   │
│       │       │  │         Promise.all (parallel)            │   │   │
│       │       │  │                                           │   │   │
│       │       │  │  ┌─────────────┐  Direct @google/genai    │   │   │
│       │       │  │  │  Eye Agent  │  generateContent()       │   │   │
│       │       │  │  │  prompt +   │──────────►  Gemini API   │   │   │
│       │       │  │  │  eye_crop   │◄──────────  JSON result  │   │   │
│       │       │  │  └─────────────┘                          │   │   │
│       │       │  │                                           │   │   │
│       │       │  │  ┌─────────────┐  Direct @google/genai    │   │   │
│       │       │  │  │ Mouth Agent │  generateContent()       │   │   │
│       │       │  │  │  prompt +   │──────────►  Gemini API   │   │   │
│       │       │  │  │  mouth_crop │◄──────────  JSON result  │   │   │
│       │       │  │  └─────────────┘                          │   │   │
│       │       │  │                                           │   │   │
│       │       │  │  ┌─────────────┐  Direct @google/genai    │   │   │
│       │       │  │  │ Body Agent  │  generateContent()       │   │   │
│       │       │  │  │  prompt +   │──────────►  Gemini API   │   │   │
│       │       │  │  │  body_crop  │◄──────────  JSON result  │   │   │
│       │       │  │  └─────────────┘                          │   │   │
│       │       │  │                                           │   │   │
│       │       │  └───────────────┬──────────────────────────┘   │   │
│       │       │                  │                               │   │
│       │       │          3 JSON results                          │   │
│       │       │                  │                               │   │
│       │       │                  ▼                               │   │
│       │       │   liveRequestQueue.sendContent({                │   │
│       │       │     role: "user",                               │   │
│       │       │     text: "Vision analysis results:             │   │
│       │       │       eye: {shape: almond, ...}                 │   │
│       │       │       mouth: {lip_shape: full, ...}             │   │
│       │       │       body: {hair: wavy brown, ...}"            │   │
│       │       │   })  ──────────────────────────────────────────┘   │
│       │       │                                                     │
│       │       └──► sendToClient({type: "state", "analyzing"})       │
│       │            sendToClient({type: "vision_active", [...]})     │
│       │                                                             │
│       ├── type: "mute"/"unmute"/"ping"/"end_session"                │
│       │       └──► handled locally                                  │
│       │                                                             │
└─────────────────────────────────────────────────────────────────────┘


TIMELINE (single analysis cycle):
═══════════════════════════════════════════════════════════════════════

 t=0s     App sends audio chunks continuously
          ──audio──audio──audio──audio──►  coordinator (BIDI)
                                          ◄──audio──audio── voice response

 t=2s     App sends frame crops
          ──frame──►  backend handler
                      │
                      ├──► sendToClient("analyzing")
                      │
                      ├──► Eye Agent  ─────► Gemini API (text, ~1s)
                      ├──► Mouth Agent ────► Gemini API (text, ~1s)
                      ├──► Body Agent  ────► Gemini API (text, ~1s)
                      │         (all 3 run simultaneously)
                      │
          audio continues uninterrupted during vision analysis
          ──audio──audio──audio──audio──►  coordinator (BIDI)
                                          ◄──audio──audio──

 t=3s     All 3 vision results return
                      │
                      └──► inject results as text into coordinator
                           liveRequestQueue.sendContent(results)
                           │
                           ▼
                      coordinator reads vision text, weaves into
                      next voice response naturally:
                      "Your almond eyes look gorgeous with
                       that liner, and the gold earrings pick
                       up the warmth in your eyeshadow..."

 t=5s     Cooldown expires, next frame triggers another cycle


WHAT CALLS WHAT:
═══════════════════════════════════════════════════════════════════════

  Component              API/Protocol         Service
  ─────────              ────────────         ───────

  App                    WebSocket            Backend adk-session.ws.ts
  (audio+frames)         ───────────►

  adk-session.ws.ts      ADK runLive()        Coordinator Agent
  (audio relay)          LiveRequestQueue     (gemini-2.5-flash-native-audio)
                         ───────────►         Gemini Live BIDI API

  adk-session.ws.ts      @google/genai        3x Gemini Flash (text)
  (frame handler)        generateContent()    Eye/Mouth/Body prompts
                         ───────────►         Standard REST API

  adk-session.ws.ts      ADK sendContent()    Coordinator Agent
  (vision results)       LiveRequestQueue     (reads text, speaks response)
                         ───────────►
```
