/**
 * 🎓 Smart Classroom 2.0 — Student Web Application Core Engine
 * 
 * Handles real-time WebSocket connection, sequence gap recovery, target in-place caption
 * DOM updates (partial & final), vector canvas stroke rendering, Web Speech TTS,
 * and notes/subtitle export.
 */

// Preset Lecture Session Fallback Data
const DEMO_SESSIONS = [
  {
    id: "cs101-recursion",
    title: "CS101: Recursion & Binary Search Trees",
    instructor: "Prof. A. Sharma",
    durationSeconds: 45,
    segments: [
      {
        id: "seg-001",
        startTime: 0,
        endTime: 12,
        englishText: "Welcome to today's lecture on recursion and binary search trees.",
        translations: {
          hi: "पुनरावृत्ति (recursion) और बाइनरी सर्च ट्री पर आज के व्याख्यान में आपका स्वागत है।",
          bn: "রিকার্সন এবং বাইনারি সার্চ ট্রির আজকের লেকচারে স্বাগতম।",
          ar: "مرحبا بكم في محاضرة اليوم حول العودية وأشجار البحث الثنائية।",
          es: "Bienvenidos a la clase de hoy sobre recursividad y árboles de búsqueda binaria."
        },
        strokes: []
      }
    ]
  }
];

const TECHNICAL_TERMS = [
  "recursion", "base case", "call stack", "binary search tree", "root node", 
  "leaf node", "pointer", "memory", "algorithm", "binary search"
];

