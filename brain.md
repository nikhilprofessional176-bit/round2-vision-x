# 🧠 Smart Classroom 2.0 — Web-Based Low-Latency Live Platform Architecture

## 1. Executive Summary & Vision
This document defines the comprehensive architecture and implementation blueprint for **Smart Classroom 2.0**, a pure web-based real-time learning platform. The system delivers **YouTube-style live partial captions** (< 150–300 ms latency), real-time vector whiteboard drawing synchronization, instant multilingual translation with technical term preservation, interactive playback scrubbing, and fault-tolerant reconnection recovery.

> **Core Constraint**: The solution must be built **entirely as a web application** (HTML5, CSS3, JavaScript, Web Audio API, WebSockets/WebRTC, Web Speech API). No native desktop or mobile binaries are required.

---

## 2. Problem Statement & Latency Analysis

### Current Bottlenecks in Package-Based Architecture
In traditional sentence-based or chunk-based audio pipelines:
1. **Accumulation Delay**: The system waits for a teacher to stop speaking or for audio buffers (2–5 seconds) to fill before starting processing.
2. **Sequential Blocking Pipeline**: Audio Capture → File Upload → ASR Inference → Translation → Database Write → Client Polling. Total latency exceeds **3,000ms – 6,000ms**.
3. **UI Duplication & Flickering**: Polling leads to redundant DOM updates or duplicated caption cards.

### Target Experience
- **Sub-300ms Partial Captions**: Words appear on student screens instantly as the teacher speaks.
- **In-Place Segment Mutation**: Interim partial text updates smooth out into final translated captions under the same `segmentId` without creating new UI elements.
- **Zero-Block Rendering**: Database writes, translation, and term extraction execute asynchronously outside the hot live delivery path.

---

## 3. Comprehensive Comparison of Architectural Approaches

Since **building the website is the ONLY option**, all approaches below leverage modern browser capabilities and web backend infrastructure.

| Metric / Feature | **Approach 1: Native Web Speech API + WS Relay** | **Approach 2: Web Audio PCM Stream + Cloud AI** | **Approach 3: WebRTC P2P + WASM STT** | **Approach 4: Hybrid Dual-Engine (Recommended)** |
| :--- | :--- | :--- | :--- | :--- |
| **STT Location** | Client Browser (Teacher) | Cloud Server (Deepgram / Whisper) | Browser Web Worker (WASM) | Browser Native + Cloud Fallback |
| **Audio Transport** | Browser Internal -> Events | PCM Float32 ArrayBuffer over WS | WebRTC MediaStream (UDP) | Events / PCM AudioWorklet |
| **First Token Latency** | **< 100 ms** | **250 – 400 ms** | **150 – 300 ms** | **< 100 ms (Primary)** |
| **Browser Compatibility** | Chrome, Edge, Safari (iOS 14.5+) | 100% All Modern Browsers | Modern WebRTC Browsers | 100% (Graceful Fallback) |
| **Server AI Costs** | **$0 / month** | Per-minute API cost | $0 / month | Minimal (Only for fallback) |
| **Teacher Hardware Req.** | Low | Low | High (GPU/CPU for WASM) | Low |

---

## 4. Detailed Evaluation of Architectural Approaches

### Approach 1: Client-Side Web Speech API with Real-Time WebSocket Relay
- **How it works**: The Teacher Web App uses the browser-native `webkitSpeechRecognition` API with `continuous = true` and `interimResults = true`. As interim speech tokens arrive, the teacher app immediately broadcasts `partial_caption` JSON frames over a persistent WebSocket. When the engine fires `onresult` with `isFinal = true`, a `final_caption` event is dispatched.
- **Pros**: Zero backend AI inference cost, sub-100ms token generation, extremely fast client rendering.
- **Cons**: Speech recognition accuracy relies on client browser engine (Google Chrome/Edge provide highest accuracy).

### Approach 2: Browser AudioWorklet PCM Audio Streaming to Cloud STT Gateway
- **How it works**: The Teacher Web App captures raw microphone input using `AudioWorkletNode` (16kHz 16-bit Mono PCM). It sends binary `ArrayBuffer` audio frames (100–200ms) over WebSocket to a Node.js backend gateway. The gateway pipes streams into Deepgram/AssemblyAI Live WebSockets, which stream back partial and final transcripts to student clients.
- **Pros**: 100% browser-agnostic, uniform high accuracy across all devices.
- **Cons**: Recurring cloud API costs, additional network round-trip overhead (+150ms).

