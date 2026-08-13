/**
 * 👨‍🏫 Teacher Live Control Panel & Whiteboard Script
 * Handles:
 * 1. Studio 16kHz PCM AudioWorklet/ScriptProcessor Streaming to Deepgram Nova-2 ASR (99%+ Accuracy, < 150ms latency)
 * 2. Browser Web Speech API as fallback engine
 * 3. Vector pointer stroke tracking and instant WebSocket broadcasting
 */

class TeacherControlPanel {
  constructor() {
    window.teacherApp = this;
    this.sessionId = "cs101-recursion";
    this.ws = null;
    
    // Web Speech State
    this.isRecording = false;
    this.recognition = null;
    this.selectedMicLang = "en-IN";
    this.activeSegmentId = null;

    // PCM Audio Streaming State (Deepgram Nova-2 Engine)
    this.isPCMRecording = false;
    this.audioCtx = null;
    this.mediaStream = null;
    this.audioProcessor = null;

    // Infinite Whiteboard & Viewport Pan/Zoom State
    this.currentTool = "draw"; // "draw" or "pan"
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.strokes = [];

    // Drawing State
    this.isDrawing = false;
    this.currentPoints = [];
    this.currentColor = "#38bdf8";
    this.currentSize = 4;

    // DOM Elements
    this.statusEl = document.getElementById("ws-status");
    this.canvas = document.getElementById("teacher-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.colorPicker = document.getElementById("color-picker");
    this.sizePicker = document.getElementById("size-picker");
    this.clearBtn = document.getElementById("clear-btn");
    this.micBtn = document.getElementById("mic-toggle-btn");
    this.pcmBtn = document.getElementById("pcm-toggle-btn");
    this.micLangSelect = document.getElementById("mic-lang-select");
    this.captionInput = document.getElementById("caption-input");
    this.sendCaptionBtn = document.getElementById("send-caption-btn");
    this.logBox = document.getElementById("log-box");
    this.recordBtn = document.getElementById("record-toggle-btn");
    this.recordIndicator = document.getElementById("recording-indicator");

    // Infinite Whiteboard Tool & Zoom Buttons
    this.drawToolBtn = document.getElementById("tool-draw-btn");
    this.panToolBtn = document.getElementById("tool-pan-btn");
    this.resetViewBtn = document.getElementById("reset-view-btn");
    this.zoomInBtn = document.getElementById("zoom-in-btn");
    this.zoomOutBtn = document.getElementById("zoom-out-btn");
    this.zoomResetBtn = document.getElementById("zoom-reset-btn");
    this.zoomBadge = document.getElementById("zoom-badge");
    this.panCoordsBadge = document.getElementById("pan-coords-badge");

    // Subject Management DOM Elements
    this.subjectSelect = document.getElementById("subject-select");
    this.newSubjectContainer = document.getElementById("new-subject-container");
    this.newSubjectInput = document.getElementById("new-subject-input");
    this.createSubjectBtn = document.getElementById("create-subject-btn");

    // Live Student Doubts DOM Elements & State
    this.doubtsBtn = document.getElementById("teacher-doubts-btn");
    this.doubtBadge = document.getElementById("doubt-badge");
    this.doubtsModal = document.getElementById("teacher-doubts-modal");
    this.closeDoubtsModalBtn = document.getElementById("close-teacher-doubts-modal-btn");
    this.doubtsList = document.getElementById("teacher-doubts-list");
    this.doubts = [];

    this.setupCanvas();
    this.bindEvents();
    this.initSpeechRecognition();
    this.loadSubjects();
    this.connectWebSocket();
  }

  setupCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 800;
    this.canvas.height = rect.height || 450;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.redrawCanvas();
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const scaleX = 1920 / (this.canvas.width || 1);
    const scaleY = 1080 / (this.canvas.height || 1);
    return {
      x: ((canvasX - this.panX) / this.zoom) * scaleX,
      y: ((canvasY - this.panY) / this.zoom) * scaleY
    };
  }