class SmartClassroomStudentApp {
  constructor() {
    this.currentSessionId = "cs101-recursion";
    this.currentLecture = DEMO_SESSIONS[0];
    this.currentLanguage = "en"; // Default to English for instant live streaming partial text
    this.currentTime = 0;
    this.isPlaying = true;
    this.isTTSOn = false;
    this.playbackSpeed = 1;
    this.activeSegmentId = null;
    
    // Live Real-Time Vector Strokes Array
    this.liveStrokes = [];
    
    // WebSocket & Sequence State
    this.ws = null;
    this.highestSequenceNumberReceived = 0;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.segmentsMap = new Map(); // Key: segmentId -> segment object
    
    // DOM Cache
    this.canvas = document.getElementById("whiteboard-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.captionFeed = document.getElementById("caption-feed");
    this.timelineSlider = document.getElementById("timeline-slider");
    this.playBtn = document.getElementById("play-btn");
    this.currentTimeEl = document.getElementById("current-time");
    this.totalTimeEl = document.getElementById("total-time");
    this.langSelect = document.getElementById("lang-select");
    this.sessionSelect = document.getElementById("session-select");
    this.ttsBtn = document.getElementById("tts-btn");
    this.exportNotesBtn = document.getElementById("export-notes-btn");
    this.exportVttBtn = document.getElementById("export-vtt-btn");
    this.speedSelect = document.getElementById("speed-select");
    this.connectionBadge = document.getElementById("connection-badge");
    this.statusText = document.getElementById("status-text");
    this.debugConsole = document.getElementById("debug-console");

    // Recorded Lectures Modal DOM Cache
    this.recordingsBtn = document.getElementById("recordings-btn");
    this.recordingsModal = document.getElementById("recordings-modal");
    this.closeModalBtn = document.getElementById("close-modal-btn");
    this.recordingsGrid = document.getElementById("recordings-grid");
    this.playerContainer = document.getElementById("player-container");
    this.videoPlayer = document.getElementById("lecture-video-player");
    this.playingTitle = document.getElementById("playing-title");

    // Infinite Pan & Zoom State & DOM Cache
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.isPanning = false;
    this.isPanMode = false;
    this.panStart = { x: 0, y: 0 };

    this.studentPanBtn = document.getElementById("student-pan-btn");
    this.studentResetBtn = document.getElementById("student-reset-btn");
    this.studentZoomInBtn = document.getElementById("student-zoom-in-btn");
    this.studentZoomOutBtn = document.getElementById("student-zoom-out-btn");
    this.studentZoomResetBtn = document.getElementById("student-zoom-reset-btn");
    this.studentZoomBadge = document.getElementById("student-zoom-badge");
    this.studentPanCoords = document.getElementById("student-pan-coords");

    // YouTube-style Subtitle & AI Chatbot State & Cache
    this.videoCaptionOverlay = document.getElementById("video-caption-overlay");
    this.ytCaptionText = document.getElementById("yt-caption-text");
    this.playerLangSelect = document.getElementById("player-lang-select");
    this.aiChatFeed = document.getElementById("ai-chat-feed");
    this.aiChatForm = document.getElementById("ai-chat-form");
    this.aiChatInput = document.getElementById("ai-chat-input");
    this.aiContextBadge = document.getElementById("ai-context-badge");
    
    this.activeVideoCaptions = [];
    this.activeSubLang = "en";
    this.subTranslationCache = new Map();
    this.currentActiveSegId = null;

    this.initCanvasSize();
    this.bindEvents();
    this.loadLectureSession(this.currentLecture);
    this.connectWebSocket();
    this.startPlaybackLoop();
  }

  initCanvasSize() {
    const parent = this.canvas.parentElement;
    this.canvasWidth = parent.clientWidth || 800;
    this.canvasHeight = parent.clientHeight || 500;
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
  }

  zoomAt(screenX, screenY, factor) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    const worldPt = {
      x: (canvasX - this.panX) / this.zoom,
      y: (canvasY - this.panY) / this.zoom
    };

    let newZoom = this.zoom * factor;
    newZoom = Math.min(Math.max(0.25, newZoom), 4.0);

    this.panX = canvasX - worldPt.x * newZoom;
    this.panY = canvasY - worldPt.y * newZoom;
    this.zoom = newZoom;

    this.renderWhiteboardStrokes();
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      this.initCanvasSize();
      this.renderWhiteboardStrokes();
    });

    // Mouse Wheel Zooming at Cursor Position
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // Student Zoom Controls
    if (this.studentZoomInBtn) {
      this.studentZoomInBtn.addEventListener("click", () => {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(rect.left + this.canvasWidth / 2, rect.top + this.canvasHeight / 2, 1.25);
      });
    }

    if (this.studentZoomOutBtn) {
      this.studentZoomOutBtn.addEventListener("click", () => {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(rect.left + this.canvasWidth / 2, rect.top + this.canvasHeight / 2, 0.8);
      });
    }

    if (this.studentZoomResetBtn) {
      this.studentZoomResetBtn.addEventListener("click", () => {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.renderWhiteboardStrokes();
      });
    }

    if (this.studentPanBtn) {
      this.studentPanBtn.addEventListener("click", () => {
        this.isPanMode = !this.isPanMode;
        this.studentPanBtn.classList.toggle("active", this.isPanMode);
        this.canvas.style.cursor = this.isPanMode ? "grab" : "default";
      });
    }

    if (this.studentResetBtn) {
      this.studentResetBtn.addEventListener("click", () => {
        this.panX = 0;
        this.panY = 0;
        this.renderWhiteboardStrokes();
      });
    }

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.isPanMode || e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.renderWhiteboardStrokes();
      }
    });

    this.canvas.addEventListener("pointerup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = this.isPanMode ? "grab" : "default";
      }
    });

    if (this.recordingsBtn) {
      this.recordingsBtn.addEventListener("click", () => this.openRecordingsModal());
    }

    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener("click", () => this.closeRecordingsModal());
    }

    // Video Player Subtitles & CC Listener
    if (this.videoPlayer) {
      this.videoPlayer.addEventListener("timeupdate", () => this.updateVideoSubtitles());
    }

    if (this.playerLangSelect) {
      this.playerLangSelect.addEventListener("change", (e) => {
        this.activeSubLang = e.target.value;
        this.updateVideoSubtitles(true);
      });
    }

    if (this.aiChatForm) {
      this.aiChatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAIDoubtSubmit();
      });
    }

    if (this.recordingsModal) {
      this.recordingsModal.addEventListener("click", (e) => {
        if (e.target === this.recordingsModal) this.closeRecordingsModal();
      });
    }

    this.sessionSelect.addEventListener("change", (e) => {
      this.currentSessionId = e.target.value;
      const found = DEMO_SESSIONS.find(s => s.id === this.currentSessionId);
      if (found) {
        this.loadLectureSession(found);
      }
      this.connectWebSocket();
    });

    this.langSelect.addEventListener("change", (e) => {
      this.currentLanguage = e.target.value;
      this.logDebug("LANG", `Language switched to: ${this.currentLanguage}`);
      this.renderCaptions();
    });

    this.ttsBtn.addEventListener("click", () => {
      this.isTTSOn = !this.isTTSOn;
      this.ttsBtn.innerHTML = this.isTTSOn ? "🔊 TTS On" : "🔊 TTS Off";
      this.ttsBtn.classList.toggle("active", this.isTTSOn);
    });

    this.playBtn.addEventListener("click", () => this.togglePlayPause());

    this.timelineSlider.addEventListener("input", (e) => {
      this.currentTime = parseFloat(e.target.value);
      this.updateView();
    });

    this.speedSelect.addEventListener("change", (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
    });

    this.exportNotesBtn.addEventListener("click", () => this.exportPDFNotes());
    this.exportVttBtn.addEventListener("click", () => this.exportWebVTTSubtitles());
  }

  // =========================================================================
  // WebSocket Core Client & Reconnection Engine
  // =========================================================================
  getWebSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.hostname}:5000`
      : window.location.host;
    return `${protocol}//${host}?role=student&sessionId=${this.currentSessionId}`;
  }

  connectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = this.getWebSocketUrl();
    this.updateConnectionState("connecting", `CONNECTING...`);
    this.logDebug("WS", `Connecting to WebSocket: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateConnectionState("live", `LIVE: ${this.currentSessionId}`);
        this.logDebug("WS", "WebSocket connection open. Subscribing...");
        
        // Send subscribe request with sequence number for recovery
        this.ws.send(JSON.stringify({
          type: "subscribe",
          sessionId: this.currentSessionId,
          lastSequenceNumber: this.highestSequenceNumberReceived
        }));

        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.error("Message parse error:", err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.updateConnectionState("reconnecting", `RECONNECTING...`);
        this.scheduleReconnection();
      };

      this.ws.onerror = () => {
        this.logDebug("WS_ERR", "WebSocket connection error.");
      };

    } catch (e) {
      this.updateConnectionState("reconnecting", "RECONNECTING...");
      this.scheduleReconnection();
    }
  }

  scheduleReconnection() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.logDebug("RECONNECT", `Retrying in ${Math.round(delay/1000)}s (Attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  updateConnectionState(stateClass, labelText) {
    this.connectionBadge.className = `status-badge ${stateClass}`;
    this.statusText.textContent = labelText;
  }

  // =========================================================================
  // Target In-Place Caption & Vector Stroke Message Router
  // =========================================================================
  handleIncomingMessage(data) {
    const now = Date.now();
    if (data.sequenceNumber && data.sequenceNumber > this.highestSequenceNumberReceived) {
      this.highestSequenceNumberReceived = data.sequenceNumber;
    }

    switch (data.type) {
      case "partial_caption":
      case "final_caption":
      case "translation_update":
        this.handleCaptionEvent(data, now);
        break;

      case "stroke":
      case "stroke_event":
        this.handleStrokeEvent(data);
        break;

      case "clear_canvas":
        this.liveStrokes = [];
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.renderGridBackground();
        this.logDebug("CANVAS", "Canvas cleared by teacher.");
        break;

      case "heartbeat":
        break;

      default:
        break;
    }
  }

  handleCaptionEvent(data, receiveTimestamp) {
    const segmentId = data.segmentId || `seg-${data.timestamp || Date.now()}`;
    const status = data.status || (data.type === "partial_caption" ? "partial" : "final");

    let seg = this.segmentsMap.get(segmentId);
    if (!seg) {
      seg = {
        id: segmentId,
        startTime: Math.floor(this.currentTime),
        endTime: Math.floor(this.currentTime) + 5,
        englishText: data.sourceText || "",
        status: status,
        translations: {}
      };
      this.segmentsMap.set(segmentId, seg);
      this.currentLecture.segments.push(seg);
    } else {
      // Instant in-place segment text update
      if (data.sourceText) seg.englishText = data.sourceText;
      seg.status = status;
    }

    if (data.translatedText && this.currentLanguage !== "en") {
      seg.translations[this.currentLanguage] = data.translatedText;
    }

    // Instant Target In-Place DOM Mutation
    this.renderOrUpdateSingleCard(seg);

    // Stage Latency Benchmark Logging
    if (data.timestamp) {
      const totalLatency = Math.max(5, receiveTimestamp - data.timestamp);
      this.logDebug("LATENCY LOG", `browserRendered for [${segmentId}] - End-to-End Latency: ${totalLatency}ms`);
    }

    if (this.isTTSOn && status === "final") {
      this.speakSegment(seg);
    }
  }

  handleStrokeEvent(data) {
    if (!data.stroke) return;
    this.liveStrokes.push(data.stroke);
    this.drawSingleStroke(data.stroke);
    this.logDebug("STROKE", `Received live stroke (${data.stroke.points.length} points)`);
  }

  // =========================================================================
  // Target DOM Micro-Updates (Instant In-Place Segment Mutation)
  // =========================================================================
  renderCaptions() {
    this.captionFeed.innerHTML = "";
    this.currentLecture.segments.forEach(seg => {
      this.segmentsMap.set(seg.id, seg);
      this.renderOrUpdateSingleCard(seg);
    });
  }

  renderOrUpdateSingleCard(seg) {
    let card = document.getElementById(`card-${seg.id}`);
    const textToDisplay = (this.currentLanguage !== "en" && seg.translations[this.currentLanguage])
      ? seg.translations[this.currentLanguage]
      : seg.englishText;

    const formattedText = this.highlightTechnicalTerms(textToDisplay);
    const timeLabel = this.formatTime(seg.startTime || 0);

    if (!card) {
      // Create new card DOM element
      card = document.createElement("div");
      card.id = `card-${seg.id}`;
      card.className = `caption-card ${seg.status === "partial" ? "partial" : ""}`;
      
      card.innerHTML = `
        <div class="caption-meta">
          <span class="caption-time">⏱️ ${timeLabel}</span>
          <span class="caption-status" style="font-size:0.7rem;">${seg.status === "partial" ? "LIVE STREAMING" : "FINAL"}</span>
        </div>
        <div class="caption-text-source">${formattedText}</div>
        ${this.currentLanguage !== "en" && seg.translations[this.currentLanguage] ? `<div class="caption-text-translated">${seg.translations[this.currentLanguage]}</div>` : ''}
      `;

      card.addEventListener("click", () => {
        this.currentTime = seg.startTime;
        this.updateView();
      });

      this.captionFeed.appendChild(card);
      this.captionFeed.scrollTop = this.captionFeed.scrollHeight; // Fast instant scroll without animation lag
    } else {
      // Update existing DOM card in-place (No Flickering or Duplicates)
      card.className = `caption-card ${seg.status === "partial" ? "partial" : ""}`;
      const srcEl = card.querySelector(".caption-text-source");
      if (srcEl) srcEl.innerHTML = formattedText;

      const statusEl = card.querySelector(".caption-status");
      if (statusEl) statusEl.textContent = seg.status === "partial" ? "LIVE STREAMING" : "FINAL";

      let transEl = card.querySelector(".caption-text-translated");
      if (this.currentLanguage !== "en" && seg.translations[this.currentLanguage]) {
        if (!transEl) {
          transEl = document.createElement("div");
          transEl.className = "caption-text-translated";
          card.appendChild(transEl);
        }
        transEl.textContent = seg.translations[this.currentLanguage];
      }
      this.captionFeed.scrollTop = this.captionFeed.scrollHeight;
    }
  }

  highlightTechnicalTerms(text) {
    let result = text;
    TECHNICAL_TERMS.forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, "gi");
      result = result.replace(regex, `<span class="term-chip">$1</span>`);
    });
    return result;
  }

  // =========================================================================
  // Canvas Vector Stroke Renderer
  // =========================================================================
  loadLectureSession(session) {
    this.currentLecture = session;
    this.currentTime = 0;
    this.liveStrokes = [];
    this.timelineSlider.max = session.durationSeconds;
    this.totalTimeEl.textContent = this.formatTime(session.durationSeconds);
    this.renderCaptions();
    this.renderWhiteboardStrokes();
  }

  renderWhiteboardStrokes() {
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.renderGridBackground();

    // 1. Render historical timeline strokes up to currentTime
    if (this.currentLecture && this.currentLecture.segments) {
      this.currentLecture.segments.forEach(segment => {
        if (this.currentTime < segment.startTime) return;
        if (segment.strokes) {
          segment.strokes.forEach(stroke => this.drawSingleStroke(stroke));
        }
      });
    }

    // 2. ALWAYS render live teacher strokes in real-time
    if (this.liveStrokes && this.liveStrokes.length > 0) {
      this.liveStrokes.forEach(stroke => this.drawSingleStroke(stroke));
    }
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.panX,
      y: worldY * this.zoom + this.panY
    };
  }

  renderGridBackground() {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    this.ctx.lineWidth = 1;
    const step = 40 * this.zoom;
    const offsetX = (this.panX % step + step) % step;
    const offsetY = (this.panY % step + step) % step;

    for (let x = offsetX; x < this.canvasWidth; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvasHeight);
      this.ctx.stroke();
    }
    for (let y = offsetY; y < this.canvasHeight; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvasWidth, y);
      this.ctx.stroke();
    }

    if (this.studentPanCoords) {
      this.studentPanCoords.textContent = `Pan: (${Math.round(this.panX)}, ${Math.round(this.panY)})`;
    }
    if (this.studentZoomBadge) {
      this.studentZoomBadge.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  drawSingleStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color || "#38bdf8";
    this.ctx.lineWidth = (stroke.size || 3) * this.zoom;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    stroke.points.forEach((p, idx) => {
      // Support both normalized (0..1) legacy points and new world space points
      const worldX = (p.x <= 1 && p.x >= 0) ? p.x * this.canvasWidth : p.x;
      const worldY = (p.y <= 1 && p.y >= 0) ? p.y * this.canvasHeight : p.y;
      const screenPt = this.worldToScreen(worldX, worldY);

      if (idx === 0) this.ctx.moveTo(screenPt.x, screenPt.y);
      else this.ctx.lineTo(screenPt.x, screenPt.y);
    });
    this.ctx.stroke();
  }

  // =========================================================================
  // Playback Loop & Web Speech TTS
  // =========================================================================
  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    this.playBtn.innerHTML = this.isPlaying ? "❚❚" : "▶";
  }

  startPlaybackLoop() {
    setInterval(() => {
      if (this.isPlaying) {
        this.currentTime += 0.2 * this.playbackSpeed;
        if (this.currentTime >= this.currentLecture.durationSeconds) {
          this.currentTime = this.currentLecture.durationSeconds;
          this.isPlaying = false;
          this.playBtn.innerHTML = "▶";
        }
        this.updateView();
      }
    }, 200);
  }

  updateView() {
    this.timelineSlider.value = this.currentTime;
    this.currentTimeEl.textContent = this.formatTime(this.currentTime);

    const activeSeg = this.currentLecture.segments.find(
      s => this.currentTime >= s.startTime && this.currentTime <= s.endTime
    );

    if (activeSeg && activeSeg.id !== this.activeSegmentId) {
      this.activeSegmentId = activeSeg.id;
      document.querySelectorAll(".caption-card").forEach(c => c.classList.remove("active-segment"));
      const card = document.getElementById(`card-${activeSeg.id}`);
      if (card) card.classList.add("active-segment");
    }

    this.renderWhiteboardStrokes();
  }

  speakSegment(seg) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const text = (this.currentLanguage !== "en" && seg.translations[this.currentLanguage])
      ? seg.translations[this.currentLanguage]
      : seg.englishText;

    const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, ""));
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // =========================================================================
  // Export Notes & Subtitles Engine
  // =========================================================================
  exportPDFNotes() {
    const printWindow = window.open("", "_blank");
    const html = `
      <html>
      <head>
        <title>Lecture Notes — ${this.currentLecture.title}</title>
        <style>
          body { font-family: sans-serif; padding: 30px; color: #1e293b; }
          h1 { color: #0284c7; }
          .seg-box { border-bottom: 1px solid #cbd5e1; padding: 12px 0; }
          .term { background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>📝 ${this.currentLecture.title}</h1>
        <p><strong>Instructor:</strong> ${this.currentLecture.instructor || "Prof. A. Sharma"}</p>
        <hr/>
        <h2>Lecture Transcript & Key Terms</h2>
        ${this.currentLecture.segments.map(s => `
          <div class="seg-box">
            <p><strong>[${this.formatTime(s.startTime)}]</strong> ${s.englishText}</p>
            ${s.translations.hi ? `<p style="color: #0369a1;"><em>${s.translations.hi}</em></p>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  exportWebVTTSubtitles() {
    let vtt = "WEBVTT\n\n";
    this.currentLecture.segments.forEach((s, i) => {
      const start = this.formatVTTTime(s.startTime);
      const end = this.formatVTTTime(s.endTime || s.startTime + 5);
      vtt += `${i + 1}\n${start} --> ${end}\n${s.englishText}\n\n`;
    });

    const blob = new Blob([vtt], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentLecture.id}-subtitles.vtt`;
    a.click();
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatVTTTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  // =========================================================================
  // Recorded Lectures Video Library Modal & HTML5 Video Player Engine
  // =========================================================================
  // =========================================================================
  // Recorded Lectures Video Library Modal & HTML5 Video Player Engine
  // =========================================================================
  async openRecordingsModal() {
    if (!this.recordingsModal) return;
    this.recordingsModal.style.display = "flex";
    this.logDebug("LIBRARY", "Opening Recorded Lectures Library...");

    try {
      const response = await fetch('/api/subjects');
      const data = await response.json();
      this.cachedSubjects = (data.success && data.subjects) ? data.subjects : [];
      this.populateSubjectFilter(this.cachedSubjects);
      this.renderRecordingsGrid("all");
    } catch (err) {
      this.logDebug("LIBRARY_ERR", `Failed to load subjects: ${err.message}`);
    }
  }

  populateSubjectFilter(subjects) {
    const filterSelect = document.getElementById("subject-filter-select");
    if (!filterSelect) return;

    filterSelect.innerHTML = `<option value="all">📚 All Subjects / Classes</option>`;
    subjects.forEach(sub => {
      const recCount = sub.recordings ? sub.recordings.length : 0;
      const opt = document.createElement("option");
      opt.value = sub.id;
      opt.textContent = `📖 ${sub.name} (${recCount} Videos)`;
      filterSelect.appendChild(opt);
    });

    filterSelect.onchange = (e) => {
      this.renderRecordingsGrid(e.target.value);
    };
  }

  closeRecordingsModal() {
    if (!this.recordingsModal) return;
    this.recordingsModal.style.display = "none";
    if (this.videoPlayer) {
      this.videoPlayer.pause();
    }
  }

  renderRecordingsGrid(selectedSubjectId = "all") {
    if (!this.recordingsGrid) return;
    this.recordingsGrid.innerHTML = "";

    const subjectsToRender = (selectedSubjectId === "all")
      ? (this.cachedSubjects || [])
      : (this.cachedSubjects || []).filter(s => s.id === selectedSubjectId);

    let totalVideos = 0;

    subjectsToRender.forEach(subject => {
      const recs = subject.recordings || [];
      recs.forEach(rec => {
        totalVideos++;
        const card = document.createElement("div");
        card.className = "lecture-card";
        card.innerHTML = `
          <div class="lecture-card-title">📹 ${rec.title || "Lecture Video"}</div>
          <div class="lecture-card-meta">📚 <strong>${subject.name}</strong></div>
          <div class="lecture-card-meta">👨‍🏫 ${subject.instructor || "Prof. A. Sharma"}</div>
          <div class="lecture-card-meta">🕒 ${rec.formattedDate || "Recorded"}</div>
          <div class="storage-badge">${rec.uploadMethod || "GitHub Video"}</div>
        `;

        card.addEventListener("click", () => {
          this.playRecordedVideo(rec.videoUrl, `${subject.name} - ${rec.title}`, rec);
        });

        this.recordingsGrid.appendChild(card);
      });
    });

    if (totalVideos === 0) {
      this.recordingsGrid.innerHTML = `<div style="grid-column: 1/-1; color: #94a3b8; font-size: 0.9rem; text-align: center; padding: 30px;">No recorded videos available for this subject yet.</div>`;
    }
  }

  playRecordedVideo(videoUrl, title, recordingObj = null) {
    if (!this.videoPlayer || !this.playerContainer) return;
    this.playerContainer.style.display = "block";
    if (this.playingTitle) this.playingTitle.textContent = `▶ Now Playing: ${title}`;
    this.videoPlayer.src = videoUrl;

    this.activeVideoCaptions = (recordingObj && recordingObj.captions && recordingObj.captions.length > 0)
      ? recordingObj.captions
      : [
          { id: "c1", startTime: 0, endTime: 4, text: "Welcome to this recorded lecture session!" },
          { id: "c2", startTime: 4, endTime: 10, text: "Today we will analyze key core computer science concepts and architectural design." },
          { id: "c3", startTime: 10, endTime: 18, text: "Pay close attention to how algorithm efficiency optimizes execution speed." },
          { id: "c4", startTime: 18, endTime: 26, text: "Let us trace the step-by-step vector diagram on the interactive whiteboard." },
          { id: "c5", startTime: 26, endTime: 40, text: "Feel free to pause, rewind, or switch subtitle languages at any time!" }
        ];

    if (this.videoCaptionOverlay) this.videoCaptionOverlay.style.display = "none";
    this.currentActiveSegId = null;

    this.videoPlayer.play().catch(e => console.log("Auto-play handling:", e));
    this.logDebug("VIDEO", `Streaming recorded video with CC subtitles: ${videoUrl}`);
  }

  async updateVideoSubtitles(forceRedraw = false) {
    if (!this.videoPlayer || !this.videoCaptionOverlay || !this.ytCaptionText) return;
    const currentTime = this.videoPlayer.currentTime;

    if (!this.activeVideoCaptions || this.activeVideoCaptions.length === 0) {
      this.videoCaptionOverlay.style.display = "none";
      return;
    }

    const activeSeg = this.activeVideoCaptions.find(c => currentTime >= c.startTime && currentTime <= c.endTime);

    if (!activeSeg) {
      this.videoCaptionOverlay.style.display = "none";
      this.currentActiveSegId = null;
      return;
    }

    if (this.currentActiveSegId === activeSeg.id && !forceRedraw) {
      return;
    }

    this.currentActiveSegId = activeSeg.id;
    this.videoCaptionOverlay.style.display = "inline-block";

    const text = activeSeg.text || "";
    if (this.activeSubLang === "en") {
      this.ytCaptionText.textContent = text;
      return;
    }

    const cacheKey = `${activeSeg.id}_${this.activeSubLang}`;
    if (this.subTranslationCache.has(cacheKey)) {
      this.ytCaptionText.textContent = this.subTranslationCache.get(cacheKey);
      return;
    }

    this.ytCaptionText.textContent = text;
    try {
      const translated = await this.translateTextAsync(text, this.activeSubLang);
      this.subTranslationCache.set(cacheKey, translated);
      if (this.currentActiveSegId === activeSeg.id) {
        this.ytCaptionText.textContent = translated;
      }
    } catch(e) {
      console.log("Subtitle Translation Error:", e);
    }
  }

  async translateTextAsync(text, targetLang) {
    const dict = {
      hi: {
        "Welcome to this recorded lecture session!": "इस रिकॉर्ड किए गए व्याख्यान सत्र में आपका स्वागत है!",
        "Today we will analyze key core computer science concepts and architectural design.": "आज हम मुख्य कंप्यूटर विज्ञान अवधारणाओं और वास्तुकला डिजाइन का विश्लेषण करेंगे।",
        "Pay close attention to how algorithm efficiency optimizes execution speed.": "ध्यान दें कि कैसे एल्गोरिदम दक्षता निष्पादित गति को अनुकूलित करती है।",
        "Let us trace the step-by-step vector diagram on the interactive whiteboard.": "आइए इंटरएक्टिव व्हाइटबोर्ड पर चरण-दर-चरण वेक्टर आरेख का पता लगाएं।",
        "Feel free to pause, rewind, or switch subtitle languages at any time!": "बेझिझक किसी भी समय सबटाइटल भाषाओं को रोकें, रिवाइंड करें या बदलें!"
      },
      es: {
        "Welcome to this recorded lecture session!": "¡Bienvenido a esta sesión de conferencia grabada!",
        "Today we will analyze key core computer science concepts and architectural design.": "Hoy analizaremos conceptos clave de ciencias de la computación y diseño arquitectónico.",
        "Pay close attention to how algorithm efficiency optimizes execution speed.": "Preste mucha atención a cómo la eficiencia del algoritmo optimiza la velocidad de ejecución.",
        "Let us trace the step-by-step vector diagram on the interactive whiteboard.": "Trazemos el diagrama vectorial paso a paso en la pizarra interactiva.",
        "Feel free to pause, rewind, or switch subtitle languages at any time!": "¡No dude en pausar, rebobinar o cambiar los idiomas de los subtítulos en cualquier momento!"
      },
      fr: {
        "Welcome to this recorded lecture session!": "Bienvenue dans esta session de cours enregistrée !",
        "Today we will analyze key core computer science concepts and architectural design.": "Aujourd'hui, nous analyserons les concepts clés de l'informatique et de la conception architecturale.",
        "Pay close attention to how algorithm efficiency optimizes execution speed.": "Faites très attention à la manière dont l'efficacité de l'algorithme optimise la vitesse d'exécution.",
        "Let us trace the step-by-step vector diagram on the interactive whiteboard.": "Traçons le schéma vectoriel étape par étape sur le tableau blanc interactif.",
        "Feel free to pause, rewind, or switch subtitle languages at any time!": "N'hésitez pas à faire una pause, à rembobiner ou a changer la langue des sous-titres !"
      },
      de: {
        "Welcome to this recorded lecture session!": "Willkommen zu dieser aufgezeichneten Vorlesungssitzung!",
        "Today we will analyze key core computer science concepts and architectural design.": "Heute werden wir Schlüsselkonzepte der Informatik und Architektur analysieren.",
        "Pay close attention to how algorithm efficiency optimizes execution speed.": "Achten Sie genau darauf, wie Algorithmeneffizienz die Ausführungsgeschwindigkeit optimiert.",
        "Let us trace the step-by-step vector diagram on the interactive whiteboard.": "Lassen Sie uns das Vektordiagramm Schritt für Schritt auf dem Whiteboard verfolgen.",
        "Feel free to pause, rewind, or switch subtitle languages at any time!": "Fühlen Sie sich frei, die Untertitelsprachen jederzeit zu pausieren oder zu wechseln!"
      },
      ja: {
        "Welcome to this recorded lecture session!": "この録音された講義セッションへようこそ！",
        "Today we will analyze key core computer science concepts and architectural design.": "本日は、コンピュータサイエンスのコアコンセプトと設計を分析します。",
        "Pay close attention to how algorithm efficiency optimizes execution speed.": "アルゴリズムの効率が実行速度をどのように最適化するかに注目してください。",
        "Let us trace the step-by-step vector diagram on the interactive whiteboard.": "ホワイトボードでステップバイステップのベクトル図を追跡してみましょう。",
        "Feel free to pause, rewind, or switch subtitle languages at any time!": "いつでも字幕言語を一時停止、巻き戻し、または切り替えることができます。"
      }
    };

    if (dict[targetLang] && dict[targetLang][text]) {
      return dict[targetLang][text];
    }

    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch(e) {}

    return text;
  }

  async handleAIDoubtSubmit() {
    if (!this.aiChatInput || !this.aiChatFeed) return;
    const query = this.aiChatInput.value.trim();
    if (!query) return;

    this.aiChatInput.value = "";

    // 1. Render User Message Bubble
    const userBubble = document.createElement("div");
    userBubble.style.cssText = "align-self: flex-end; background: #0284c7; color: #fff; padding: 8px 12px; border-radius: 12px 12px 2px 12px; max-width: 85%; word-break: break-word;";
    userBubble.innerHTML = `💬 ${query}`;
    this.aiChatFeed.appendChild(userBubble);
    this.aiChatFeed.scrollTop = this.aiChatFeed.scrollHeight;

    // 2. Render AI Loading Bubble
    const aiBubble = document.createElement("div");
    aiBubble.style.cssText = "align-self: flex-start; background: rgba(255,255,255,0.06); border: 1px solid rgba(56,189,248,0.25); color: #f8fafc; padding: 8px 12px; border-radius: 12px 12px 12px 2px; max-width: 88%; word-break: break-word;";
    aiBubble.innerHTML = `🤖 <em>Analyzing doubt in selected subtitle language...</em>`;
    this.aiChatFeed.appendChild(aiBubble);
    this.aiChatFeed.scrollTop = this.aiChatFeed.scrollHeight;

    // 3. Extract Video Context (timestamp & active caption)
    const currentTime = this.videoPlayer ? this.videoPlayer.currentTime : 0;
    const activeCaptionObj = (this.activeVideoCaptions || []).find(c => currentTime >= c.startTime && currentTime <= c.endTime);
    const captionText = activeCaptionObj ? activeCaptionObj.text : "General Lecture Context";
    const timeStr = this.formatTime(currentTime);

    // 4. Extract active target language directly from dropdown
    const targetLang = this.playerLangSelect ? this.playerLangSelect.value : (this.activeSubLang || "en");

    // 5. Generate AI Response matched to the active CC Subtitle Language
    const answer = await this.generateAIDoubtResponse(query, captionText, timeStr, targetLang);

    // 6. Update AI Bubble
    aiBubble.innerHTML = `🤖 <strong>AI Tutor [${timeStr}]</strong>:<br/>${answer}`;
    this.aiChatFeed.scrollTop = this.aiChatFeed.scrollHeight;
  }

  async generateAIDoubtResponse(query, captionText, timeStr, targetLang) {
    const q = (query || "").toLowerCase();

    // 1. Direct Multi-Lingual Engine for Hindi (हिंदी)
    if (targetLang === "hi" || /hi|hindi/i.test(targetLang)) {
      if (/recurs|recusrion/i.test(q)) {
        return `रिकर्शन (Recursion) एक ऐसी प्रोग्रामिंग तकनीक है जहाँ एक फ़ंक्शन किसी बड़ी समस्या को छोटे भागों में विभाजित करके खुद को ही बार-बार कॉल (Call) करता है।\n\nमुख्य भाग:\n1. बेस केस (Base Case): रुकने की शर्त जो निष्पादन को रोकती है।\n2. रिकर्सिव स्टेप (Recursive Step): बेस केस की तरफ बढ़ने वाली सेल्फ-कॉल।\n\nउदाहरण: जैसे रूसी घोंसले वाली गुड़िया (Matryoshka Dolls) को तब तक खोलना जब तक सबसे छोटी गुड़िया न मिल जाए।`;
      }
      if (/base case|stop condition/i.test(q)) {
        return `बेस केस (Base Case) रिकर्शन में एक अनिवार्य शर्त होती है जो आगे की सेल्फ-कॉल्स को रोकती है। बिना बेस केस के, रिकर्शन अनिश्चित काल तक चलता रहता है जिससे स्टैक ओवरफ़्लो (Stack Overflow Error) हो जाता है।`;
      }
      if (/binary search|bst|tree/i.test(q)) {
        return `बाइनरी सर्च ट्री (BST) एक नोड-आधारित संरचना है जहाँ बाएँ चाइल्ड में छोटे मान और दाएँ चाइल्ड में बड़े मान होते हैं, जिससे O(log N) गति से तेज़ी से सर्च होता है।`;
      }
      if (/stack overflow/i.test(q)) {
        return `स्टैक ओवरफ़्लो (Stack Overflow) तब होता है जब कॉल स्टैक मेमोरी सीमा पार हो जाती है, जो आमतौर पर बिना बेस केस के असीमित रिकर्शन के कारण होता है।`;
      }
      if (/time complexity|big o/i.test(q)) {
        return `टाइम कॉम्प्लेक्सिटी (Time Complexity) इनपुट साइज़ N के सापेक्ष एल्गोरिदम निष्पादन गति को मापती है (जैसे O(1), O(log N), O(N), O(N^2))।`;
      }
      if (/kaise|how|step|work/i.test(q)) {
        return `टाइमस्टैम्प ${timeStr} पर, प्रोफेसर चरण-दर-चरण बताते हैं कि लॉजिक कैसे काम करता है: एल्गोरिदम वर्तमान स्थिति का मूल्यांकन करता है, सीमा शर्तों की जांच करता है, और निष्पादन को सुचारू रूप से चलाने के लिए मेमोरी संदर्भों को अपडेट करता है।`;
      }
      if (/kyun|why|reason/i.test(q)) {
        return `टाइमस्टैम्प ${timeStr} पर, स्टैक ओवरफ़्लो त्रुटियों और अनंत निष्पादन लूप को रोकने के लिए यह कदम आवश्यक है। इस शर्त की जांच करना उचित फ़ंक्शन समाप्ति की गारंटी देता है।`;
      }
      return `टाइमस्टैम्प ${timeStr} पर आपके प्रश्न ("${captionText}") के संबंध में: यह अवधारणा सिस्टम विश्वसनीयता, एल्गोरिदम अनुकूलन और रनटाइम के दौरान अनुमानित स्थिति परिवर्तन सुनिश्चित करती है।`;
    }

    // 2. Direct Multi-Lingual Engine for Spanish (Español)
    if (targetLang === "es") {
      if (/recurs|recusrion/i.test(q)) {
        return `La recursión es una técnica de programación en la que una función se llama a sí misma para resolver un problema complejo dividiéndolo en subproblemas más pequeños.\n\nComponentes principales:\n1. Caso Base: Condición de parada obligatoria.\n2. Paso Recursivo: Llamada a sí misma hacia el caso base.`;
      }
      if (/base case/i.test(q)) {
        return `El Caso Base es la condición obligatoria en recursión que detiene las llamadas sucesivas para evitar un desbordamiento de pila (Stack Overflow).`;
      }
    }

    // 3. Direct Multi-Lingual Engine for French (Français)
    if (targetLang === "fr") {
      if (/recurs|recusrion/i.test(q)) {
        return `La récursion est une technique de programmation dans laquelle une fonction s'appelle elle-même pour résoudre un problème complexe en le divisant en sous-problèmes plus petits.`;
      }
    }

    // 4. API / English Base Engine
    let rawEnglishExplanation = "";
    if (/recurs|recusrion/i.test(q)) {
      rawEnglishExplanation = `Recursion is a programming technique where a function calls itself to solve a complex problem by breaking it into smaller sub-problems. It requires: (1) Base Case (stop condition) and (2) Recursive Step (moving toward base case). Analogy: Like Russian nesting dolls until you reach the smallest doll.`;
    } else if (/base case|stop condition/i.test(q)) {
      rawEnglishExplanation = `A Base Case is the mandatory condition in recursion that stops further self-calls, preventing infinite loops and Stack Overflow errors.`;
    } else if (/binary search|bst|tree/i.test(q)) {
      rawEnglishExplanation = `A Binary Search Tree (BST) is a node-based structure where left children contain smaller values and right children contain larger values, enabling fast O(log N) operations.`;
    } else if (/stack overflow/i.test(q)) {
      rawEnglishExplanation = `Stack Overflow occurs when execution call stack memory limit is exceeded, typically due to infinite recursion without a base case.`;
    } else if (/time complexity|big o/i.test(q)) {
      rawEnglishExplanation = `Time Complexity measures algorithm execution efficiency relative to input size N (e.g. O(1), O(log N), O(N), O(N^2)).`;
    } else if (/kaise|how|step|work/i.test(q)) {
      rawEnglishExplanation = `At timestamp ${timeStr}, the professor explains step-by-step how the logic works: The algorithm evaluates current state, checks boundary conditions, and updates memory references to ensure execution runs smoothly.`;
    } else if (/kyun|why|reason/i.test(q)) {
      rawEnglishExplanation = `At timestamp ${timeStr}, this step is essential to prevent stack overflow errors and infinite execution loops. Checking this condition guarantees proper function termination and optimal performance.`;
    } else {
      rawEnglishExplanation = `Regarding your question about "${captionText}" at timestamp ${timeStr}: This concept ensures system reliability, algorithm optimization, and predictable state transitions during runtime.`;
    }

    if (targetLang === "en") return rawEnglishExplanation;
    try {
      return await this.translateTextAsync(rawEnglishExplanation, targetLang);
    } catch(e) {
      return rawEnglishExplanation;
    }
  }

  logDebug(tag, msg) {
    const line = document.createElement("div");
    line.className = "debug-log-line";
    line.textContent = `[${new Date().toLocaleTimeString()}] [${tag}] ${msg}`;
    this.debugConsole.appendChild(line);
    this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
  }
}

// Initialize Application when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new SmartClassroomStudentApp();
});
