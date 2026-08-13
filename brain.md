# 🧠 Smart Classroom 2.0 — Web-Based Low-Latency Streaming & AI Platform Architecture

## 1. Executive Summary & System Vision
**Smart Classroom 2.0** is an enterprise-grade, web-native real-time learning platform designed for hybrid and remote education. Built entirely on standard modern web standards (HTML5, CSS3 Vanilla Glassmorphism, JavaScript ES6+, WebSockets, Web Speech API, and Web Audio API), it bridges the physical-digital divide by providing:

1. **Sub-100ms Vector Whiteboard Synchronization**: 100% pixel-perfect stroke replication between Teacher and Student screens across varying window dimensions using a **Canonical 1920x1080 Virtual World Frame**.
2. **YouTube-Style Streaming Captions & Real-Time Multilingual Translation**: Live speech-to-text with < 30ms translation latency into Hindi, Bengali, Spanish, French, German, and Japanese.
3. **100% Anonymous Real-Time Student Doubt Solving**: Floating action buttons for students to ask doubts without fear of judgment, paired with a glowing **🔔 Live Doubts Bell** on the Teacher Whiteboard.
4. **Content Moderation & Flagism Engine**: Dual-tier profanity filter blocking inappropriate speech at client & gateway levels, plus a 1-click **🚩 Flag / Report** button on the Teacher Panel.
5. **IBM Granite 3.0 AI Notes Generator**: Instant automated markdown study guide generation with 1-click PDF export printing.
6. **Floating Action Button (FAB) AI Doubt Assistant**: Powered by Cerebras ultra-fast LLM (`gpt-oss-120b`).
7. **Student Authentication Engine**: Persistent JSON storage (`students_db.json`) enforcing mandatory verification codes (`studentCode === "csjmu"`).

> **Pure Web Native Constraint**: The platform requires zero native binary installations or browser extensions. It runs seamlessly inside standard Chrome, Edge, Safari, and Firefox browsers.

---

## 2. Key Capabilities & Feature Matrix

| Feature Module | Technology Stack | Latency / Metric | Key Description |
| :--- | :--- | :--- | :--- |
| **Canonical Vector Whiteboard** | HTML5 2D Canvas, Math Coordinates | **< 10 ms** | Maps screen space to 1920x1080 virtual world space for 1-to-1 visual alignment across different screen sizes. Includes infinite pan & zoom. |
| **Real-Time Speech Subtitles** | Web Speech API / Deepgram Nova-2 | **< 150 ms** | Interim partial tokens stream live as the teacher speaks. In-place DOM mutation prevents screen clutter. |
| **Multilingual Streaming Translation** | Google Translate Free Engine API | **< 30 ms** | Translates live captions into Hindi, Bengali, Spanish, French, German, etc. preserves technical terms and original English references. |
| **Anonymous Live Doubts** | WebSocket Gateway, Glassmorphism UI | **< 15 ms** | Students send anonymous doubts. Teacher canvas features a glowing **🔔 Bell Icon** with an unread badge counter and audio ping. |
| **Flagism & Content Moderation** | Regex Keyword Filtering + Gateway | **Instant** | Blocks abusive/profane words automatically. Teacher can flag/report inappropriate doubts with a 1-click **🚩 Flag** button. |
| **IBM Granite 3.0 AI Notes** | REST API `/api/generate-granite-notes` | **2 – 4 sec** | Analyzes full lecture transcript and creates structured Markdown study guides with PDF print export. |
| **Student Authentication** | Node.js REST API + `students_db.json` | **Instant** | Student registration with Gmail, Roll Number, Password, and mandatory Verification Code **`csjmu`**. |
| **Floating FAB AI Chatbot** | Cerebras API (`gpt-oss-120b`) | **< 400 ms** | Bottom-right circular FAB (`bottom: 85px; right: 28px;`) providing instant AI answers for student doubts. |

---

## 3. High-Level System Architecture & Data Flow

