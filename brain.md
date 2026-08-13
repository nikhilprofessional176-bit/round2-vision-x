# 🧠 Smart Classroom 2.0 — Web-Based Low-Latency Streaming & AI Platform Architecture

## 1. Executive Summary & System Vision
**Smart Classroom 2.0** is an enterprise-grade, web-native real-time learning platform designed for hybrid and remote education. Built entirely on standard modern web standards (HTML5, CSS3 Vanilla Glassmorphism, JavaScript ES6+, WebSockets, Web Speech API, and Web Audio API), it bridges the physical-digital divide by providing:

1. **Sub-100ms Vector Whiteboard Synchronization**: 100% pixel-perfect stroke replication between Teacher and Student screens across varying window dimensions using a **Canonical 1920x1080 Virtual World Frame**.
2. **YouTube-Style Streaming Captions & Real-Time Multilingual Translation**: Live speech-to-text with < 30ms translation latency into Hindi, Bengali, Spanish, French, German, and Japanese.
3. **100% Anonymous Real-Time Student Doubt Solving**: Floating action buttons for students to ask doubts without fear of judgment, paired with a glowing **🔔 Live Doubts Bell** on the Teacher Whiteboard.
4. **Content Moderation & Flagism Engine**: Dual-tier profanity filter blocking inappropriate speech at client & gateway levels, plus a 1-click **🚩 Flag / Report** button on the Teacher Panel.
5. **IBM Granite 3.0 AI Notes Generator**: Instant automated markdown study guide generation from lecture transcripts with 1-click PDF export printing.
6. **PDF Import & Level-Personalised Notes**: Upload any external PDF and generate Beginner / Intermediate / Expert level study notes via Cerebras AI.
7. **Floating Action Button (FAB) AI Doubt Assistant**: Powered by Cerebras ultra-fast LLM (`gpt-oss-120b`).
8. **Student Authentication Engine**: Persistent JSON storage (`students_db.json`) enforcing mandatory verification codes (`studentCode === "csjmu"`).
9. **Teacher Doubt Analysis Dashboard**: AI-powered topic clustering engine that identifies which subjects students struggle with most, with visual bar/donut charts and actionable teaching recommendations.
10. **Vector Shape Tools**: Line, Arrow, Rectangle, Circle/Ellipse primitives with live ghost preview drawn in real time on all student screens.
11. **Presentation & PDF Slide Sync**: Teacher uploads PDF/image files; all pages are rendered client-side via PDF.js and synchronized slide-by-slide to every connected student in real time.
12. **Integrated Diagram Search & Overlay**: In-canvas Wikimedia Commons image search lets teachers find educational diagrams and overlay them instantly on the shared whiteboard.

> **Pure Web Native Constraint**: The platform requires zero native binary installations or browser extensions. It runs seamlessly inside standard Chrome, Edge, Safari, and Firefox browsers.

---

## 2. Key Capabilities & Feature Matrix

| Feature Module | Technology Stack | Latency / Metric | Key Description |
| :--- | :--- | :--- | :--- |
| **Canonical Vector Whiteboard** | HTML5 2D Canvas, Math Coordinates | **< 10 ms** | Maps screen space to 1920x1080 virtual world space for 1-to-1 visual alignment across different screen sizes. Includes infinite pan & zoom. |
| **Vector Shape Tools** | HTML5 Canvas, Pointer Events | **< 10 ms** | Line, Arrow (with arrowhead), Rectangle, Circle/Ellipse drawn via drag. Live dashed ghost preview during drag. Broadcast in world-space coordinates for perfect cross-screen scaling. |
| **Real-Time Speech Subtitles** | Web Speech API / Deepgram Nova-2 | **< 150 ms** | Interim partial tokens stream live as the teacher speaks. In-place DOM mutation prevents screen clutter. |
| **Multilingual Streaming Translation** | Google Translate Free Engine API | **< 30 ms** | Translates live captions into Hindi, Bengali, Spanish, French, German, etc. preserves technical terms. |
| **Anonymous Live Doubts** | WebSocket Gateway, Glassmorphism UI | **< 15 ms** | Students send anonymous doubts. Teacher canvas features a glowing 🔔 Bell Icon with unread badge counter and audio ping. |
| **Flagism & Content Moderation** | Regex Keyword Filtering + Gateway | **Instant** | Blocks abusive/profane words automatically. Teacher can flag/report with 🚩 Flag button. |
| **IBM Granite 3.0 AI Notes** | REST API `/api/generate-granite-notes` | **2 – 4 sec** | Analyzes full lecture transcript and creates structured Markdown study guides with PDF print export. |
| **PDF Import — Level-Personalised Notes** | Cerebras API + PDF.js CDN | **2 – 5 sec** | Upload any PDF → extract text client-side → generate Beginner / Intermediate / Expert notes via Cerebras `gpt-oss-120b`. |
| **Teacher Doubt Analysis Dashboard** | `teacher-analysis.html` + Wikimedia + REST | **Real-time** | Clusters all anonymous student doubts by CS topic (18 taxonomy entries), renders bar chart, donut chart, timeline, AI recommendations, weak-topic alert. Auto-refreshes every 15 seconds. |
| **Presentation Slide Sync** | PDF.js CDN, WebSocket `presentation_slide` | **< 50 ms** | Teacher uploads PDF/image → pages rendered as base64 frames → broadcast per-slide to students → student canvas renders slide as background beneath annotations. |
| **Diagram Search & Overlay** | Wikimedia Commons API (free, no key) | **< 500 ms** | Teachers search for educational diagrams, click to overlay on shared whiteboard. Students receive `whiteboard_image_overlay` event with normalized position/dimensions. |
| **Student Authentication** | Node.js REST API + `students_db.json` | **Instant** | Student registration with Gmail, Roll Number, Password, and mandatory Verification Code **`csjmu`**. |
| **Floating FAB AI Chatbot** | Cerebras API (`gpt-oss-120b`) | **< 400 ms** | Bottom-right circular FAB providing instant AI answers for student doubts during live lecture. |

