PRD — Live AI Style Assistant

Hackathon Theme: Live Agents (Gemini Live API)
Platform: Android (React Native)
Backend: Google Cloud + Firebase + Gemini Live API
Monetization: RevenueCat
Hosting: Google Cloud (required)

1. Product Overview
Vision

A real-time AI style assistant that:

Sees the user (face + upper body only)

Talks naturally

Can be interrupted

Gives contextual beauty & fashion feedback

Maintains live conversational memory during session

Example flow:

User: “Should I wear my hair short today?”
Agent: “You’re wearing green eyeshadow and a white shirt. A short look would complement that.”

2. Core Requirements
Mandatory Tech

Gemini Live API (audio + vision)

Agent hosted on Google Cloud

Real-time streaming

Interruptible voice interaction

3. Architecture Overview

Android App (React Native)
↓
Firebase (Firestore + Device ID storage)
↓
RevenueCat (entitlement check)
↓
Google Cloud Backend (Agent Orchestrator)
↓
Gemini Live API (audio + video streaming)

4. User System
4.1 Authentication

No login required.

On first launch:

Generate device ID (UUID stored locally)

Register device in Firebase

Create user document

Firebase User Document

Collection: users

Document ID: device_id

Fields:

name: string

favorite_color: string

created_at: timestamp

subscription_status: free | premium

sessions_used_today: number

last_session_date: YYYY-MM-DD

5. Monetization

Handled via RevenueCat.

Tiers
Free Tier

1 session per day

5-minute session limit

Premium Tier

5 sessions per day

5-minute session limit

Backend Logic

Before session starts:

Check RevenueCat entitlement

Check Firebase sessions_used_today

If limit exceeded → return error

If valid → increment session counter

Reset sessions_used_today daily.

6. Session Definition

A session:

Starts when camera + mic stream opens

Ends when:

5-minute timer expires

User manually ends

Connection drops

Session countdown visible in UI.

7. Live Agent Design

We use ONE merged agent via Gemini Live API.

Capabilities:

Real-time speech recognition

Real-time voice response

Real-time video frame understanding

Conversational memory (session-scoped)

Contextual style reasoning

8. Vision Scope Limitation

UI includes a visible Face + Upper Body mask.

The system instruction enforces:

Only analyze:

Hair

Makeup (eyes, lips)

Facial expression

Upper clothing

Ignore:

Background

Room

Other people

Body below chest

This reduces ambiguity and improves performance.

9. Live Agent System Prompt (Base Instruction)

This is sent as system instruction at session start.

You are a friendly, confident real-time beauty and style assistant.

You:

Only analyze the user's face and upper body.

Focus on: hair, makeup, facial features, lips, eyes, and upper clothing.

Ignore background and anything outside the visible mask.

Give concise, confident, positive feedback.

Speak naturally and conversationally.

Keep answers short unless asked for details.

Use the user’s name when appropriate.

If session is ending, gently ask if they have more questions.

Never mention that you are an AI.

If uncertain, ask clarifying questions.

10. Personalization Injection

At session start, backend retrieves Firebase user data.

Additional dynamic instruction appended:

User name: {name}
Favorite color: {favorite_color}

If relevant, consider their favorite color in suggestions.

11. Live Video Understanding Flow

Important:
Gemini Live does NOT just extract text.

It processes:

Visual embeddings from video frames

Audio stream

Conversational context

We do NOT tell it “look for lipstick.”
Instead, the prompt instructs what to focus on.

It reasons multimodally.

12. Backend Responsibilities
12.1 Session Initialization

Endpoint: POST /start-session

Steps:

Validate device_id

Check subscription via RevenueCat

Check daily session count

Load user profile

Construct system instruction

Generate Gemini Live session token

Return:

live_session_token

session_expiry_time

remaining_sessions_today

12.2 Session Monitor

Server tracks:

Active sessions

5-minute expiration

Graceful termination

At 4:30 mark:

Send event to Gemini:
“The session will end soon. Ask if the user has final questions.”

12.3 Session End

On termination:

Close Gemini stream

Update Firebase session counter

Log session metadata

13. Safety Guardrails

The agent must:

Avoid medical advice

Avoid body shaming

Avoid sensitive judgments

Avoid attractiveness scoring

If user asks inappropriate questions → politely redirect.

14. Performance Considerations

Limit stream resolution:

720p max

15 fps sufficient

Reduce bandwidth to avoid excessive cost.

15. Firebase Structure

users/
device_id/
name
favorite_color
subscription_status
sessions_used_today
last_session_date

sessions/
session_id/
device_id
start_time
end_time
duration_seconds
subscription_tier

16. Future Extensions (Not MVP)

Style memory across sessions

Before/after comparisons

Outfit scoring

Hair simulation overlay

Screenshot save

Affiliate shopping links

17. Non-Goals (Hackathon Scope)

Persistent long-term memory

Multi-user video detection

Clothing catalog integration

AR rendering

Multi-camera input

18. MVP Success Criteria

Real-time conversation works

Vision-based contextual responses

Interruptible speech

Daily session enforcement

Premium unlock via RevenueCat

Hosted fully on Google Cloud

Uses Gemini Live API