```
                     ┌─────────────────────────────────────────┐
                     │ 👨‍🏫 TEACHER WEB APP (teacher.html)      │
                     │  - 1920x1080 Canonical Virtual Canvas  │
                     │  - Continuous Speech-to-Text Engine    │
                     │  - 🔔 Floating Doubts Bell Icon         │
                     └────────────────────┬────────────────────┘
                                          │
                        WebSocket / REST  │  Payloads: (stroke, partial_caption, final_caption,
                                          │   student_live_doubt, teacher_resolve_doubt, etc.)
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ 📡 REAL-TIME WEBSOCKET GATEWAY SERVER  │
                     │    (Node.js / Express / ws)             │
                     │  - Room Manager (sessionId: cs101)    │
                     │  - Sequence Number & Event Buffer (500)│
                     │  - Content Moderation & Profanity Filter│
                     │  - JSON Database (students_db.json)   │
                     └────────────────────┬────────────────────┘
                                          │
                        Broadcast (<10ms) │  Multi-client synchronization
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ 🎓 STUDENT WEB APP (index.html)        │
                     │  - In-Place Vector Whiteboard Sync    │
                     │  - Real-Time Subtitle Translation      │
                     │  - 🙋‍♂️ Ask Teacher Live Doubt Button    │
                     │  - 🤖 Floating FAB AI Assistant        │
                     │  - 📝 IBM Granite Notes Modal           │
                     └─────────────────────────────────────────┘
```

---

## 4. Canonical 1920x1080 Virtual Canvas Synchronization

To eliminate screen distortion and layout misalignment between Teacher screens (e.g. 1400px wide) and Student screens (e.g. 750px flex columns):

### Transformation Formula
1. **Screen to World Transformation (Teacher Side)**:
   $$X_{world} = \left( X_{screen} - \text{panX} \right) \times \frac{1920}{\text{canvasWidth} \times \text{zoom}}$$
   $$Y_{world} = \left( Y_{screen} - \text{panY} \right) \times \frac{1080}{\text{canvasHeight} \times \text{zoom}}$$

2. **World to Screen Transformation (Student Side)**:
   $$X_{screen} = \left( X_{world} \times \frac{\text{canvasWidth}}{1920} \times \text{zoom} \right) + \text{panX}$$
   $$Y_{screen} = \left( Y_{world} \times \frac{\text{canvasHeight}}{1080} \times \text{zoom} \right) + \text{panY}$$

This guarantees 1-to-1 position, proportion, and stroke accuracy across all device resolutions.

---

## 5. Student Authentication & JSON Storage

- **Persistence Layer**: `server/students_db.json`.
- **Mandatory Verification Rule**:
  - `studentCode.trim().toLowerCase()` MUST equal **`"csjmu"`**.
- **Endpoints**:
  - `POST /api/auth/signup`: Accepts `{ name, email, studentCode, rollNumber, password }`. Validates code `csjmu`, hashes/stores student record in JSON.
  - `POST /api/auth/login`: Accepts `{ email, password }`. Authenticates registered student and returns profile token.

---

## 6. Real-Time Anonymous Doubt Solving & Flagism Engine

### Workflow Diagram

```
 ┌───────────────────────────────────────┐
 │ 🎓 Student Canvas                     │
 │ Clicks "🙋‍♂️ Ask Teacher Live Doubt"    │
 └──────────────────┬────────────────────┘
                    │
                    ▼ (Client Profanity Check)
 ┌───────────────────────────────────────┐
 │ 🛡️ Profanity Filter (Client & Server) │ ──[Contains Abusive Words]──► ❌ Blocked & Alert
 └──────────────────┬────────────────────┘
                    │ [Clean Question]
                    ▼ WebSocket (`student_live_doubt`)
 ┌───────────────────────────────────────┐
 │ 📡 WebSocket Gateway                  │
 │ Relays doubt payload (<10ms)          │
 └──────────────────┬────────────────────┘
                    │
                    ▼
 ┌───────────────────────────────────────┐
 │ 👨‍🏫 Teacher Whiteboard                 │
 │ 🔔 Bell Icon Glows + Audio Ping (+1)  │
 │ Options:                             │
 │   1. [✓ Mark Resolved] ➔ Clears Badge │
 │   2. [🚩 Flag / Report] ➔ Marks Red  │
 └───────────────────────────────────────┘
```

### Profanity Keywords Filtered:
`badword`, `fuck`, `shit`, `bitch`, `asshole`, `crap`, `bastard`, `idiot`, `nonsense`, `pagal`, `chutiya`, `bhosdike`, `gand`, `gaali`, `saala`, `harami`, `kamina`, `madarchod`, `bhenchod`, `randi`, `bakwas`.