  worldToScreen(worldX, worldY) {
    const scaleX = (this.canvas.width || 1) / 1920;
    const scaleY = (this.canvas.height || 1) / 1080;
    return {
      x: (worldX * scaleX) * this.zoom + this.panX,
      y: (worldY * scaleY) * this.zoom + this.panY
    };
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

    this.redrawCanvas();
  }

  renderGridBackground() {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    this.ctx.lineWidth = 1;
    const step = 40 * this.zoom;
    const offsetX = (this.panX % step + step) % step;
    const offsetY = (this.panY % step + step) % step;

    for (let x = offsetX; x < this.canvas.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = offsetY; y < this.canvas.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  redrawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderGridBackground();

    // Redraw all historical strokes in world space with zoom scale
    this.strokes.forEach(stroke => this.drawSingleWorldStroke(stroke));

    if (this.panCoordsBadge) {
      this.panCoordsBadge.textContent = `Pan: (${Math.round(this.panX)}, ${Math.round(this.panY)})`;
    }
    if (this.zoomBadge) {
      this.zoomBadge.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  drawSingleWorldStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color || "#38bdf8";
    this.ctx.lineWidth = (stroke.size || 4) * this.zoom;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    stroke.points.forEach((pt, idx) => {
      const screenPt = this.worldToScreen(pt.x, pt.y);
      if (idx === 0) this.ctx.moveTo(screenPt.x, screenPt.y);
      else this.ctx.lineTo(screenPt.x, screenPt.y);
    });
    this.ctx.stroke();
  }

  bindEvents() {
    window.addEventListener("resize", () => this.setupCanvas());

    // Mouse Wheel Zooming at Cursor Position
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    // Zoom Buttons
    if (this.zoomInBtn) {
      this.zoomInBtn.addEventListener("click", () => {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(rect.left + this.canvas.width / 2, rect.top + this.canvas.height / 2, 1.25);
      });
    }

    if (this.zoomOutBtn) {
      this.zoomOutBtn.addEventListener("click", () => {
        const rect = this.canvas.getBoundingClientRect();
        this.zoomAt(rect.left + this.canvas.width / 2, rect.top + this.canvas.height / 2, 0.8);
      });
    }

    if (this.zoomResetBtn) {
      this.zoomResetBtn.addEventListener("click", () => {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.redrawCanvas();
        this.log("🎯 Zoom reset to 100% (1.0x).");
      });
    }

    // Tool Switchers
    if (this.drawToolBtn) {
      this.drawToolBtn.addEventListener("click", () => {
        this.currentTool = "draw";
        this.drawToolBtn.classList.add("active");
        this.drawToolBtn.style.background = "#38bdf8";
        this.drawToolBtn.style.color = "#000";
        if (this.panToolBtn) {
          this.panToolBtn.classList.remove("active");
          this.panToolBtn.style.background = "#1e293b";
          this.panToolBtn.style.color = "#fff";
        }
        this.canvas.style.cursor = "crosshair";
      });
    }

    if (this.panToolBtn) {
      this.panToolBtn.addEventListener("click", () => {
        this.currentTool = "pan";
        this.panToolBtn.classList.add("active");
        this.panToolBtn.style.background = "#38bdf8";
        this.panToolBtn.style.color = "#000";
        if (this.drawToolBtn) {
          this.drawToolBtn.classList.remove("active");
          this.drawToolBtn.style.background = "#1e293b";
          this.drawToolBtn.style.color = "#fff";
        }
        this.canvas.style.cursor = "grab";
      });
    }

    if (this.resetViewBtn) {
      this.resetViewBtn.addEventListener("click", () => {
        this.panX = 0;
        this.panY = 0;
        this.redrawCanvas();
        this.log("🎯 Whiteboard viewport reset to (0,0).");
      });
    }

    this.colorPicker.addEventListener("change", (e) => this.currentColor = e.target.value);
    this.sizePicker.addEventListener("change", (e) => this.currentSize = parseInt(e.target.value));

    this.clearBtn.addEventListener("click", () => {
      this.strokes = [];
      this.redrawCanvas();
      this.broadcastMessage({ type: "clear_canvas", sessionId: this.sessionId });
      this.log("Canvas cleared and synced.");
    });

    this.micLangSelect.addEventListener("change", (e) => {
      this.selectedMicLang = e.target.value;
      if (this.recognition) this.recognition.lang = this.selectedMicLang;
    });

    // Pointer Events for Whiteboard Drawing
    this.canvas.addEventListener("pointerdown", (e) => this.startStroke(e));
    this.canvas.addEventListener("pointermove", (e) => this.drawStroke(e));
    this.canvas.addEventListener("pointerup", () => this.endStroke());
    this.canvas.addEventListener("pointerleave", () => this.endStroke());

    // Speech Stream Engine Buttons
    this.pcmBtn.addEventListener("click", () => this.togglePCMStream());
    this.micBtn.addEventListener("click", () => this.toggleMicStream());
    this.sendCaptionBtn.addEventListener("click", () => this.sendManualCaption());

    // Client-Side Lecture Screen & Audio Recording Button
    if (this.recordBtn) {
      this.recordBtn.addEventListener("click", () => this.toggleLectureRecording());
    }

    // Subject Class Selection & Creation Events
    if (this.subjectSelect) {
      this.subjectSelect.addEventListener("change", (e) => {
        if (e.target.value === "__new__") {
          if (this.newSubjectContainer) this.newSubjectContainer.style.display = "flex";
        } else {
          if (this.newSubjectContainer) this.newSubjectContainer.style.display = "none";
          this.sessionId = e.target.value;
        }
      });
    }

    if (this.createSubjectBtn) {
      this.createSubjectBtn.addEventListener("click", () => this.createNewSubjectClass());
    }

    // Live Student Doubts Modal Listeners
    if (this.doubtsBtn) {
      this.doubtsBtn.addEventListener("click", () => {
        if (this.doubtsModal) this.doubtsModal.style.display = "flex";
      });
    }

    if (this.closeDoubtsModalBtn && this.doubtsModal) {
      this.closeDoubtsModalBtn.addEventListener("click", () => {
        this.doubtsModal.style.display = "none";
      });
    }

    if (this.doubtsModal) {
      this.doubtsModal.addEventListener("click", (e) => {
        if (e.target === this.doubtsModal) this.doubtsModal.style.display = "none";
      });
    }
  }

  async loadSubjects() {
    if (!this.subjectSelect) return;
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      if (data.success && data.subjects && data.subjects.length > 0) {
        this.subjectSelect.innerHTML = "";
        data.subjects.forEach(sub => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.name;
          this.subjectSelect.appendChild(opt);
        });
        const newOpt = document.createElement("option");
        newOpt.value = "__new__";
        newOpt.textContent = "➕ Create New Subject Class...";
        this.subjectSelect.appendChild(newOpt);

        if (this.subjectSelect.options.length > 1) {
          this.sessionId = this.subjectSelect.value;
        }
      }
    } catch(e) {
      console.log("Failed to load subjects:", e);
    }
  }