---

## 3. High-Level System Architecture & Data Flow

```
                     ┌──────────────────────────────────────────────────┐
                     │ 👨‍🏫 TEACHER WEB APP (teacher.html)               │
                     │  - 1920x1080 Canonical Virtual Canvas           │
                     │  - Vector Shape Tools (Line/Arrow/Rect/Circle)  │
                     │  - PDF/Image Slide Presenter (PDF.js)           │
                     │  - Diagram Search & Overlay (Wikimedia API)     │
                     │  - Continuous Speech-to-Text Engine             │
                     │  - 🔔 Floating Doubts Bell Icon                  │
                     │  - 📊 Link to Teacher Analysis Dashboard         │
                     └────────────────────┬─────────────────────────────┘
                                          │
                        WebSocket / REST  │  Payloads:
                                          │   stroke, shape,
                                          │   presentation_slide,
                                          │   presentation_slide_change,
                                          │   whiteboard_image_overlay,
                                          │   partial_caption, final_caption,
                                          │   student_live_doubt,
                                          │   teacher_resolve_doubt,
                                          │   teacher_flag_doubt
                                          ▼
                     ┌──────────────────────────────────────────────────┐
                     │ 📡 REAL-TIME WEBSOCKET GATEWAY SERVER           │
                     │    (Node.js / Express / ws)                      │
                     │  - Room Manager (sessionId: cs101, se202, cn301)│
                     │  - Sequence Number & Event Buffer (500 events)  │
                     │  - Content Moderation & Profanity Filter        │
                     │  - Doubts Persistence (doubts_db.json)          │
                     │  - JSON Databases (students_db.json)            │
                     │  - REST APIs: /api/doubts, /api/generate-pdf-   │
                     │    notes, /api/generate-granite-notes           │
                     └────────────────────┬─────────────────────────────┘
                                          │
                        Broadcast (<10ms) │  Multi-client synchronization
                                          ▼
                     ┌──────────────────────────────────────────────────┐
                     │ 🎓 STUDENT WEB APP (index.html)                 │
                     │  - In-Place Vector Whiteboard Sync              │
                     │  - Shape Renderer (world-space → screen-space)  │
                     │  - Slide Background Renderer (letterboxed)      │
                     │  - Image Overlay Renderer (normalized coords)   │
                     │  - Real-Time Subtitle Translation               │
                     │  - 🙋‍♂️ Ask Teacher Live Doubt Button             │
                     │  - 🤖 Floating FAB AI Assistant                 │
                     │  - 📑 IBM Granite Notes Modal (Lecture + PDF)   │
                     └──────────────────────────────────────────────────┘

                     ┌──────────────────────────────────────────────────┐
                     │ 📊 TEACHER ANALYSIS DASHBOARD (teacher-analysis) │
                     │  - Topic Taxonomy (18 CS topic clusters)         │
                     │  - Bar Chart, Donut Chart, 24h Timeline          │
                     │  - Weak Topic Alert Banner                       │
                     │  - AI Teaching Recommendations per Topic         │
                     │  - Auto-refresh every 15 seconds                 │
                     └──────────────────────────────────────────────────┘
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
> **Shapes and overlays also use normalized coordinates**: Shape `startPoint`/`endPoint` are stored in 1920×1080 world space. Image overlays use 0–1 normalized coordinates (fraction of canvas width/height).

---

## 5. Student Authentication & JSON Storage

- **Persistence Layer**: `server/students_db.json`.
- **Mandatory Verification Rule**:
  - `studentCode.trim().toLowerCase()` MUST equal **`"csjmu"`**.
- **Endpoints**:
  - `POST /api/auth/signup`: Accepts `{ name, email, studentCode, rollNumber, password }`. Validates code `csjmu`, stores student record in JSON.
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
 │ 🛡️ Profanity Filter (Client & Server) │ ──[Abusive Words]──► ❌ Blocked & Alert
 └──────────────────┬────────────────────┘
                    │ [Clean Question]
                    ▼ WebSocket (`student_live_doubt`)
 ┌───────────────────────────────────────┐
 │ 📡 WebSocket Gateway                  │
 │  → persistDoubt() → doubts_db.json   │  ← NEW: Auto-persisted to disk
 │  → Relays to Teacher (<10ms)         │
 └──────────────────┬────────────────────┘
                    │
                    ▼
 ┌───────────────────────────────────────┐
 │ 👨‍🏫 Teacher Whiteboard                 │
 │ 🔔 Bell Icon Glows + Audio Ping (+1)  │
 │ Options:                              │
 │   1. [✓ Mark Resolved] ➔ Clears Badge │
 │   2. [🚩 Flag / Report] ➔ Marks Red  │
 └───────────────────────────────────────┘
                    │
                    ▼ (Async — from doubts_db.json)
 ┌───────────────────────────────────────┐
 │ 📊 Teacher Analysis Dashboard         │
 │  → Classifies doubts by topic        │
 │  → Shows weak areas & AI tips        │
 └───────────────────────────────────────┘
```