### Approach 3: WebRTC Peer-to-Peer Streaming with On-Device WASM Speech Recognition
- **How it works**: Direct WebRTC DataChannels and MediaStreams established between teacher and students. Teacher browser runs `whisper.cpp` compiled to WebAssembly inside a Web Worker.
- **Pros**: Direct P2P data flow, serverless captioning, ultra-low peer-to-peer streaming latency.
- **Cons**: High client CPU utilization; scaling to 100+ students requires a WebRTC Selective Forwarding Unit (SFU).

### Approach 4: Recommended Blueprint — Hybrid Web-Native Low-Latency Platform
- **Selected Solution**: Combines **Approach 1** for primary ultra-low latency (<100ms) with a WebSocket backend gateway that handles sequence numbering, room broadcasting, asynchronous translation, technical term preservation, and persistence.
- **Fallback**: Includes AudioWorklet PCM streaming to backend ASR for browsers lacking native `SpeechRecognition`.

---

## 5. System Architecture & Components

```
 ┌────────────────────────┐         ┌─────────────────────────────────┐         ┌────────────────────────┐
 │   Teacher Web App      │         │     Backend Gateway Server      │         │   Student Web App      │
 │  (Browser Platform)    │         │  (Node.js / Express / WS)       │         │  (Browser Platform)    │
 └───────────┬────────────┘         └────────────────┬────────────────┘         └───────────┬────────────┘
             │                                       │                                      │
   1. Live Speech Capture                   2. Broadcast Hot-Path                 3. In-Place DOM Render
   2. Vector Canvas Strokes ───────────────►  - Sequence Numbering  ─────────────►  - Segment ID Mutator
      (JSON / Binary WS)                     - Room Broadcasting                    - Web Speech TTS
                                                     │                              - Live Replay Sync
                                                     ▼
                                            4. Async Cold-Path
                                              - Translation API
                                              - Term Preservation
                                              - DB Persistence
```

### Component Breakdown

#### A. Teacher Web App (`teacher.html` / `teacher.js`)
- **Live Whiteboard Canvas**: Tracks pointer events (`pointerdown`, `pointermove`, `pointerup`), normalizes coordinates, and emits vector stroke deltas throttled to 60 FPS.
- **Streaming Speech Capture**: Continuous Web Speech API engine delivering `interimResults` every 100–200ms.
- **Control Panel**: Live broadcast status, session selector, clear canvas action, and real-time broadcast log.

#### B. Backend Realtime Gateway (`server/server.js`)
- **WebSocket Server (`ws`)**: Manages client rooms (`role=teacher`, `role=student`, `sessionId`).
- **Hot Path**: Relays incoming `partial_caption`, `final_caption`, and `stroke` events instantly (<10ms server processing). Assigns monotonically increasing `sequenceNumber` and `eventId`.
- **Cold Path (Async Pipeline)**:
  - **Translation Engine**: Translates finalized captions into target languages (Hindi, Bengali, Arabic, Spanish).
  - **Technical Term Preserver**: Protects domain keywords (e.g., `recursion`, `binary search tree`, `call stack`) from invalid translation.
  - **Session Persistence**: Appends sessions and segments to `sessions.json` or database asynchronously.

#### C. Student Web App (`index.html` / `app.js` / `style.css`)
- **Caption Stream Manager**: Maintains an in-memory Map of active segments keyed by `segmentId`.
- **Canvas Renderer**: Re-draws vector strokes progressively, maintaining sync with live or recorded scrub time.
- **Connection Health Controller**: Manages state transitions (`CONNECTING`, `LIVE`, `RECONNECTING`, `OFFLINE`), exponential backoff reconnection, heartbeat ping/pong, and missed event recovery.

---

## 6. Real-Time Event Protocol & Data Schemas

All real-time messages transmitted over WebSocket adhere to the standard envelope below.

### 1. Partial Caption Event (`partial_caption`)
```json
{
  "type": "partial_caption",
  "sessionId": "cs101-recursion",
  "segmentId": "seg-1723490000-001",
  "eventId": "evt-89102",
  "sequenceNumber": 1042,
  "timestamp": 1723490015200,
  "status": "partial",
  "sourceText": "Today we will study binary search",
  "translatedText": "",
  "payload": {
    "confidence": 0.88,
    "isFinal": false
  }
}
```