  async createNewSubjectClass() {
    const name = this.newSubjectInput?.value?.trim();
    if (!name) return alert("Please enter a subject class name.");

    try {
      const res = await fetch('/api/create-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, instructor: "Prof. A. Sharma" })
      });
      const data = await res.json();
      if (data.success) {
        if (this.newSubjectInput) this.newSubjectInput.value = "";
        if (this.newSubjectContainer) this.newSubjectContainer.style.display = "none";
        await this.loadSubjects();
        if (this.subjectSelect && data.subject) {
          this.subjectSelect.value = data.subject.id;
          this.sessionId = data.subject.id;
        }
        this.log(`📚 Created new subject class: "${data.subject.name}"`);
      } else {
        alert(data.message);
      }
    } catch(err) {
      alert("Error creating subject: " + err.message);
    }
  }

  // =========================================================================
  // Studio 16kHz PCM Binary Audio Streamer (Deepgram Nova-2 - 99% Accuracy)
  // =========================================================================
  async togglePCMStream() {
    if (this.isPCMRecording) {
      this.stopPCMStream();
    } else {
      if (this.isRecording) this.toggleMicStream(); // Turn off WebSpeech fallback if running
      await this.startPCMStream();
    }
  }

  async startPCMStream() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });

      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.audioProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.audioProcessor.onaudioprocess = (e) => {
        if (!this.isPCMRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to 16-bit Mono Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send raw binary PCM audio buffer over WebSocket
        this.ws.send(pcmData.buffer);
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioCtx.destination);

      this.isPCMRecording = true;
      this.pcmBtn.innerHTML = "🎙️ Stop Studio PCM AI Stream";
      this.pcmBtn.classList.add("recording");
      this.log("🚀 Studio PCM Audio Stream active! Streaming 16kHz audio to Deepgram Nova-2 (99%+ accuracy)...");

    } catch (err) {
      this.log(`PCM Audio Stream Error: ${err.message}`);
      alert(`Microphone permission or Web Audio error: ${err.message}`);
    }
  }

  stopPCMStream() {
    this.isPCMRecording = false;
    if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
    if (this.audioCtx) this.audioCtx.close();
    this.pcmBtn.innerHTML = "🎙️ Studio PCM AI Stream (99% Deepgram Nova-2)";
    this.pcmBtn.classList.remove("recording");
    this.log("Studio PCM Audio Stream stopped.");
  }

  // =========================================================================
  // Infinite Vector Stroke Broadcaster & Pan Handler
  // =========================================================================
  startStroke(e) {
    if (this.currentTool === "pan" || e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.canvas.style.cursor = "grabbing";
      return;
    }

    this.isDrawing = true;
    const worldPt = this.screenToWorld(e.clientX, e.clientY);
    this.currentPoints = [worldPt];
  }

  drawStroke(e) {
    if (this.isPanning) {
      this.panX = e.clientX - this.panStart.x;
      this.panY = e.clientY - this.panStart.y;
      this.redrawCanvas();
      return;
    }

    if (!this.isDrawing) return;
    const worldPt = this.screenToWorld(e.clientX, e.clientY);
    this.currentPoints.push(worldPt);

    const prevWorld = this.currentPoints[this.currentPoints.length - 2];
    const prevScreen = this.worldToScreen(prevWorld.x, prevWorld.y);
    const currScreen = this.worldToScreen(worldPt.x, worldPt.y);

    this.ctx.beginPath();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.moveTo(prevScreen.x, prevScreen.y);
    this.ctx.lineTo(currScreen.x, currScreen.y);
    this.ctx.stroke();
  }

  endStroke() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.currentTool === "pan" ? "grab" : "crosshair";
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentPoints.length >= 2) {
      const strokeObj = {
        id: `strk-${Date.now()}`,
        color: this.currentColor,
        size: this.currentSize,
        points: this.currentPoints // World space points
      };

      this.strokes.push(strokeObj);

      this.broadcastMessage({
        type: "stroke",
        sessionId: this.sessionId,
        stroke: strokeObj
      });
    }
    this.currentPoints = [];
  }

  // =========================================================================
  // Web Speech API Continuous Capture (Fallback Engine)
  // =========================================================================
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.selectedMicLang;

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.micBtn.innerHTML = "🎙️ Stop WebSpeech Stream";
      this.micBtn.classList.add("recording");
      this.log(`WebSpeech stream active [Lang: ${this.selectedMicLang}]`);
    };

    this.recognition.onresult = (event) => {
      if (!this.activeSegmentId) this.activeSegmentId = `seg-${Date.now()}`;
      const now = Date.now();

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.trim();
        const isFinal = event.results[i].isFinal;
        if (!transcript) continue;

        const payload = {
          type: isFinal ? "final_caption" : "partial_caption",
          sessionId: this.sessionId,
          segmentId: this.activeSegmentId,
          timestamp: now,
          status: isFinal ? "final" : "partial",
          sourceText: transcript
        };

        this.broadcastMessage(payload);
        this.log(`[${isFinal ? 'FINAL' : 'PARTIAL'}] ${transcript}`);

        if (isFinal) this.activeSegmentId = `seg-${Date.now()}`;
      }
    };

    this.recognition.onerror = (err) => {
      if (err.error !== "no-speech") this.log(`WebSpeech Warning: ${err.error}`);
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        try { this.recognition.start(); } catch(e){}
      }
    };
  }

  toggleMicStream() {
    if (!this.recognition) return alert("Web Speech API not supported.");
    if (this.isPCMRecording) this.stopPCMStream();

    if (this.isRecording) {
      this.isRecording = false;
      this.recognition.stop();
      this.micBtn.innerHTML = "🌐 Web Speech API (Browser Fallback)";
      this.micBtn.classList.remove("recording");
    } else {
      this.recognition.lang = this.selectedMicLang;
      this.recognition.start();
    }
  }

  sendManualCaption() {
    const text = this.captionInput.value.trim();
    if (!text) return;

    const segmentId = `seg-${Date.now()}`;
    const now = Date.now();
    
    this.broadcastMessage({
      type: "partial_caption",
      sessionId: this.sessionId,
      segmentId: segmentId,
      timestamp: now,
      status: "partial",
      sourceText: text
    });

    setTimeout(() => {
      this.broadcastMessage({
        type: "final_caption",
        sessionId: this.sessionId,
        segmentId: segmentId,
        timestamp: Date.now(),
        status: "final",
        sourceText: text
      });
    }, 50);

    this.log(`[MANUAL BROADCAST] ${text}`);
    this.captionInput.value = "";
  }

  getWebSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.hostname}:5000`
      : window.location.host;
    return `${protocol}//${host}?role=teacher&sessionId=${this.sessionId}`;
  }

  connectWebSocket() {
    const url = this.getWebSocketUrl();
    this.log(`Connecting to WebSocket: ${url}`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.statusEl.textContent = "📡 LIVE BROADCASTING";
      this.statusEl.style.color = "#10b981";
      this.log("WebSocket connected. Teacher ready to stream.");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "student_live_doubt") {
          this.addStudentDoubt(data);
        } else if (data.type === "teacher_resolve_doubt") {
          const doubt = this.doubts.find(d => d.id === data.doubtId);
          if (doubt) doubt.status = "resolved";
          this.updateDoubtsUI();
        } else if (data.type === "teacher_flag_doubt") {
          const doubt = this.doubts.find(d => d.id === data.doubtId);
          if (doubt) doubt.status = "flagged";
          this.updateDoubtsUI();
        }
      } catch(e) {}
    };

    this.ws.onclose = () => {
      this.statusEl.textContent = "⚠️ DISCONNECTED";
      this.statusEl.style.color = "#f43f5e";
      this.log("WebSocket disconnected. Retrying in 3s...");
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  addStudentDoubt(data) {
    if (!data) return;
    const existing = this.doubts.find(d => d.id === data.id);
    if (!existing) {
      this.doubts.unshift(data);
    }
    this.updateDoubtsUI();
    this.playNotificationBeep();
    this.log(`🔔 NEW LIVE DOUBT from ${data.studentName} (${data.studentRoll}): "${data.doubtText}"`);
  }

  updateDoubtsUI() {
    if (!this.doubtsList) return;
    const unread = this.doubts.filter(d => d.status === "unread");
    
    if (this.doubtBadge) {
      if (unread.length > 0) {
        this.doubtBadge.textContent = unread.length;
        this.doubtBadge.style.display = "flex";
      } else {
        this.doubtBadge.style.display = "none";
      }
    }

    if (this.doubts.length === 0) {
      this.doubtsList.innerHTML = `
        <div style="text-align: center; color: #94a3b8; padding: 30px; font-size: 0.88rem;">
          🔔 No unread student doubts right now!
        </div>
      `;
      return;
    }

    this.doubtsList.innerHTML = this.doubts.map(d => {
      const isResolved = d.status === "resolved";
      const isFlagged = d.status === "flagged";
      const timeStr = new Date(d.timestamp || Date.now()).toLocaleTimeString();
      return `
        <div style="background: ${isFlagged ? 'rgba(244,63,94,0.1)' : (isResolved ? 'rgba(255,255,255,0.02)' : 'rgba(245,158,11,0.08)')}; border: 1px solid ${isFlagged ? 'rgba(244,63,94,0.4)' : (isResolved ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.3)')}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem;">${isFlagged ? '🚩' : '🕵️'}</span>
              <strong style="color: ${isFlagged ? '#f43f5e' : '#f59e0b'}; font-size: 0.9rem;">${isFlagged ? 'Flagged Inappropriate Doubt' : 'Anonymous Student'}</strong>
              <span style="color: #94a3b8; font-size: 0.72rem; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px;">Private Student Doubt</span>
            </div>
            <span style="font-size: 0.72rem; color: #94a3b8;">${timeStr}</span>
          </div>

          <div style="color: ${isFlagged ? '#f43f5e' : (isResolved ? '#94a3b8' : '#f8fafc')}; font-size: 0.85rem; line-height: 1.4; word-break: break-word; text-decoration: ${(isResolved || isFlagged) ? 'line-through' : 'none'};">
            💬 "${d.doubtText}"
          </div>

          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 6px;">
            ${isFlagged ? `
              <span style="font-size: 0.78rem; color: #f43f5e; font-weight: 800; background: rgba(244,63,94,0.2); border: 1px solid rgba(244,63,94,0.4); padding: 4px 10px; border-radius: 6px;">🚩 Flagged & Reported</span>
            ` : (isResolved ? `
              <span style="font-size: 0.78rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); padding: 4px 10px; border-radius: 6px;">✓ Resolved</span>
            ` : `
              <button onclick="window.teacherApp.resolveDoubt('${d.id}')" style="padding: 6px 14px; background: linear-gradient(135deg, #10b981, #059669); color: #000; font-weight: 800; border: none; border-radius: 8px; font-size: 0.78rem; cursor: pointer; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">✓ Mark Resolved</button>
              <button onclick="window.teacherApp.flagDoubt('${d.id}')" style="padding: 6px 14px; background: linear-gradient(135deg, #ef4444, #f43f5e); color: #fff; font-weight: 800; border: none; border-radius: 8px; font-size: 0.78rem; cursor: pointer; box-shadow: 0 2px 8px rgba(244,63,94,0.4);" title="Report inappropriate or spam question">🚩 Flag / Report</button>
            `)}
          </div>
        </div>
      `;
    }).join("");
  }

  resolveDoubt(doubtId) {
    const doubt = this.doubts.find(d => d.id === doubtId);
    if (doubt) {
      doubt.status = "resolved";
    }
    this.updateDoubtsUI();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "teacher_resolve_doubt",
        sessionId: this.sessionId,
        doubtId: doubtId
      }));
    }
  }

  flagDoubt(doubtId) {
    const doubt = this.doubts.find(d => d.id === doubtId);
    if (doubt) {
      doubt.status = "flagged";
    }
    this.updateDoubtsUI();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "teacher_flag_doubt",
        sessionId: this.sessionId,
        doubtId: doubtId
      }));
    }
    this.log(`🚩 DOUBT FLAGGED & REPORTED: Doubt [${doubtId}] marked inappropriate by Teacher.`);
  }

  playNotificationBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch(e) {}
  }

  broadcastMessage(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // =========================================================================
  // Client-Side Lecture Screen & Audio Recording Engine (MediaRecorder API)
  // =========================================================================
  async toggleLectureRecording() {
    if (this.isScreenRecording) {
      this.stopLectureRecording();
    } else {
      await this.startLectureRecording();
    }
  }

  async startLectureRecording() {
    try {
      this.log("🎥 Requesting screen and audio capture permission...");

      // 1. Capture screen video and system audio via getDisplayMedia
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { max: 30 }
        },
        audio: true
      });

      // 2. Capture microphone audio via getUserMedia if available
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      } catch (micErr) {
        this.log("Mic audio capture notice: " + micErr.message);
      }

      // 3. Web Audio API Audio Mixer: Mix System/Tab Audio + Mic Audio into 1 single Audio Track
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioDestination = audioCtx.createMediaStreamDestination();
      let hasAudioTrack = false;

      // Mix Tab / System Audio if user shared tab/system audio
      if (displayStream.getAudioTracks().length > 0) {
        const displaySource = audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
        displaySource.connect(audioDestination);
        hasAudioTrack = true;
      }

      // Mix Microphone Audio
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
        micSource.connect(audioDestination);
        hasAudioTrack = true;
      } else if (this.mediaStream && this.mediaStream.getAudioTracks().length > 0) {
        const existingMicSource = audioCtx.createMediaStreamSource(new MediaStream([this.mediaStream.getAudioTracks()[0]]));
        existingMicSource.connect(audioDestination);
        hasAudioTrack = true;
      }

      // Combine screen video track with mixed audio track
      const tracks = [...displayStream.getVideoTracks()];
      if (hasAudioTrack && audioDestination.stream.getAudioTracks().length > 0) {
        tracks.push(audioDestination.stream.getAudioTracks()[0]);
      }

      this.recordingAudioCtx = audioCtx;
      this.recordingStream = new MediaStream(tracks);

      // Handle user stopping screen share from browser floating toolbar
      displayStream.getVideoTracks()[0].onended = () => {
        this.log("Screen share stopped by user via browser control.");
        this.stopLectureRecording();
      };

      // 3. MediaRecorder Initialization with mimeType selection
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.recordingStream, { mimeType });
      this.recordedChunks = [];

      // 4. Chunk Management
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // 5. Save & Download on Stop
      this.mediaRecorder.onstop = () => {
        this.saveAndDownloadRecording();
        this.cleanUpRecordingTracks();
      };

      this.mediaRecorder.start(1000); // Collect 1-second chunks
      this.isScreenRecording = true;

      // Update UI
      if (this.recordBtn) {
        this.recordBtn.innerHTML = "⏹️ Stop Recording";
        this.recordBtn.classList.add("recording");
      }
      if (this.recordIndicator) {
        this.recordIndicator.style.display = "flex";
      }

      this.log(`🔴 Client-side lecture recording started! [Codec: ${mimeType}]`);

    } catch (err) {
      this.log(`Recording Error: ${err.message}`);
      if (err.name !== 'NotAllowedError') {
        alert(`Could not start screen recording: ${err.message}`);
      }
      this.cleanUpRecordingTracks();
    }
  }

  stopLectureRecording() {
    if (!this.isScreenRecording) return;
    this.isScreenRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    // Update UI
    if (this.recordBtn) {
      this.recordBtn.innerHTML = "🔴 Start Recording";
      this.recordBtn.classList.remove("recording");
    }
    if (this.recordIndicator) {
      this.recordIndicator.style.display = "none";
    }

    this.log("⏹️ Lecture recording stopped. Preparing file download...");
  }

  saveAndDownloadRecording() {
    if (!this.recordedChunks || this.recordedChunks.length === 0) {
      this.log("No recording data chunks to save.");
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const fileName = `Lecture_${this.sessionId}_${Date.now()}.webm`;
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    this.log(`⏳ Processing lecture video (${fileSizeMB} MB) & uploading to GitHub repository...`);

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result;

      const subId = this.subjectSelect?.value || this.sessionId || "cs101-recursion";
      const subName = (this.subjectSelect && this.subjectSelect.selectedIndex >= 0)
        ? this.subjectSelect.options[this.subjectSelect.selectedIndex].text
        : "General Class";

      try {
        const response = await fetch('/api/upload-lecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoBase64: base64data,
            filename: fileName,
            subjectId: subId,
            subjectName: subName
          })
        });

        const resData = await response.json();
        if (resData.success) {
          this.log(`✅ Lecture video saved via ${resData.uploadMethod}!`);
          this.log(`🔗 Video URL: ${resData.videoUrl}`);
          alert(`🎉 Lecture Recording Uploaded Successfully!\n\nStorage: ${resData.uploadMethod}\nURL: ${resData.videoUrl}`);
        } else {
          this.log(`❌ Upload Error: ${resData.message}`);
          alert(`Upload error: ${resData.message}`);
        }
      } catch (err) {
        this.log(`❌ Upload Exception: ${err.message}`);
      }

      this.recordedChunks = [];
    };
  }

  cleanUpRecordingTracks() {
    if (this.recordingAudioCtx) {
      try { this.recordingAudioCtx.close(); } catch(e){}
      this.recordingAudioCtx = null;
    }
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
  }

  log(msg) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logBox.appendChild(entry);
    this.logBox.scrollHeight > 0 && (this.logBox.scrollTop = this.logBox.scrollHeight);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.teacherApp = new TeacherControlPanel();
});