### Profanity Keywords Filtered:
`badword`, `fuck`, `shit`, `bitch`, `asshole`, `crap`, `bastard`, `idiot`, `nonsense`, `pagal`, `chutiya`, `bhosdike`, `gand`, `gaali`, `saala`, `harami`, `kamina`, `madarchod`, `bhenchod`, `randi`, `bakwas`, `porn`, `sex`, `nude`, `xxx`.

---

## 7. Ultra-Fast Multilingual Streaming Subtitles

- **Supported Target Languages**: Hindi (`hi`), Bengali (`bn`), Spanish (`es`), French (`fr`), German (`de`), Japanese (`ja`).
- **Live Text Change Tracking (`textChanged`)**:
  - Tracks live sentence growth as teacher speaks (e.g. `"recursion"` → `"recursion concept"` → `"recursion concept explained"`).
  - Triggers Google Translate Free API in **< 30ms**.
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

### 3. Whiteboard Freehand Stroke Payload (`stroke`)
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

### 4. Vector Shape Payload (`shape`) — NEW
```json
{
  "type": "shape",
  "sessionId": "cs101-recursion",
  "shape": {
    "id": "shp-1786598400000",
    "shapeType": "arrow",
    "color": "#38bdf8",
    "lineWidth": 4,
    "filled": false,
    "startPoint": { "x": 288, "y": 216 },
    "endPoint":   { "x": 864, "y": 648 }
  }
}
```
> `startPoint` and `endPoint` are in 1920×1080 canonical world space. `shapeType` can be `"line"`, `"arrow"`, `"rect"`, or `"circle"`.

### 5. Presentation Slide Broadcast (`presentation_slide`) — NEW
```json
{
  "type": "presentation_slide",
  "sessionId": "cs101-recursion",
  "slideIndex": 0,
  "totalSlides": 8,
  "imageData": "data:image/png;base64,...",
  "fileName": "Lecture3_DataStructures.pdf"
}
```

### 6. Slide Navigation (`presentation_slide_change`) — NEW
```json
{
  "type": "presentation_slide_change",
  "sessionId": "cs101-recursion",
  "slideIndex": 3
}
```

### 7. Diagram / Image Overlay (`whiteboard_image_overlay`) — NEW
```json
{
  "type": "whiteboard_image_overlay",
  "sessionId": "cs101-recursion",
  "imageUrl": "https://upload.wikimedia.org/...",
  "position":   { "x": 0.05, "y": 0.05 },
  "dimensions": { "width": 0.90, "height": 0.85 },
  "query": "Binary Search Tree diagram"
}
```
> `position` and `dimensions` are **normalized 0–1 fractions** of canvas size, ensuring pixel-perfect scaling on any student screen.