### 2. Final Caption Event (`final_caption`)
```json
{
  "type": "final_caption",
  "sessionId": "cs101-recursion",
  "segmentId": "seg-1723490000-001",
  "eventId": "evt-89103",
  "sequenceNumber": 1043,
  "timestamp": 1723490016500,
  "status": "final",
  "sourceText": "Today we will study binary search trees and base cases.",
  "translatedText": "आज हम बाइनरी सर्च ट्री और बेस केसेज का अध्ययन करेंगे।",
  "payload": {
    "confidence": 0.98,
    "isFinal": true,
    "preservedTerms": ["binary search trees", "base cases"]
  }
}
```

### 3. Whiteboard Vector Stroke Event (`stroke`)
```json
{
  "type": "stroke",
  "sessionId": "cs101-recursion",
  "eventId": "evt-89104",
  "sequenceNumber": 1044,
  "timestamp": 1723490016600,
  "stroke": {
    "id": "strk-5501",
    "color": "#38bdf8",
    "size": 3,
    "points": [
      { "x": 0.25, "y": 0.30 },
      { "x": 0.26, "y": 0.32 }
    ]
  }
}
```

### 4. Sequence Recovery Request (`recover_events`)
```json
{
  "type": "recover_events",
  "sessionId": "cs101-recursion",
  "lastSequenceNumber": 1041
}
```

---

## 7. State Machine & Reconnection Gap Recovery

```
    ┌────────────────┐
    │  DISCONNECTED  │
    └───────┬────────┘
            │ Initiate WebSocket Connection
            ▼
    ┌────────────────┐
    │   CONNECTING   │
    └───────┬────────┘
            │ Connection Established (onopen)
            ▼
    ┌────────────────┐         Ping Timeout / Drop
    │      LIVE      ├──────────────────────────────────────┐
    └───────┬────────┘                                      │
            │ Message Received                              │
            ▼                                               ▼
  [Process Event & Update]                         ┌────────────────┐
  [Store max sequenceNumber]                       │  RECONNECTING  │
                                                   └───────┬────────┘
                                                           │ Re-open + Send `recover_events`
                                                           ▼
                                                   ┌────────────────┐
                                                   │ RECOVERING GAP │
                                                   └────────────────┘
```

### Reconnection Rules:
1. **Local Storage Tracking**: Student app tracks `highestSequenceNumberReceived`.
2. **On Reconnect**: Client connects, sends `role=student`, `sessionId`, and `lastSequenceNumber`.
3. **Server Replay**: Server fetches missing events from ring buffer (`sequenceNumber > lastSequenceNumber`) and pushes them to client before resuming live stream.
4. **Duplicate Prevention**: If an incoming `eventId` or `sequenceNumber` was already processed, it is safely dropped.

---

## 8. Complete Project Directory Structure & Implementation Blueprint

```
draft 2.0/
├── brain.md                    # System Architecture & Technical Specifications (This File)
├── index.html                  # Student Web Application (HTML5 View & UI Shell)
├── style.css                   # Glassmorphism Design System & Responsive UI Styles
├── app.js                      # Student Web App Core Logic, WS Client, & DOM Mutator
├── teacher.html                # Teacher Web App Control Panel & Whiteboard
├── teacher.js                  # Speech Capture, Pointer Engine, & WS Broadcaster
└── server/
    ├── package.json            # Server Dependencies (ws, express, cors)
    ├── server.js               # Low-Latency Realtime Gateway & Async Translation Engine
    └── sessions.json           # Session Persistence & Recorded Lectures Store
```

---

## 9. Verification & Latency Benchmarking

To log and benchmark performance metrics across the entire pipeline:
```
[LATENCY LOG] Audio Captured at Browser:   1723490015000 ms
[LATENCY LOG] Audio/Partial Sent to WS:   1723490015015 ms (+15ms)
[LATENCY LOG] Backend Gateway Received:   1723490015035 ms (+20ms)
[LATENCY LOG] ASR Partial Token Emitted:  1723490015080 ms (+45ms)
[LATENCY LOG] WebSocket Broadcast Out:     1723490015090 ms (+10ms)
[LATENCY LOG] Student Browser Rendered:   1723490015115 ms (+25ms)
------------------------------------------------------------------
TOTAL END-TO-END LATENCY:                 115 ms (Target < 300 ms PASS)
```