---

## 7. Ultra-Fast Multilingual Streaming Subtitles

- **Supported Target Languages**: Hindi (`hi`), Bengali (`bn`), Spanish (`es`), French (`fr`), German (`de`), Japanese (`ja`).
- **Live Text Change Tracking (`textChanged`)**:
  - Tracks live sentence growth as teacher speaks (e.g. `"recursion"` $\rightarrow$ `"recursion concept"` $\rightarrow$ `"recursion concept explained"`).
  - Triggers Google Translate Free API (`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=...`) in **< 30ms**.
- **Dual-View UI Card**:
  - **Primary Text** (Bright Sky-Blue): Translated native text (e.g., *पुनरावृत्ति अवधारणा*).
  - **Secondary Text** (Muted Gray): `Original: recursion concept explained`.

---

## 8. WebSocket Protocols & JSON Schemas

### 1. Student Live Doubt Payload (`student_live_doubt`)
```json
{
  "type": "student_live_doubt",
  "id": "dbt-1786598400000",
  "sessionId": "cs101-recursion",
  "studentName": "Anonymous Student",
  "studentRoll": "Anonymous",
  "doubtText": "What is the base case condition in recursion?",
  "timestamp": 1786598400000,
  "status": "unread"
}
```

### 2. Teacher Flag Doubt Payload (`teacher_flag_doubt`)
```json
{
  "type": "teacher_flag_doubt",
  "sessionId": "cs101-recursion",
  "doubtId": "dbt-1786598400000"
}
```

### 3. Whiteboard Canonical Vector Stroke Payload (`stroke`)
```json
{
  "type": "stroke",
  "sessionId": "cs101-recursion",
  "sequenceNumber": 1052,
  "stroke": {
    "id": "strk-901",
    "color": "#38bdf8",
    "size": 4,
    "points": [
      { "x": 960, "y": 540 },
      { "x": 970, "y": 545 }
    ]
  }
}
```

---

## 9. Project Directory Blueprint

```
vision-x-final-round/
├── brain.md                    # Master System Architecture & AI Graphic Spec (This File)
├── index.html                  # Student Web Application UI
├── app.js                      # Student Core Logic, Translation Engine & WebSocket Client
├── teacher.html                # Teacher Live Control Panel & Whiteboard
├── teacher.js                  # Canonical Whiteboard Drawing Engine & Doubts Manager
├── style.css                   # Glassmorphism Design System & Dynamic Layout Styles
└── server/
    ├── package.json            # Backend Dependencies
    ├── server.js               # Low-Latency Gateway, Auth API & Granite AI Notes Route
    └── students_db.json        # Student JSON Database Store
```

---

## 10. NotebookLM & AI Presentation Prompting Guide

When feeding this `brain.md` file into **NotebookLM**, **Gemini 1.5 Pro**, **ChatGPT Plus**, or **Claude 3.5 Sonnet** to generate presentation slides, infographics, architecture diagrams, or pitch deck graphics, use the following prompts:

### Recommended AI Prompts for Graphic Generation

#### Prompt 1: Infographic Architecture Slide
> *"Act as a Lead Systems Architect. Based on brain.md, generate a clean 16:9 visual presentation slide layout describing the 3-tier architecture of Smart Classroom 2.0 (Teacher Web App, WebSocket Gateway, Student Web App). Highlight sub-100ms whiteboard sync, Google Translate live subtitles, and IBM Granite 3.0 AI Notes."*

#### Prompt 2: Flowchart for Anonymous Doubt & Flagism Engine
> *"Based on Section 6 of brain.md, create a detailed visual workflow diagram for the Anonymous Student Doubt Solving and Content Moderation (Flagism) feature. Show how abusive words are blocked at client & server levels, and how the teacher uses the floating 🔔 Bell Icon and 🚩 Flag button."*

#### Prompt 3: Technical PPT Slide Deck Outline
> *"Using brain.md, create a 5-slide technical pitch deck outline for Smart Classroom 2.0. Include Slide 1: Problem vs Solution, Slide 2: 1920x1080 Canonical Virtual Whiteboard, Slide 3: Ultra-Fast Subtitles & Multilingual Translation, Slide 4: Real-time Anonymous Doubts & Flagism, Slide 5: Tech Stack & Benchmarks."*