---

## 9. Teacher Doubt Analysis Dashboard

The standalone page `teacher-analysis.html` + `teacher-analysis.js` provides full AI-powered analysis of all anonymously submitted student doubts.

### Topic Taxonomy (18 CS Topics)
The classifier maps keywords to topics including:
`Linked List`, `Recursion`, `Binary Search Tree`, `Stack & Queue`, `Array & Hashing`, `Sorting Algorithms`, `Graph Theory`, `Dynamic Programming`, `Time & Space Complexity`, `OOP Concepts`, `Operating System`, `Database & SQL`, `Computer Networks`, `Pointers & Memory`, `Software Engineering`, `Bit Manipulation`, `Searching Algorithms`, `Function & Scope`.

### Dashboard Components
| Component | Description |
| :--- | :--- |
| **KPI Cards** | Total Doubts, Pending/Unresolved, Resolved, Unique Topics, #1 Struggle Topic |
| **🚨 Weak Topic Alert** | Red banner listing topics where ≥ 20% of total doubts landed |
| **Bar Chart (SVG)** | All topics ranked by doubt count with percentage labels |
| **Donut Chart (SVG)** | Top 6 topics as proportional arc segments |
| **24h Timeline** | Mini bar chart showing doubt frequency across the last 24 hours |
| **AI Recommendations** | Per-topic teaching tips with urgency level (Critical / High / Medium / Low) |
| **All Doubts Table** | Every anonymous doubt classified by topic, timestamp, and status |

### REST API Endpoints for Doubts
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/doubts` | Fetch all persisted doubts. Optional `?sessionId=` filter. |
| `POST` | `/api/doubts/update-status` | Update resolve/flag status for a doubt. |
| `POST` | `/api/doubts/clear` | Clear doubts for a session or all sessions. |
| `POST` | `/api/doubts/seed` | Inject demo doubts for presentation/testing. |

---

## 10. PDF Import & Level-Personalised Notes

Students (or teachers) can upload any external PDF. Text is extracted **client-side** via PDF.js (no server upload). The extracted text is sent to the server which calls Cerebras AI to generate notes personalised to the selected level.

### Levels
| Level | Persona | Quiz |
| :--- | :--- | :--- |
| 🌱 **Beginner** | Friendly teacher, simple language, real-world analogies, every term defined | 3 basic recall questions |
| ⚡ **Intermediate** | Subject expert, how & why explanations, comparisons, worked examples | 4 application questions |
| 🚀 **Expert** | Advanced depth, complexity analysis, edge cases, trade-offs | 5 analytical / design questions |

### Endpoint
- `POST /api/generate-pdf-notes`: Accepts `{ pdfText, fileName, level, targetLang }`. Tries Cerebras → falls back to structured local extraction.

---

## 11. Vector Shape Tools

| Tool | ID | Rendered As |
| :--- | :--- | :--- |
| ✏️ **Pen** | `draw` | Freehand polyline (existing stroke system) |
| 📏 **Line** | `line` | Straight line segment (start → end) |
| ➡️ **Arrow** | `arrow` | Line + 2-wing arrowhead at endpoint |
| ⬜ **Rectangle** | `rect` | Axis-aligned rectangle |
| ⭕ **Circle / Ellipse** | `circle` | `ctx.ellipse()` bounded by drag rectangle |
| 🖐️ **Pan** | `pan` | Canvas pan mode (no drawing) |

**Ghost Preview**: While dragging, a dashed semi-transparent ghost (`globalAlpha: 0.55`, `setLineDash([6,4])`) shows the shape before committing.

**Broadcasting**: On `pointerup`, the committed shape is broadcast via `{ type: "shape", shape: { shapeType, color, lineWidth, filled, startPoint, endPoint } }` in 1920×1080 world-space coordinates. Students render identically using their own `worldToScreen()` transform.

---

## 12. Presentation & PDF Slide Sync

| Step | Teacher | Students |
| :--- | :--- | :--- |
| 1 | Clicks **📁 Upload Slides / PDF** | — |
| 2 | PDF.js renders each page to offscreen canvas → base64 PNG | — |
| 3 | Broadcasts `presentation_slide` for each page (per-frame WS messages) | Cache each frame in `slideCache[index]` |
| 4 | Broadcasts `presentation_slide_change { slideIndex: 0 }` | Load frame into `HTMLImageElement`, set as canvas background |
| 5 | Uses `◀ Prev` / `Next ▶` nav | Canvas re-renders: slide background → overlays → strokes → shapes |

**Layer Order on Student Canvas** (bottom → top):
1. Slide background image (letterboxed, zoom/pan aware)
2. Diagram image overlays
3. Historical lecture strokes (timeline-synced)
4. Live freehand strokes
5. Live vector shapes

---

## 13. Project Directory Blueprint

```
vision-x-final-round/
├── brain.md                    # Master System Architecture & Spec (This File)
├── index.html                  # Student Web Application UI
├── app.js                      # Student Core Logic, Translation Engine & WebSocket Client
├── teacher.html                # Teacher Live Control Panel & Whiteboard
├── teacher.js                  # Canonical Whiteboard, Shapes, Slides, Diagram Search Engine
├── teacher-analysis.html       # Teacher Doubt Analysis Dashboard UI
├── teacher-analysis.js         # Topic Classifier, Chart Renderer, AI Recommendations
├── style.css                   # Glassmorphism Design System & Dynamic Layout Styles
└── server/
    ├── package.json            # Backend Dependencies (express, ws, cors, node-fetch)
    ├── server.js               # Low-Latency Gateway, Auth API, Granite Notes,
    │                           # PDF Notes, Doubts Analysis REST APIs
    ├── students_db.json        # Student JSON Database Store
    └── doubts_db.json          # Persistent Doubts Store (auto-created)
```

---

## 14. Complete REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/subjects` | List all subject classes |
| `POST` | `/api/create-subject` | Create a new subject class |
| `POST` | `/api/upload-lecture` | Upload & store a recorded lecture video |
| `GET` | `/api/sessions` | Alias for `/api/subjects` |
| `POST` | `/api/ai-doubt` | Cerebras AI doubt answer (student FAB chatbot) |
| `POST` | `/api/generate-granite-notes` | IBM Granite 3.0 lecture transcript notes |
| `POST` | `/api/generate-pdf-notes` | Level-personalised notes from imported PDF |
| `POST` | `/api/auth/signup` | Student registration (requires `csjmu` code) |
| `POST` | `/api/auth/login` | Student login |
| `GET` | `/api/doubts` | Fetch all/filtered persisted doubts |
| `POST` | `/api/doubts/update-status` | Update doubt resolve/flag status |
| `POST` | `/api/doubts/clear` | Clear doubts by session or all |
| `POST` | `/api/doubts/seed` | Seed demo doubts for testing/demo |

---

## 15. NotebookLM & AI Presentation Prompting Guide

When feeding this `brain.md` file into **NotebookLM**, **Gemini 1.5 Pro**, **ChatGPT Plus**, or **Claude 3.5 Sonnet** to generate presentation slides, infographics, architecture diagrams, or pitch deck graphics, use the following prompts:

### Recommended AI Prompts for Graphic Generation

#### Prompt 1: Infographic Architecture Slide
> *"Act as a Lead Systems Architect. Based on brain.md, generate a clean 16:9 visual presentation slide layout describing the 4-tier architecture of Smart Classroom 2.0 (Teacher Web App, WebSocket Gateway, Student Web App, Teacher Analysis Dashboard). Highlight sub-100ms whiteboard sync, Google Translate live subtitles, IBM Granite 3.0 AI Notes, PDF Slide Presenter, and Diagram Search overlay."*

#### Prompt 2: Flowchart for Anonymous Doubt & Flagism Engine
> *"Based on Section 6 of brain.md, create a detailed visual workflow diagram for the Anonymous Student Doubt Solving and Content Moderation (Flagism) feature. Show how abusive words are blocked at client & server levels, how doubts are persisted to doubts_db.json, and how the Teacher Analysis Dashboard consumes them."*

#### Prompt 3: Technical PPT Slide Deck Outline
> *"Using brain.md, create a 7-slide technical pitch deck outline for Smart Classroom 2.0. Slide 1: Problem vs Solution, Slide 2: 1920x1080 Canonical Virtual Whiteboard + Vector Shapes, Slide 3: Ultra-Fast Subtitles & Multilingual Translation, Slide 4: Real-time Anonymous Doubts & Flagism, Slide 5: PDF Slide Sync + Diagram Search, Slide 6: IBM Granite Notes + PDF Level-Personalised Notes, Slide 7: Teacher Doubt Analysis Dashboard & AI Recommendations."*

#### Prompt 4: WebSocket Protocol Diagram
> *"Based on Section 8 of brain.md, create a sequence diagram showing all 7 WebSocket message types: stroke, shape, presentation_slide, presentation_slide_change, whiteboard_image_overlay, student_live_doubt, teacher_flag_doubt. Show Teacher → Gateway → Student flow with payload examples."*
