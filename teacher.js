/**
 * 👨‍🏫 Teacher Live Control Panel & Whiteboard Script — Smart Classroom 2.0
 *
 * Features:
 *  1. Studio 16kHz PCM AudioWorklet/ScriptProcessor → Deepgram Nova-2 (99%+ ASR)
 *  2. Browser Web Speech API fallback engine
 *  3. Freehand vector stroke broadcasting (world-space coordinates)
 *  4. Vector Shape Tools: Line, Arrow, Rectangle, Circle + live ghost preview
 *  5. PDF / Image Slide Presenter with real-time slide sync to students
 *  6. Diagram Search (Wikimedia) & overlay broadcast
 */

class TeacherControlPanel {
  constructor() {
    window.teacherApp = this;
    this.sessionId = "cs101-recursion";
    this.ws = null;

    // ── Web Speech State ──────────────────────────────────────────────
    this.isRecording     = false;
    this.recognition     = null;
    this.selectedMicLang = "en-IN";
    this.activeSegmentId = null;
    this._recognitionStarting = false;   // duplicate-start guard
    this._recognitionActive   = false;   // tracks whether onstart has fired

    // ── PCM Audio Streaming (Deepgram Nova-2 / AudioWorklet) ──────────
    this.isPCMRecording  = false;
    this.audioCtx        = null;
    this.mediaStream     = null;
    this.audioProcessor  = null;  // ScriptProcessor fallback
    this.audioWorklet    = null;  // AudioWorkletNode (preferred)

    // ── Infinite Whiteboard Viewport ──────────────────────────────────
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // ── Drawing & Shape State ─────────────────────────────────────────
    this.currentTool = "draw"; // draw | eraser | line | arrow | dbl_arrow | rect | circle | triangle | pan
    this.strokes   = [];   // committed freehand strokes
    this.shapes    = [];   // committed vector shapes
    this.overlays  = [];   // image overlays (diagrams)
    this.shapePrimitives = []; // committed advanced shape_primitive objects
    this.isDrawing = false;
    this.currentPoints  = [];
    this.currentColor   = "#38bdf8";
    this.currentFillColor = "#1e3a5f";
    this.currentFillEnabled = false;
    this.currentSize    = 4;
    // Shape ghost preview
    this.shapeStart  = null; // { x, y } world coords
    this.shapeCurrent= null; // { x, y } world coords
    // Advanced shape tool (shape_primitive system)
    this.advancedTool = null; // null | { category, shapeType, dataPayload }
    this.advancedStart = null; // normalized { x, y }
    this.advancedCurrent = null;

    // ── Presentation Slides ───────────────────────────────────────────
    this.slides        = [];   // Array of base64 DataURL strings (one per page/image)
    this.currentSlide  = 0;
    this.slideImage    = null; // HTMLImageElement for current slide background

    // ── DOM Elements ─────────────────────────────────────────────────
    this.statusEl          = document.getElementById("ws-status");
    this.canvas            = document.getElementById("teacher-canvas");
    this.ctx               = this.canvas.getContext("2d");
    this.colorPicker       = document.getElementById("color-picker");
    this.sizePicker        = document.getElementById("size-picker");
    this.clearBtn          = document.getElementById("clear-btn");
    this.micBtn            = document.getElementById("mic-toggle-btn");
    this.pcmBtn            = document.getElementById("pcm-toggle-btn");
    this.micLangSelect     = document.getElementById("mic-lang-select");
    this.captionInput      = document.getElementById("caption-input");
    this.sendCaptionBtn    = document.getElementById("send-caption-btn");
    this.logBox            = document.getElementById("log-box");
    this.recordBtn         = document.getElementById("record-toggle-btn");
    this.recordIndicator   = document.getElementById("recording-indicator");

    // Zoom / Pan
    this.drawToolBtn   = document.getElementById("tool-draw-btn");
    this.panToolBtn    = document.getElementById("tool-pan-btn");
    this.resetViewBtn  = document.getElementById("reset-view-btn");
    this.zoomInBtn     = document.getElementById("zoom-in-btn");
    this.zoomOutBtn    = document.getElementById("zoom-out-btn");
    this.zoomResetBtn  = document.getElementById("zoom-reset-btn");
    this.zoomBadge     = document.getElementById("zoom-badge");
    this.panCoordsBadge= document.getElementById("pan-coords-badge");

    // Shape tool buttons
    this.lineToolBtn   = document.getElementById("tool-line-btn");
    this.arrowToolBtn  = document.getElementById("tool-arrow-btn");
    this.rectToolBtn   = document.getElementById("tool-rect-btn");
    this.circleToolBtn = document.getElementById("tool-circle-btn");

    // Presentation controls
    this.uploadDocBtn  = document.getElementById("upload-doc-btn");
    this.docFileInput  = document.getElementById("doc-file-input");
    this.slideNav      = document.getElementById("slide-nav");
    this.slidePrevBtn  = document.getElementById("slide-prev-btn");
    this.slideNextBtn  = document.getElementById("slide-next-btn");
    this.slideClearBtn = document.getElementById("slide-clear-btn");
    this.slideCounter  = document.getElementById("slide-counter");

    // Diagram search
    this.searchDiagramBtn       = document.getElementById("search-diagram-btn");
    this.diagramSearchModal     = document.getElementById("diagram-search-modal");
    this.closeDiagramModalBtn   = document.getElementById("close-diagram-modal-btn");
    this.diagramSearchInput     = document.getElementById("diagram-search-input");
    this.diagramSearchExecBtn   = document.getElementById("diagram-search-execute-btn");
    this.diagramResultsGrid     = document.getElementById("diagram-results-grid");

    // Subject management
    this.subjectSelect         = document.getElementById("subject-select");
    this.newSubjectContainer   = document.getElementById("new-subject-container");
    this.newSubjectInput       = document.getElementById("new-subject-input");
    this.createSubjectBtn      = document.getElementById("create-subject-btn");

    // Doubts
    this.doubtsBtn             = document.getElementById("teacher-doubts-btn");
    this.doubtBadge            = document.getElementById("doubt-badge");
    this.doubtsModal           = document.getElementById("teacher-doubts-modal");
    this.closeDoubtsModalBtn   = document.getElementById("close-teacher-doubts-modal-btn");
    this.doubtsList            = document.getElementById("teacher-doubts-list");
    this.doubts                = [];
    this._lastDoubtSeq         = 0;  // highest sequence number received for catch-up

    this.setupCanvas();
    this.bindEvents();
    this.initSpeechRecognition();
    this.loadSubjects();
    this.connectWebSocket();
  }

  // =========================================================================
  // Canvas Setup & Coordinate Transforms
  // =========================================================================
  setupCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width  = rect.width  || 800;
    this.canvas.height = rect.height || 450;
    this.ctx.lineCap   = "round";
    this.ctx.lineJoin  = "round";
    this.redrawCanvas();
  }

  screenToWorld(screenX, screenY) {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = 1920 / (this.canvas.width  || 1);
    const scaleY = 1080 / (this.canvas.height || 1);
    return {
      x: ((screenX - rect.left - this.panX) / this.zoom) * scaleX,
      y: ((screenY - rect.top  - this.panY) / this.zoom) * scaleY
    };
  }

  worldToScreen(worldX, worldY) {
    const scaleX = (this.canvas.width  || 1) / 1920;
    const scaleY = (this.canvas.height || 1) / 1080;
    return {
      x: (worldX * scaleX) * this.zoom + this.panX,
      y: (worldY * scaleY) * this.zoom + this.panY
    };
  }

  zoomAt(screenX, screenY, factor) {
    const rect   = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const worldPt = { x: (canvasX - this.panX) / this.zoom, y: (canvasY - this.panY) / this.zoom };
    let newZoom = Math.min(Math.max(0.25, this.zoom * factor), 4.0);
    this.panX = canvasX - worldPt.x * newZoom;
    this.panY = canvasY - worldPt.y * newZoom;
    this.zoom = newZoom;
    this.redrawCanvas();
  }

  // =========================================================================
  // Canvas Rendering
  // =========================================================================
  renderGridBackground() {
    this.ctx.strokeStyle = "rgba(255,255,255,0.04)";
    this.ctx.lineWidth   = 1;
    const step    = 40 * this.zoom;
    const offsetX = (this.panX % step + step) % step;
    const offsetY = (this.panY % step + step) % step;
    for (let x = offsetX; x < this.canvas.width;  x += step) { this.ctx.beginPath(); this.ctx.moveTo(x,0); this.ctx.lineTo(x,this.canvas.height); this.ctx.stroke(); }
    for (let y = offsetY; y < this.canvas.height; y += step) { this.ctx.beginPath(); this.ctx.moveTo(0,y); this.ctx.lineTo(this.canvas.width,y);   this.ctx.stroke(); }
  }

  redrawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Slide background image
    if (this.slideImage) {
      this.ctx.save();
      this.ctx.globalAlpha = 1;
      const iw = this.slideImage.naturalWidth  || this.canvas.width;
      const ih = this.slideImage.naturalHeight || this.canvas.height;
      const scale = Math.min(this.canvas.width / iw, this.canvas.height / ih) * this.zoom;
      const dx = this.panX + (this.canvas.width  - iw * scale) / 2;
      const dy = this.panY + (this.canvas.height - ih * scale) / 2;
      this.ctx.drawImage(this.slideImage, dx, dy, iw * scale, ih * scale);
      this.ctx.restore();
    } else {
      this.renderGridBackground();
    }

    // 2. Image overlays (diagrams)
    this.overlays.forEach(ov => this._drawOverlay(ov));

    // 3. Committed freehand strokes
    this.strokes.forEach(s => this.drawSingleWorldStroke(s));

    // 4. Committed shapes
    this.shapes.forEach(sh => this._drawShape(sh));

    // 5. Committed advanced shape primitives
    this.shapePrimitives.forEach(sp => {
      const sx = sp.bounds.startX * this.canvas.width;
      const sy = sp.bounds.startY * this.canvas.height;
      const ex = sp.bounds.endX   * this.canvas.width;
      const ey = sp.bounds.endY   * this.canvas.height;
      this._drawShapePrimitive(this.ctx, sp.shapeType, sp.category, sx, sy, ex, ey, sp.color, sp.fillColor, sp.fillEnabled, sp.lineWidth, sp.dataPayload, this.zoom);
    });

    // 6. Ghost shape preview (during drag)
    if (this.advancedTool && this.advancedStart && this.advancedCurrent) {
      this._drawGhostPrimitive();
    } else if (this.shapeStart && this.shapeCurrent && this.currentTool !== "draw" && this.currentTool !== "pan" && this.currentTool !== "eraser") {
      this._drawShapeGhost(this.currentTool, this.shapeStart, this.shapeCurrent);
    }

    // Update HUD badges
    if (this.panCoordsBadge) this.panCoordsBadge.textContent = `Pan: (${Math.round(this.panX)}, ${Math.round(this.panY)})`;
    if (this.zoomBadge)      this.zoomBadge.textContent      = `${Math.round(this.zoom * 100)}%`;
  }

  drawSingleWorldStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color || "#38bdf8";
    this.ctx.lineWidth   = (stroke.size || 4) * this.zoom;
    this.ctx.lineCap     = "round";
    this.ctx.lineJoin    = "round";
    stroke.points.forEach((pt, idx) => {
      const sp = this.worldToScreen(pt.x, pt.y);
      if (idx === 0) this.ctx.moveTo(sp.x, sp.y); else this.ctx.lineTo(sp.x, sp.y);
    });
    this.ctx.stroke();
  }

  // ── Shape rendering ──────────────────────────────────────────────────────
  _drawShape(sh) {
    const s = this.worldToScreen(sh.startPoint.x, sh.startPoint.y);
    const e = this.worldToScreen(sh.endPoint.x,   sh.endPoint.y);
    this.ctx.strokeStyle = sh.color || "#38bdf8";
    this.ctx.lineWidth   = (sh.lineWidth || 3) * this.zoom;
    this.ctx.lineCap     = "round";
    this.ctx.lineJoin    = "round";
    this.ctx.fillStyle   = sh.filled ? (sh.color || "#38bdf8") : "transparent";
    this.ctx.beginPath();
    if (sh.shapeType === "line") {
      this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(e.x, e.y); this.ctx.stroke();
    } else if (sh.shapeType === "arrow") {
      this._strokeArrow(s.x, s.y, e.x, e.y);
    } else if (sh.shapeType === "dbl_arrow") {
      this._strokeDoubleArrow(s.x, s.y, e.x, e.y);
    } else if (sh.shapeType === "rect") {
      this.ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
      if (sh.filled) this.ctx.fillRect(s.x, s.y, e.x - s.x, e.y - s.y);
    } else if (sh.shapeType === "circle") {
      const rx = Math.abs(e.x - s.x) / 2;
      const ry = Math.abs(e.y - s.y) / 2;
      const cx = s.x + (e.x - s.x) / 2;
      const cy = s.y + (e.y - s.y) / 2;
      this.ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, 2 * Math.PI);
      this.ctx.stroke();
      if (sh.filled) this.ctx.fill();
    } else if (sh.shapeType === "triangle") {
      this._strokeTriangle(s.x, s.y, e.x, e.y, sh.filled);
    }
  }

  _drawShapeGhost(tool, startW, endW) {
    const s = this.worldToScreen(startW.x, startW.y);
    const e = this.worldToScreen(endW.x,   endW.y);
    this.ctx.save();
    this.ctx.globalAlpha = 0.55;
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth   = this.currentSize * this.zoom;
    this.ctx.setLineDash([6, 4]);
    this.ctx.lineCap     = "round";
    this.ctx.lineJoin    = "round";
    this.ctx.beginPath();
    if (tool === "line") {
      this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(e.x, e.y); this.ctx.stroke();
    } else if (tool === "arrow") {
      this._strokeArrow(s.x, s.y, e.x, e.y);
    } else if (tool === "dbl_arrow") {
      this._strokeDoubleArrow(s.x, s.y, e.x, e.y);
    } else if (tool === "rect") {
      this.ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
    } else if (tool === "circle") {
      const rx = Math.abs(e.x - s.x) / 2;
      const ry = Math.abs(e.y - s.y) / 2;
      const cx = s.x + (e.x - s.x) / 2;
      const cy = s.y + (e.y - s.y) / 2;
      this.ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, 2 * Math.PI);
      this.ctx.stroke();
    } else if (tool === "triangle") {
      this._strokeTriangle(s.x, s.y, e.x, e.y, false);
    }
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  _strokeArrow(x1, y1, x2, y2) {
    const headLen = 14 * this.zoom;
    const angle   = Math.atan2(y2 - y1, x2 - x1);
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();
  }

  _strokeDoubleArrow(x1, y1, x2, y2) {
    const headLen = 14 * this.zoom;
    const angle   = Math.atan2(y2 - y1, x2 - x1);
    this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
    this.ctx.beginPath();
    // tail arrowhead
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x1 + headLen * Math.cos(angle - Math.PI / 6), y1 + headLen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x1 + headLen * Math.cos(angle + Math.PI / 6), y1 + headLen * Math.sin(angle + Math.PI / 6));
    // tip arrowhead
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();
  }

  _strokeTriangle(x1, y1, x2, y2, filled) {
    const cx = (x1 + x2) / 2;
    const base = x2 - x1;
    const h    = y2 - y1;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x1, y2);
    this.ctx.closePath();
    this.ctx.stroke();
    if (filled) this.ctx.fill();
  }

  // =========================================================================
  // Shape Palette & Advanced Shape Engine
  // =========================================================================
  static get SHAPE_CATALOG() {
    return {
      geometry: [
        { id:"line",       label:"Line",         icon:"╱" },
        { id:"ray",        label:"Ray",          icon:"→" },
        { id:"dbl_arrow",  label:"Dbl Arrow",    icon:"↔" },
        { id:"rect",       label:"Rectangle",    icon:"⬜" },
        { id:"rounded_rect",label:"Rnd Rect",    icon:"▢" },
        { id:"square",     label:"Square",       icon:"◼" },
        { id:"circle",     label:"Circle",       icon:"⭕" },
        { id:"ellipse",    label:"Ellipse",      icon:"⬭" },
        { id:"arc",        label:"Arc",          icon:"◜" },
        { id:"angle",      label:"Angle Marker", icon:"∠" },
        { id:"triangle_eq",label:"Tri (Equil.)", icon:"△" },
        { id:"triangle_rt",label:"Tri (Right)",  icon:"◺" },
        { id:"pentagon",   label:"Pentagon",     icon:"⬠" },
        { id:"hexagon",    label:"Hexagon",      icon:"⬡" },
        { id:"star",       label:"Star",         icon:"⭐" },
      ],
      math: [
        { id:"cartesian_grid", label:"Cartesian Grid", icon:"⊹" },
        { id:"number_line",    label:"Number Line",    icon:"←●→" },
        { id:"sine_wave",      label:"Sine Wave",      icon:"∿" },
        { id:"cosine_wave",    label:"Cosine Wave",    icon:"∿" },
        { id:"parabola",       label:"Parabola y=x²",  icon:"⌓" },
        { id:"exponential",    label:"Exponential",    icon:"eˣ" },
        { id:"bezier",         label:"Bézier Curve",   icon:"⌒" },
      ],
      chart: [
        { id:"bar_chart",  label:"Bar Chart",  icon:"📊", needsData:true },
        { id:"pie_chart",  label:"Pie Chart",  icon:"🥧", needsData:true },
        { id:"line_plot",  label:"Line Plot",  icon:"📈", needsData:true },
      ],
      physics: [
        { id:"resistor",   label:"Resistor",   icon:"⊏⊐" },
        { id:"capacitor",  label:"Capacitor",  icon:"⊣⊢" },
        { id:"battery",    label:"Battery",    icon:"⊣|⊢" },
        { id:"ground",     label:"Ground",     icon:"⏚" },
        { id:"switch",     label:"Switch",     icon:"/ ○" },
        { id:"force_vec",  label:"Force Vec",  icon:"F→" },
        { id:"spring",     label:"Spring",     icon:"⌒⌒" },
        { id:"incline",    label:"Incline",    icon:"◺" },
      ],
      chemistry: [
        { id:"benzene",    label:"Benzene Ring",   icon:"⬡" },
        { id:"hex_ring",   label:"Hex Ring",       icon:"⬢" },
        { id:"pent_ring",  label:"Pent Ring",      icon:"⬠" },
        { id:"single_bond",label:"Single Bond",    icon:"—" },
        { id:"double_bond",label:"Double Bond",    icon:"=" },
        { id:"triple_bond",label:"Triple Bond",    icon:"≡" },
      ],
      cs: [
        { id:"process_box",   label:"Process",       icon:"□" },
        { id:"decision",      label:"Decision",      icon:"◇" },
        { id:"io_para",       label:"I/O",           icon:"▱" },
        { id:"terminal",      label:"Start/End",     icon:"(  )" },
        { id:"tree_node",     label:"Tree Node",     icon:"○—○" },
        { id:"graph_node",    label:"Graph Node",    icon:"●—●" },
      ],
    };
  }

  openShapePalette() {
    const modal = document.getElementById("shape-palette-modal");
    if (modal) modal.style.display = "flex";
    this.renderShapePaletteCategory("geometry");
    document.querySelectorAll(".sp-tab").forEach(t => {
      t.classList.toggle("sp-tab-active", t.dataset.cat === "geometry");
    });
  }

  renderShapePaletteCategory(cat) {
    const grid  = document.getElementById("shape-palette-grid");
    if (!grid) return;
    const items = TeacherControlPanel.SHAPE_CATALOG[cat] || [];
    grid.innerHTML = items.map(item => `
      <div class="sp-card${this.advancedTool?.shapeType === item.id ? ' sp-selected' : ''}"
           data-cat="${cat}" data-shape="${item.id}" data-needs-data="${item.needsData||false}"
           onclick="window.teacherApp._selectAdvancedShape('${cat}','${item.id}',${!!item.needsData})">
        <div class="sp-icon">${item.icon}</div>
        <div class="sp-label">${item.label}</div>
      </div>`).join("");
  }

  _selectAdvancedShape(cat, shapeType, needsData) {
    if (needsData) {
      // Open chart data modal first
      const chartModal = document.getElementById("chart-data-modal");
      const titleEl    = document.getElementById("chart-modal-title");
      const labels     = { bar_chart:"📊 Bar Chart Data", pie_chart:"🥧 Pie Chart Data", line_plot:"📈 Line Plot Data" };
      if (titleEl) titleEl.textContent = labels[shapeType] || "Chart Data";
      this._pendingChartShape = { cat, shapeType };
      if (chartModal) chartModal.style.display = "flex";
      return;
    }
    this._activateAdvancedTool(cat, shapeType, {});
  }

  _confirmChartData() {
    const chartModal  = document.getElementById("chart-data-modal");
    const labelsRaw   = document.getElementById("chart-labels-input")?.value || "";
    const valuesRaw   = document.getElementById("chart-values-input")?.value || "";
    const titleVal    = document.getElementById("chart-title-input")?.value  || "";
    const labels = labelsRaw.split(",").map(s => s.trim()).filter(Boolean);
    const values = valuesRaw.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (chartModal) chartModal.style.display = "none";
    if (!this._pendingChartShape) return;
    const { cat, shapeType } = this._pendingChartShape;
    this._pendingChartShape  = null;
    this._activateAdvancedTool(cat, shapeType, { chartLabels: labels, chartValues: values, chartTitle: titleVal });
  }

  _activateAdvancedTool(cat, shapeType, dataPayload) {
    // Deactivate all normal tool buttons
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active-tool"));
    this.currentTool = "advanced";
    this.advancedTool = { category: cat, shapeType, dataPayload: dataPayload || {} };
    const badge    = document.getElementById("active-shape-badge");
    const nameSpan = document.getElementById("active-shape-name");
    const catalog  = TeacherControlPanel.SHAPE_CATALOG[cat] || [];
    const entry    = catalog.find(x => x.id === shapeType);
    if (nameSpan) nameSpan.textContent = entry ? `${entry.icon} ${entry.label}` : shapeType;
    if (badge)    badge.style.display = "flex";
    this.canvas.style.cursor = "crosshair";
    // Close palette modal
    const modal = document.getElementById("shape-palette-modal");
    if (modal)  modal.style.display = "none";
    this.log(`🔷 Advanced shape: [${cat}] ${shapeType}`);
  }

  clearAdvancedTool() {
    this.advancedTool    = null;
    this.advancedStart   = null;
    this.advancedCurrent = null;
    this.currentTool     = "draw";
    const badge = document.getElementById("active-shape-badge");
    if (badge) badge.style.display = "none";
    // Restore draw tool button highlight
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active-tool"));
    const drawBtn = document.getElementById("tool-draw-btn");
    if (drawBtn) drawBtn.classList.add("active-tool");
    this.canvas.style.cursor = "crosshair";
  }

  // Convert screen pointer to normalized 0-1 canvas fraction
  _screenToNorm(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width  || 1))),
      y: Math.max(0, Math.min(1, (clientY - rect.top)  / (rect.height || 1))),
    };
  }

  // Ghost preview during advanced drag
  _drawGhostPrimitive() {
    if (!this.advancedStart || !this.advancedCurrent) return;
    const sx = this.advancedStart.x   * this.canvas.width;
    const sy = this.advancedStart.y   * this.canvas.height;
    const ex = this.advancedCurrent.x * this.canvas.width;
    const ey = this.advancedCurrent.y * this.canvas.height;
    this.ctx.save();
    this.ctx.globalAlpha = 0.55;
    this.ctx.setLineDash([6, 4]);
    this._drawShapePrimitive(
      this.ctx, this.advancedTool.shapeType, this.advancedTool.category,
      sx, sy, ex, ey,
      this.currentColor, this.currentFillColor, this.currentFillEnabled,
      this.currentSize, this.advancedTool.dataPayload, this.zoom
    );
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  // ─── The universal shape_primitive renderer ───────────────────────────────
  _drawShapePrimitive(ctx, shapeType, category, sx, sy, ex, ey, color, fillColor, fillEnabled, lineWidth, data, zoom) {
    const lw = (lineWidth || 2) * (zoom || 1);
    ctx.strokeStyle = color || "#38bdf8";
    ctx.lineWidth   = lw;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.fillStyle   = fillEnabled ? (fillColor || "rgba(56,189,248,0.18)") : "transparent";
    const w = ex - sx, h = ey - sy;
    const cx = sx + w / 2, cy = sy + h / 2;
    data = data || {};

    switch (shapeType) {
      // ── Geometry ─────────────────────────────────────────────────────
      case "line": ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke(); break;
      case "ray": {
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
        const hl = 12*(zoom||1), ang = Math.atan2(ey-sy,ex-sx);
        ctx.beginPath();
        ctx.moveTo(ex,ey); ctx.lineTo(ex-hl*Math.cos(ang-Math.PI/6),ey-hl*Math.sin(ang-Math.PI/6));
        ctx.moveTo(ex,ey); ctx.lineTo(ex-hl*Math.cos(ang+Math.PI/6),ey-hl*Math.sin(ang+Math.PI/6));
        ctx.stroke(); break;
      }
      case "dbl_arrow": {
        const hl=12*(zoom||1), ang=Math.atan2(ey-sy,ex-sx);
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx,sy); ctx.lineTo(sx+hl*Math.cos(ang-Math.PI/6),sy+hl*Math.sin(ang-Math.PI/6));
        ctx.moveTo(sx,sy); ctx.lineTo(sx+hl*Math.cos(ang+Math.PI/6),sy+hl*Math.sin(ang+Math.PI/6));
        ctx.moveTo(ex,ey); ctx.lineTo(ex-hl*Math.cos(ang-Math.PI/6),ey-hl*Math.sin(ang-Math.PI/6));
        ctx.moveTo(ex,ey); ctx.lineTo(ex-hl*Math.cos(ang+Math.PI/6),ey-hl*Math.sin(ang+Math.PI/6));
        ctx.stroke(); break;
      }
      case "rect": ctx.strokeRect(sx,sy,w,h); if(fillEnabled){ctx.fillRect(sx,sy,w,h);} break;
      case "rounded_rect": {
        const r=Math.min(Math.abs(w),Math.abs(h))*0.15;
        ctx.beginPath(); ctx.roundRect(sx,sy,w,h,r); ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "square": {
        const s2=Math.min(Math.abs(w),Math.abs(h))*(w<0?-1:1);
        ctx.strokeRect(sx,sy,s2,s2); if(fillEnabled)ctx.fillRect(sx,sy,s2,s2); break;
      }
      case "circle":
      case "ellipse": {
        const rx=Math.abs(w)/2||1, ry=Math.abs(h)/2||1;
        ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,2*Math.PI); ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "arc": {
        const radius=Math.sqrt(w*w+h*h)/2;
        ctx.beginPath(); ctx.arc(sx,sy,radius,0,Math.PI); ctx.stroke(); break;
      }
      case "angle": {
        const len=Math.sqrt(w*w+h*h);
        ctx.beginPath(); ctx.moveTo(sx,ey); ctx.lineTo(sx,sy); ctx.lineTo(ex,sy); ctx.stroke();
        const arcR=Math.min(len*0.3,30);
        ctx.beginPath(); ctx.arc(sx,sy,arcR,-Math.PI/2,0); ctx.stroke(); break;
      }
      case "triangle":
      case "triangle_eq": {
        ctx.beginPath(); ctx.moveTo(cx,sy); ctx.lineTo(ex,ey); ctx.lineTo(sx,ey); ctx.closePath();
        ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "triangle_rt": {
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,ey); ctx.lineTo(ex,ey); ctx.closePath();
        ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "pentagon": {
        ctx.beginPath();
        for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5; ctx.lineTo(cx+Math.abs(w/2)*Math.cos(a),cy+Math.abs(h/2)*Math.sin(a));}
        ctx.closePath(); ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "hexagon": {
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3; ctx.lineTo(cx+Math.abs(w/2)*Math.cos(a),cy+Math.abs(h/2)*Math.sin(a));}
        ctx.closePath(); ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      case "star": {
        ctx.beginPath();
        const ro=Math.abs(w/2), ri=ro*0.4;
        for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5, r=i%2===0?ro:ri; ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}
        ctx.closePath(); ctx.stroke(); if(fillEnabled)ctx.fill(); break;
      }
      // ── Math & Grids ─────────────────────────────────────────────────
      case "cartesian_grid": {
        const xMin=data.xMin||-10, xMax=data.xMax||10;
        const yMin=data.yMin||-10, yMax=data.yMax||10;
        const xSteps=xMax-xMin, ySteps=yMax-yMin;
        const dx=Math.abs(w)/xSteps, dy=Math.abs(h)/ySteps;
        ctx.save();
        ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=0.5*(zoom||1);
        for(let i=0;i<=xSteps;i++){ctx.beginPath();ctx.moveTo(sx+i*dx,sy);ctx.lineTo(sx+i*dx,ey);ctx.stroke();}
        for(let j=0;j<=ySteps;j++){ctx.beginPath();ctx.moveTo(sx,sy+j*dy);ctx.lineTo(ex,sy+j*dy);ctx.stroke();}
        // Axes
        ctx.strokeStyle=color; ctx.lineWidth=lw;
        const ax=sx+Math.abs(w)*(-xMin/xSteps), ay=sy+Math.abs(h)*(yMax/ySteps);
        ctx.beginPath();ctx.moveTo(ax,sy);ctx.lineTo(ax,ey);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,ay);ctx.lineTo(ex,ay);ctx.stroke();
        // Labels
        ctx.fillStyle=color; ctx.font=`${10*(zoom||1)}px monospace`;
        for(let i=xMin;i<=xMax;i+=2){if(i===0)continue;const px=ax+(i*dx);ctx.fillText(i,px-4,ay+14*(zoom||1));}
        for(let j=yMin;j<=yMax;j+=2){if(j===0)continue;const py=ay-(j*dy);ctx.fillText(j,ax+4*(zoom||1),py+4);}
        ctx.restore(); break;
      }
      case "number_line": {
        ctx.beginPath(); ctx.moveTo(sx,cy); ctx.lineTo(ex,cy); ctx.stroke();
        const ticks=data.xMax-data.xMin||20; const tdx=Math.abs(w)/ticks;
        ctx.font=`${9*(zoom||1)}px monospace`; ctx.fillStyle=color;
        for(let i=0;i<=ticks;i++){const px=sx+i*tdx;ctx.beginPath();ctx.moveTo(px,cy-6*(zoom||1));ctx.lineTo(px,cy+6*(zoom||1));ctx.stroke();ctx.fillText((data.xMin||0)+i,px-4,cy+18*(zoom||1));}
        break;
      }
      case "sine_wave":
      case "cosine_wave": {
        const isSin=shapeType==="sine_wave";
        ctx.beginPath();
        for(let px=sx;px<=ex;px+=2){
          const t=(px-sx)/Math.abs(w||1)*4*Math.PI;
          const py=cy-(h/2)*(isSin?Math.sin(t):Math.cos(t));
          px===sx?ctx.moveTo(px,py):ctx.lineTo(px,py);
        } ctx.stroke(); break;
      }
      case "parabola": {
        ctx.beginPath();
        for(let px=sx;px<=ex;px+=2){
          const t=((px-cx)/(Math.abs(w/2)||1));
          const py=sy+Math.abs(h)*t*t;
          px===sx?ctx.moveTo(px,py):ctx.lineTo(px,Math.min(py,ey));
        } ctx.stroke(); break;
      }
      case "exponential": {
        ctx.beginPath();
        for(let px=sx;px<=ex;px+=2){
          const t=(px-sx)/(Math.abs(w)||1)*4;
          const py=ey-Math.abs(h)*(Math.exp(t)-1)/(Math.exp(4)-1);
          px===sx?ctx.moveTo(px,py):ctx.lineTo(px,py);
        } ctx.stroke(); break;
      }
      case "bezier": {
        ctx.beginPath(); ctx.moveTo(sx,sy);
        ctx.bezierCurveTo(sx+w*0.25,ey,sx+w*0.75,sy,ex,ey);
        ctx.stroke(); break;
      }
      // ── Charts ───────────────────────────────────────────────────────
      case "bar_chart": {
        const labels=data.chartLabels||["A","B","C"]; const vals=data.chartValues||[50,80,30];
        const n=Math.min(labels.length,vals.length); const maxV=Math.max(...vals,1);
        const barW=Math.abs(w)/(n*1.5+0.5); const gap=barW*0.5;
        ctx.fillStyle=color;
        for(let i=0;i<n;i++){
          const bx=sx+gap+i*(barW+gap);
          const bh=Math.abs(h)*(vals[i]/maxV)*0.85;
          ctx.fillRect(bx,ey-bh,barW,bh);
          ctx.font=`${9*(zoom||1)}px sans-serif`; ctx.fillStyle=color;
          ctx.fillText(labels[i],bx+barW/2-4,ey+14*(zoom||1));
          ctx.fillStyle=color;
        }
        ctx.strokeRect(sx,sy,w,h);
        if(data.chartTitle){ctx.font=`bold ${11*(zoom||1)}px sans-serif`;ctx.textAlign="center";ctx.fillText(data.chartTitle,cx,sy-6*(zoom||1));ctx.textAlign="start";}
        break;
      }
      case "pie_chart": {
        const vals2=data.chartValues||[30,50,20]; const total=vals2.reduce((a,b)=>a+b,0);
        const labs2=data.chartLabels||vals2.map((_,i)=>`S${i+1}`);
        const palette=["#38bdf8","#c084fc","#34d399","#fb923c","#f43f5e","#a3e635"];
        let startAng=-Math.PI/2; const r=Math.min(Math.abs(w),Math.abs(h))/2;
        for(let i=0;i<vals2.length;i++){
          const sweep=2*Math.PI*vals2[i]/total;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,startAng,startAng+sweep);
          ctx.closePath(); ctx.fillStyle=palette[i%palette.length]; ctx.fill();
          ctx.strokeStyle="#060911"; ctx.lineWidth=1; ctx.stroke();
          const midAng=startAng+sweep/2;
          ctx.fillStyle="#fff"; ctx.font=`${9*(zoom||1)}px sans-serif`;
          ctx.fillText(labs2[i],cx+(r*0.65)*Math.cos(midAng)-8,cy+(r*0.65)*Math.sin(midAng)+4);
          startAng+=sweep;
        }
        if(data.chartTitle){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.font=`bold ${11*(zoom||1)}px sans-serif`;ctx.textAlign="center";ctx.fillText(data.chartTitle,cx,sy-6*(zoom||1));ctx.textAlign="start";}
        break;
      }
      case "line_plot": {
        const lvals=data.chartValues||[20,60,40,80,50]; const llabs=data.chartLabels||lvals.map((_,i)=>i+1);
        const n2=lvals.length; const maxV2=Math.max(...lvals,1);
        ctx.beginPath();
        for(let i=0;i<n2;i++){
          const px=sx+(i/(n2-1||1))*Math.abs(w);
          const py=ey-Math.abs(h)*(lvals[i]/maxV2)*0.85;
          i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
          ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,3*(zoom||1),0,2*Math.PI);ctx.fill();ctx.restore();
        }
        ctx.stroke();
        ctx.strokeRect(sx,sy,w,h);
        if(data.chartTitle){ctx.fillStyle=color;ctx.font=`bold ${11*(zoom||1)}px sans-serif`;ctx.textAlign="center";ctx.fillText(data.chartTitle,cx,sy-6*(zoom||1));ctx.textAlign="start";}
        break;
      }
      // ── Physics ──────────────────────────────────────────────────────
      case "resistor": {
        const midy=cy; const segW=Math.abs(w)/6;
        ctx.beginPath(); ctx.moveTo(sx,midy); ctx.lineTo(sx+segW,midy); ctx.stroke();
        ctx.strokeRect(sx+segW,sy+Math.abs(h)*0.25,segW*4,Math.abs(h)*0.5);
        ctx.beginPath(); ctx.moveTo(sx+segW*5,midy); ctx.lineTo(ex,midy); ctx.stroke(); break;
      }
      case "capacitor": {
        const midy2=cy; const gap2=6*(zoom||1);
        ctx.beginPath();ctx.moveTo(sx,midy2);ctx.lineTo(cx-gap2,midy2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx,ey);ctx.moveTo(cx-gap2,sy);ctx.lineTo(cx-gap2,ey);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+gap2,sy);ctx.lineTo(cx+gap2,ey);ctx.moveTo(cx+gap2,midy2);ctx.lineTo(ex,midy2);ctx.stroke();
        break;
      }
      case "battery": {
        const midy3=cy;
        ctx.beginPath();ctx.moveTo(sx,midy3);ctx.lineTo(cx-8*(zoom||1),midy3);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx-8*(zoom||1),sy);ctx.lineTo(cx-8*(zoom||1),ey);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx,sy+Math.abs(h)*0.3);ctx.lineTo(cx,ey-Math.abs(h)*0.3);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+8*(zoom||1),sy);ctx.lineTo(cx+8*(zoom||1),ey);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+8*(zoom||1),midy3);ctx.lineTo(ex,midy3);ctx.stroke();
        break;
      }
      case "ground": {
        ctx.beginPath();ctx.moveTo(cx,sy);ctx.lineTo(cx,cy);ctx.stroke();
        const gw=Math.abs(w)*0.5;
        ctx.beginPath();ctx.moveTo(cx-gw/2,cy);ctx.lineTo(cx+gw/2,cy);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx-gw*0.3,cy+8*(zoom||1));ctx.lineTo(cx+gw*0.3,cy+8*(zoom||1));ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx-gw*0.1,cy+16*(zoom||1));ctx.lineTo(cx+gw*0.1,cy+16*(zoom||1));ctx.stroke();
        break;
      }
      case "switch": {
        const midy4=cy;
        ctx.beginPath();ctx.moveTo(sx,midy4);ctx.lineTo(cx-10*(zoom||1),midy4);ctx.stroke();
        ctx.beginPath();ctx.arc(cx-10*(zoom||1),midy4,3*(zoom||1),0,2*Math.PI);ctx.fill();
        ctx.beginPath();ctx.arc(cx+10*(zoom||1),midy4,3*(zoom||1),0,2*Math.PI);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx-10*(zoom||1),midy4);ctx.lineTo(cx+10*(zoom||1),sy+Math.abs(h)*0.2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+10*(zoom||1),midy4);ctx.lineTo(ex,midy4);ctx.stroke();
        break;
      }
      case "force_vec": {
        const hl2=16*(zoom||1), ang2=Math.atan2(ey-sy,ex-sx);
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex,ey);
        ctx.lineTo(ex-hl2*Math.cos(ang2-Math.PI/6),ey-hl2*Math.sin(ang2-Math.PI/6));
        ctx.moveTo(ex,ey);
        ctx.lineTo(ex-hl2*Math.cos(ang2+Math.PI/6),ey-hl2*Math.sin(ang2+Math.PI/6));
        ctx.stroke();
        ctx.fillStyle=color;ctx.font=`bold ${11*(zoom||1)}px serif`;
        ctx.fillText("F",cx-6*(zoom||1),cy-8*(zoom||1));
        break;
      }
      case "spring": {
        const coils=6; const dxx=Math.abs(w)/coils; const amp=Math.abs(h)*0.35;
        ctx.beginPath(); ctx.moveTo(sx,cy);
        for(let i=0;i<coils;i++){ctx.quadraticCurveTo(sx+dxx*(i+0.25),cy-amp,sx+dxx*(i+0.5),cy);ctx.quadraticCurveTo(sx+dxx*(i+0.75),cy+amp,sx+dxx*(i+1),cy);}
        ctx.stroke(); break;
      }
      case "incline": {
        ctx.beginPath();ctx.moveTo(sx,ey);ctx.lineTo(ex,ey);ctx.lineTo(sx,sy);ctx.closePath();ctx.stroke();break;
      }
      // ── Chemistry ────────────────────────────────────────────────────
      case "benzene": {
        const rb=Math.min(Math.abs(w),Math.abs(h))/2;
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;ctx.lineTo(cx+rb*Math.cos(a),cy+rb*Math.sin(a));}
        ctx.closePath();ctx.stroke();
        ctx.beginPath();ctx.arc(cx,cy,rb*0.6,0,2*Math.PI);ctx.stroke();
        break;
      }
      case "hex_ring": {
        const rh=Math.min(Math.abs(w),Math.abs(h))/2;
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;ctx.lineTo(cx+rh*Math.cos(a),cy+rh*Math.sin(a));}
        ctx.closePath();ctx.stroke();break;
      }
      case "pent_ring": {
        const rp=Math.min(Math.abs(w),Math.abs(h))/2;
        ctx.beginPath();
        for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;ctx.lineTo(cx+rp*Math.cos(a),cy+rp*Math.sin(a));}
        ctx.closePath();ctx.stroke();break;
      }
      case "single_bond": ctx.beginPath();ctx.moveTo(sx,cy);ctx.lineTo(ex,cy);ctx.stroke();break;
      case "double_bond": {
        const off=4*(zoom||1);
        ctx.beginPath();ctx.moveTo(sx,cy-off);ctx.lineTo(ex,cy-off);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,cy+off);ctx.lineTo(ex,cy+off);ctx.stroke();break;
      }
      case "triple_bond": {
        const off2=6*(zoom||1);
        ctx.beginPath();ctx.moveTo(sx,cy-off2);ctx.lineTo(ex,cy-off2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,cy);ctx.lineTo(ex,cy);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx,cy+off2);ctx.lineTo(ex,cy+off2);ctx.stroke();break;
      }
      // ── CS / Flowchart ───────────────────────────────────────────────
      case "process_box": ctx.strokeRect(sx,sy,w,h);if(fillEnabled)ctx.fillRect(sx,sy,w,h);break;
      case "decision": {
        ctx.beginPath();ctx.moveTo(cx,sy);ctx.lineTo(ex,cy);ctx.lineTo(cx,ey);ctx.lineTo(sx,cy);ctx.closePath();
        ctx.stroke();if(fillEnabled)ctx.fill();break;
      }
      case "io_para": {
        const skew=Math.abs(w)*0.12;
        ctx.beginPath();ctx.moveTo(sx+skew,sy);ctx.lineTo(ex+skew,sy);ctx.lineTo(ex-skew,ey);ctx.lineTo(sx-skew,ey);ctx.closePath();
        ctx.stroke();if(fillEnabled)ctx.fill();break;
      }
      case "terminal": {
        const trx=Math.abs(h)/2;
        ctx.beginPath();ctx.ellipse(sx+trx,cy,trx,Math.abs(h)/2,0,Math.PI/2,3*Math.PI/2);
        ctx.lineTo(ex-trx,sy);
        ctx.ellipse(ex-trx,cy,trx,Math.abs(h)/2,0,-Math.PI/2,Math.PI/2);
        ctx.lineTo(sx+trx,ey);
        ctx.closePath();ctx.stroke();if(fillEnabled)ctx.fill();break;
      }
      case "tree_node":
      case "graph_node": {
        const nr=Math.min(Math.abs(w),Math.abs(h))*0.18;
        ctx.beginPath();ctx.arc(sx+nr,cy,nr,0,2*Math.PI);ctx.stroke();
        ctx.beginPath();ctx.arc(ex-nr,cy,nr,0,2*Math.PI);ctx.stroke();
        ctx.beginPath();ctx.moveTo(sx+nr*2,cy);ctx.lineTo(ex-nr*2,cy);ctx.stroke();break;
      }
      default: ctx.strokeRect(sx,sy,w,h); break;
    }
  }

  _drawOverlay(ov) {
    if (!ov.img || !ov.img.complete) return;
    const x = ov.position.x * this.canvas.width  * this.zoom + this.panX;
    const y = ov.position.y * this.canvas.height * this.zoom + this.panY;
    const w = ov.dimensions.width  * this.canvas.width  * this.zoom;
    const h = ov.dimensions.height * this.canvas.height * this.zoom;
    this.ctx.drawImage(ov.img, x, y, w, h);
  }

  // =========================================================================
  // Event Binding
  // =========================================================================
  bindEvents() {
    window.addEventListener("resize", () => this.setupCanvas());

    // Wheel zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 0.85);
    }, { passive: false });

    // Zoom buttons
    const zoomCenter = () => {
      const r = this.canvas.getBoundingClientRect();
      return { x: r.left + this.canvas.width / 2, y: r.top + this.canvas.height / 2 };
    };
    if (this.zoomInBtn)    this.zoomInBtn.addEventListener("click",  () => { const c = zoomCenter(); this.zoomAt(c.x, c.y, 1.25); });
    if (this.zoomOutBtn)   this.zoomOutBtn.addEventListener("click", () => { const c = zoomCenter(); this.zoomAt(c.x, c.y, 0.8);  });
    if (this.zoomResetBtn) this.zoomResetBtn.addEventListener("click", () => { this.zoom = 1; this.panX = 0; this.panY = 0; this.redrawCanvas(); });
    if (this.resetViewBtn) this.resetViewBtn.addEventListener("click", () => { this.panX = 0; this.panY = 0; this.redrawCanvas(); });

    // ── Tool selector buttons ────────────────────────────────────────────
    const eraserBtn    = document.getElementById("tool-eraser-btn");
    const dblArrowBtn  = document.getElementById("tool-dbl-arrow-btn");
    const triangleBtn  = document.getElementById("tool-triangle-btn");
    const allToolBtns  = [
      this.drawToolBtn, eraserBtn, this.lineToolBtn, this.arrowToolBtn,
      dblArrowBtn, this.rectToolBtn, this.circleToolBtn, triangleBtn, this.panToolBtn
    ];
    const setTool = (tool, activeBtn) => {
      this.currentTool  = tool;
      this.advancedTool = null;
      const badge = document.getElementById("active-shape-badge");
      if (badge) badge.style.display = "none";
      allToolBtns.forEach(b => { if (b) { b.classList.remove("active-tool"); b.style.background = ""; b.style.color = ""; } });
      if (activeBtn) { activeBtn.classList.add("active-tool"); }
      this.canvas.style.cursor = tool === "pan" ? "grab" : (tool === "eraser" ? "cell" : "crosshair");
      this.log(`🖊️ Tool: ${tool}`);
    };
    if (this.drawToolBtn)   this.drawToolBtn.addEventListener("click",   () => setTool("draw",      this.drawToolBtn));
    if (eraserBtn)          eraserBtn.addEventListener("click",          () => setTool("eraser",    eraserBtn));
    if (this.lineToolBtn)   this.lineToolBtn.addEventListener("click",   () => setTool("line",      this.lineToolBtn));
    if (this.arrowToolBtn)  this.arrowToolBtn.addEventListener("click",  () => setTool("arrow",     this.arrowToolBtn));
    if (dblArrowBtn)        dblArrowBtn.addEventListener("click",        () => setTool("dbl_arrow", dblArrowBtn));
    if (this.rectToolBtn)   this.rectToolBtn.addEventListener("click",   () => setTool("rect",      this.rectToolBtn));
    if (this.circleToolBtn) this.circleToolBtn.addEventListener("click", () => setTool("circle",    this.circleToolBtn));
    if (triangleBtn)        triangleBtn.addEventListener("click",        () => setTool("triangle",  triangleBtn));
    if (this.panToolBtn)    this.panToolBtn.addEventListener("click",    () => setTool("pan",       this.panToolBtn));

    // Color, fill & size
    this.colorPicker.addEventListener("change", e => this.currentColor = e.target.value);
    this.sizePicker.addEventListener("change",  e => this.currentSize  = parseInt(e.target.value));
    const fillColorPicker = document.getElementById("fill-color-picker");
    const fillToggle      = document.getElementById("fill-toggle");
    if (fillColorPicker) fillColorPicker.addEventListener("change", e => { this.currentFillColor   = e.target.value; });
    if (fillToggle)      fillToggle.addEventListener("change",      e => { this.currentFillEnabled = e.target.checked; });

    // ── Shape Palette Modal ──────────────────────────────────────────────
    const shapePaletteModal = document.getElementById("shape-palette-modal");
    const openPaletteBtn    = document.getElementById("open-shape-palette-btn");
    const closePaletteBtn   = document.getElementById("close-shape-palette-btn");
    if (openPaletteBtn)  openPaletteBtn.addEventListener("click",  () => this.openShapePalette());
    if (closePaletteBtn) closePaletteBtn.addEventListener("click", () => { if (shapePaletteModal) shapePaletteModal.style.display = "none"; });
    if (shapePaletteModal) shapePaletteModal.addEventListener("click", e => { if (e.target === shapePaletteModal) shapePaletteModal.style.display = "none"; });

    // Tab clicks
    document.querySelectorAll(".sp-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sp-tab").forEach(t => t.classList.remove("sp-tab-active"));
        btn.classList.add("sp-tab-active");
        this.renderShapePaletteCategory(btn.dataset.cat);
      });
    });

    // ── Chart Data Modal ─────────────────────────────────────────────────
    const chartModal      = document.getElementById("chart-data-modal");
    const closeChartBtn   = document.getElementById("close-chart-modal-btn");
    const chartConfirmBtn = document.getElementById("chart-confirm-btn");
    if (closeChartBtn)   closeChartBtn.addEventListener("click",   () => { if (chartModal) chartModal.style.display = "none"; });
    if (chartConfirmBtn) chartConfirmBtn.addEventListener("click", () => this._confirmChartData());

    // Pointer events
    this.canvas.addEventListener("pointerdown", e => this.startStroke(e));
    this.canvas.addEventListener("pointermove", e => this.drawStroke(e));
    this.canvas.addEventListener("pointerup",   () => this.endStroke());
    this.canvas.addEventListener("pointerleave",() => this.endStroke());

    // ASR buttons
    this.pcmBtn.addEventListener("click",        () => this.togglePCMStream());
    this.micBtn.addEventListener("click",        () => this.toggleMicStream());
    this.sendCaptionBtn.addEventListener("click",() => this.sendManualCaption());
    this.micLangSelect.addEventListener("change", e => { this.selectedMicLang = e.target.value; if (this.recognition) this.recognition.lang = this.selectedMicLang; });

    // Recording
    if (this.recordBtn) this.recordBtn.addEventListener("click", () => this.toggleLectureRecording());

    // Subject management
    if (this.subjectSelect) {
      this.subjectSelect.addEventListener("change", e => {
        if (e.target.value === "__new__") {
          if (this.newSubjectContainer) this.newSubjectContainer.style.display = "flex";
        } else {
          if (this.newSubjectContainer) this.newSubjectContainer.style.display = "none";
          this.sessionId = e.target.value;
        }
      });
    }
    if (this.createSubjectBtn) this.createSubjectBtn.addEventListener("click", () => this.createNewSubjectClass());

    // Doubts modal
    if (this.doubtsBtn)           this.doubtsBtn.addEventListener("click",           () => { if (this.doubtsModal) this.doubtsModal.style.display = "flex"; });
    if (this.closeDoubtsModalBtn) this.closeDoubtsModalBtn.addEventListener("click", () => { if (this.doubtsModal) this.doubtsModal.style.display = "none"; });
    if (this.doubtsModal)         this.doubtsModal.addEventListener("click", e => { if (e.target === this.doubtsModal) this.doubtsModal.style.display = "none"; });

    // ── Clear canvas — also clear shapePrimitives ─────────────────────
    this.clearBtn.addEventListener("click", () => {
      this.strokes         = [];
      this.shapes          = [];
      this.overlays        = [];
      this.shapePrimitives = [];
      this.redrawCanvas();
      this.broadcastMessage({ type: "clear_canvas", sessionId: this.sessionId });
      this.log("🗑️ Canvas cleared and synced to all students.");
    });

    // ── Presentation Upload ──────────────────────────────────────────────
    if (this.uploadDocBtn)  this.uploadDocBtn.addEventListener("click",  () => this.docFileInput && this.docFileInput.click());
    if (this.docFileInput)  this.docFileInput.addEventListener("change", e => this.handleDocumentUpload(e.target.files[0]));
    if (this.slidePrevBtn)  this.slidePrevBtn.addEventListener("click",  () => this.changeSlide(this.currentSlide - 1));
    if (this.slideNextBtn)  this.slideNextBtn.addEventListener("click",  () => this.changeSlide(this.currentSlide + 1));
    if (this.slideClearBtn) this.slideClearBtn.addEventListener("click", () => {
      this.slides      = [];
      this.currentSlide= 0;
      this.slideImage  = null;
      if (this.slideNav) this.slideNav.style.display = "none";
      this.redrawCanvas();
      this.broadcastMessage({ type: "presentation_clear", sessionId: this.sessionId });
      this.log("🗂️ Slides cleared.");
    });

    // ── Diagram Search ───────────────────────────────────────────────────
    if (this.searchDiagramBtn)    this.searchDiagramBtn.addEventListener("click",    () => { if (this.diagramSearchModal) this.diagramSearchModal.style.display = "flex"; });
    if (this.closeDiagramModalBtn)this.closeDiagramModalBtn.addEventListener("click",() => { if (this.diagramSearchModal) this.diagramSearchModal.style.display = "none"; });
    if (this.diagramSearchModal)  this.diagramSearchModal.addEventListener("click",  e => { if (e.target === this.diagramSearchModal) this.diagramSearchModal.style.display = "none"; });
    if (this.diagramSearchExecBtn)this.diagramSearchExecBtn.addEventListener("click",() => {
      const q = this.diagramSearchInput?.value?.trim();
      if (q) this.runDiagramSearch(q);
    });
    if (this.diagramSearchInput) {
      this.diagramSearchInput.addEventListener("keydown", e => { if (e.key === "Enter") { const q = e.target.value.trim(); if (q) this.runDiagramSearch(q); } });
    }
  }

  // =========================================================================
  // Pointer Handler — Freehand + Shapes
  // =========================================================================
  startStroke(e) {
    if (this.currentTool === "pan" || e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.panStart  = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.canvas.style.cursor = "grabbing";
      return;
    }
    const worldPt = this.screenToWorld(e.clientX, e.clientY);
    if (this.currentTool === "draw") {
      this.isDrawing     = true;
      this.currentPoints = [worldPt];
    } else {
      // Shape tool
      this.isDrawing  = true;
      this.shapeStart = worldPt;
      this.shapeCurrent = worldPt;
    }
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

    if (this.currentTool === "draw") {
      this.currentPoints.push(worldPt);
      const prev  = this.currentPoints[this.currentPoints.length - 2];
      const pScr  = this.worldToScreen(prev.x, prev.y);
      const cScr  = this.worldToScreen(worldPt.x, worldPt.y);
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth   = this.currentSize * this.zoom;
      this.ctx.lineCap     = "round";
      this.ctx.lineJoin    = "round";
      this.ctx.moveTo(pScr.x, pScr.y);
      this.ctx.lineTo(cScr.x, cScr.y);
      this.ctx.stroke();
    } else {
      // Ghost preview for shape tools
      this.shapeCurrent = worldPt;
      this.redrawCanvas();
    }
  }

  endStroke() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.currentTool === "pan" ? "grab" : "crosshair";
      return;
    }
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentTool === "draw") {
      if (this.currentPoints.length >= 2) {
        const strokeObj = {
          id: `strk-${Date.now()}`,
          color: this.currentColor,
          size:  this.currentSize,
          points: this.currentPoints
        };
        this.strokes.push(strokeObj);
        this.broadcastMessage({ type: "stroke", sessionId: this.sessionId, stroke: strokeObj });
      }
      this.currentPoints = [];
    } else if (this.shapeStart && this.shapeCurrent) {
      // Commit shape
      const shapeObj = {
        id:         `shp-${Date.now()}`,
        type:       "shape",
        shapeType:  this.currentTool,
        color:      this.currentColor,
        lineWidth:  this.currentSize,
        filled:     false,
        startPoint: this.shapeStart,
        endPoint:   this.shapeCurrent,
        sessionId:  this.sessionId
      };
      this.shapes.push(shapeObj);
      this.broadcastMessage({ type: "shape", sessionId: this.sessionId, shape: shapeObj });
      this.shapeStart   = null;
      this.shapeCurrent = null;
      this.redrawCanvas();
      this.log(`📐 Shape [${this.currentTool}] drawn & broadcast.`);
    }
  }

  // =========================================================================
  // Presentation — PDF / Image Upload
  // =========================================================================
  async handleDocumentUpload(file) {
    if (!file) return;
    this.log(`📁 Loading "${file.name}" (${(file.size/1024).toFixed(1)} KB)...`);

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      await this._loadPDF(file);
    } else if (['png','jpg','jpeg','webp','svg'].includes(ext)) {
      await this._loadSingleImage(file);
    } else {
      alert("⚠️ Unsupported file type. Please use PDF, PNG, JPG, JPEG, WEBP or SVG.");
    }
  }

  async _loadPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      alert("⚠️ PDF.js not loaded. Check your internet connection.");
      return;
    }
    this.log("⏳ Rendering PDF pages via PDF.js...");
    const slides = [];
    try {
      const buffer   = await file.arrayBuffer();
      const pdfDoc   = await pdfjsLib.getDocument({ data: buffer }).promise;
      const total    = pdfDoc.numPages;
      this.log(`📄 PDF has ${total} page(s). Rendering...`);

      for (let p = 1; p <= total; p++) {
        const page     = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 1.5 });
        const offCanvas= document.createElement("canvas");
        offCanvas.width  = viewport.width;
        offCanvas.height = viewport.height;
        await page.render({ canvasContext: offCanvas.getContext("2d"), viewport }).promise;
        slides.push(offCanvas.toDataURL("image/png"));
        this.log(`  ✔ Rendered page ${p}/${total}`);
      }
      this._presentSlides(slides, file.name);
    } catch(err) {
      this.log(`❌ PDF render error: ${err.message}`);
      alert(`PDF render failed: ${err.message}`);
    }
  }

  async _loadSingleImage(file) {
    const url = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
    this._presentSlides([url], file.name);
  }

  _presentSlides(slides, fileName) {
    this.slides       = slides;
    this.currentSlide = 0;
    this.log(`🎞️ Loaded ${slides.length} slide(s) from "${fileName}".`);

    // Show slide navigation
    if (this.slideNav) this.slideNav.style.display = "flex";
    this._updateSlideCounter();

    // Broadcast the first slide immediately; full load for sync
    this._loadSlideImage(0);

    // Broadcast all slides to students (with a size cap per message for very large PDFs)
    // We broadcast per-slide to avoid oversized WS frames
    slides.forEach((dataUrl, idx) => {
      this.broadcastMessage({
        type:       "presentation_slide",
        sessionId:  this.sessionId,
        slideIndex: idx,
        totalSlides: slides.length,
        imageData:  dataUrl,
        fileName:   fileName
      });
    });
    // Tell students which slide to show now
    this.broadcastMessage({ type: "presentation_slide_change", sessionId: this.sessionId, slideIndex: 0 });
  }

  _loadSlideImage(index) {
    if (index < 0 || index >= this.slides.length) return;
    const img = new Image();
    img.onload = () => {
      this.slideImage = img;
      this.redrawCanvas();
    };
    img.src = this.slides[index];
  }

  changeSlide(index) {
    if (this.slides.length === 0) return;
    this.currentSlide = Math.max(0, Math.min(index, this.slides.length - 1));
    this._updateSlideCounter();
    this._loadSlideImage(this.currentSlide);
    this.broadcastMessage({ type: "presentation_slide_change", sessionId: this.sessionId, slideIndex: this.currentSlide });
    this.log(`📑 Slide changed to ${this.currentSlide + 1} / ${this.slides.length}`);
  }

  _updateSlideCounter() {
    if (this.slideCounter) this.slideCounter.textContent = `Slide ${this.currentSlide + 1} of ${this.slides.length}`;
  }

  // =========================================================================
  // Diagram Search & Overlay (Wikimedia API)
  // =========================================================================
  async runDiagramSearch(query) {
    if (!query) return;
    if (this.diagramSearchInput) this.diagramSearchInput.value = query;
    const grid = this.diagramResultsGrid;
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#38bdf8; padding:20px; font-size:0.85rem;">⏳ Searching for "<strong>${query}</strong>"...</div>`;

    try {
      // Wikimedia Commons API — free, no CORS issues on localhost, educational use
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=18&format=json&origin=*`;
      const resp   = await fetch(apiUrl);
      const data   = await resp.json();
      const pages  = data?.query?.search || [];

      if (pages.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:20px;">No results found for "<strong>${query}</strong>". Try a different query.</div>`;
        return;
      }

      // Fetch image info for each result
      const titles = pages.map(p => p.title).join("|");
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|thumburl|extmetadata&iiurlwidth=300&format=json&origin=*`;
      const infoResp = await fetch(infoUrl);
      const infoData = await infoResp.json();
      const infoPages = Object.values(infoData?.query?.pages || {});

      grid.innerHTML = "";
      let count = 0;

      infoPages.forEach(pg => {
        const ii     = pg.imageinfo?.[0];
        const thumb  = ii?.thumburl || ii?.url;
        const imgUrl = ii?.url;
        if (!thumb || !imgUrl) return;
        const title = (pg.title || "").replace(/^File:/, "").replace(/_/g," ");

        const card = document.createElement("div");
        card.className = "diag-result-card";
        card.innerHTML = `
          <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22110%22><rect fill=%22%230d1525%22 width=%22160%22 height=%22110%22/><text x=%2280%22 y=%2260%22 text-anchor=%22middle%22 fill=%22%2364748b%22 font-size=%2212%22>No Preview</text></svg>'"/>
          <div class="diag-caption">${title.length > 55 ? title.slice(0,52)+"…" : title}</div>
        `;
        card.addEventListener("click", () => {
          this.placeImageOverlay(imgUrl, query);
          if (this.diagramSearchModal) this.diagramSearchModal.style.display = "none";
        });
        grid.appendChild(card);
        count++;
      });

      if (count === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:20px;">Results found but no preview images available. Try a different query.</div>`;
      }
    } catch(err) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#f43f5e; padding:20px;">⚠️ Search failed: ${err.message}</div>`;
      this.log(`Diagram search error: ${err.message}`);
    }
  }

  placeImageOverlay(imageUrl, query) {
    const overlay = {
      id:         `ov-${Date.now()}`,
      imageUrl:   imageUrl,
      query:      query,
      position:   { x: 0.05, y: 0.05 },
      dimensions: { width: 0.90, height: 0.85 },
      img:        null
    };

    // Pre-load on teacher side
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      overlay.img = img;
      this.overlays.push(overlay);
      this.redrawCanvas();
      this.log(`🖼️ Diagram overlaid: "${query}"`);
    };
    img.onerror = () => {
      // Fallback: still broadcast to students even if CORS blocks teacher preview
      this.log(`⚠️ Teacher preview blocked by CORS — broadcasting to students anyway.`);
      this.overlays.push(overlay);
    };
    img.src = imageUrl;

    // Broadcast to students
    this.broadcastMessage({
      type:       "whiteboard_image_overlay",
      sessionId:  this.sessionId,
      imageUrl:   imageUrl,
      position:   overlay.position,
      dimensions: overlay.dimensions,
      query:      query
    });
  }

  // =========================================================================
  // Audio Streaming
  // =========================================================================
  async togglePCMStream() {
    if (this.isPCMRecording) { this.stopPCMStream(); }
    else {
      if (this.isRecording) this.toggleMicStream();
      await this.startPCMStream();
    }
  }

  async startPCMStream() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source  = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // ── Prefer AudioWorklet (zero GC pressure, 1024-sample = 64ms packets) ──
      const workletCode = `
        class PCMSender extends AudioWorkletProcessor {
          process(inputs) {
            const ch = inputs[0][0];
            if (!ch || !ch.length) return true;
            const out = new Int16Array(ch.length);
            for (let i = 0; i < ch.length; i++) {
              const s = Math.max(-1, Math.min(1, ch[i]));
              out[i] = s < 0 ? s * 32768 : s * 32767;
            }
            this.port.postMessage(out.buffer, [out.buffer]);
            return true;
          }
        }
        registerProcessor('pcm-sender', PCMSender);
      `;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      try {
        await this.audioCtx.audioWorklet.addModule(blobUrl);
        this.audioWorklet = new AudioWorkletNode(this.audioCtx, "pcm-sender");
        this.audioWorklet.port.onmessage = (ev) => {
          if (!this.isPCMRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          this.ws.send(ev.data);
        };
        source.connect(this.audioWorklet);
        this.audioWorklet.connect(this.audioCtx.destination);
        this.log("🚀 Studio PCM Stream active [AudioWorklet 1024-sample / 64ms]");
      } catch (_workletErr) {
        // Fallback: ScriptProcessor at 1024 samples (smallest supported buffer)
        this.audioProcessor = this.audioCtx.createScriptProcessor(1024, 1, 1);
        this.audioProcessor.onaudioprocess = (e) => {
          if (!this.isPCMRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData   = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 32768 : s * 32767;
          }
          this.ws.send(pcmData.buffer);
        };
        source.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioCtx.destination);
        this.log("🚀 Studio PCM Stream active [ScriptProcessor 1024-sample fallback]");
      }

      URL.revokeObjectURL(blobUrl);
      this.isPCMRecording = true;
      this.pcmBtn.innerHTML = "🎙️ Stop Studio PCM AI Stream";
      this.pcmBtn.classList.add("recording");
    } catch(err) {
      this.log(`PCM Error: ${err.message}`);
      alert(`Mic error: ${err.message}`);
    }
  }

  stopPCMStream() {
    this.isPCMRecording = false;
    if (this.audioWorklet)   { try { this.audioWorklet.disconnect(); }   catch(e){} this.audioWorklet   = null; }
    if (this.audioProcessor) { try { this.audioProcessor.disconnect(); } catch(e){} this.audioProcessor = null; }
    if (this.mediaStream)    this.mediaStream.getTracks().forEach(t => t.stop());
    if (this.audioCtx)       { try { this.audioCtx.close(); } catch(e){} this.audioCtx = null; }
    this.pcmBtn.innerHTML = "🎙️ Studio PCM AI Stream (99% Deepgram Nova-2)";
    this.pcmBtn.classList.remove("recording");
    this.log("Studio PCM stream stopped.");
  }

  // =========================================================================
  // Web Speech API Fallback
  // =========================================================================
  initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this.recognition = new SR();
    this.recognition.continuous     = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang           = this.selectedMicLang;

    // ── onstart: clear starting guard, mark as truly active ────────────
    this.recognition.onstart = () => {
      this._recognitionStarting = false;
      this._recognitionActive   = true;
      this.isRecording = true;
      this.micBtn.innerHTML = "🎙️ Stop WebSpeech Stream";
      this.micBtn.classList.add("recording");
      this.log(`WebSpeech active [${this.selectedMicLang}]`);
    };

    // ── onresult: emit EVERY interim token immediately (< 10ms) ────────
    this.recognition.onresult = (event) => {
      if (!this.activeSegmentId) this.activeSegmentId = `seg-${Date.now()}`;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        const isFinal    = event.results[i].isFinal;
        if (!transcript) continue;
        // Stamp send time so student-side can compute end-to-end latency
        this.broadcastMessage({
          type:       isFinal ? "final_caption" : "partial_caption",
          sessionId:  this.sessionId,
          segmentId:  this.activeSegmentId,
          timestamp:  Date.now(),
          status:     isFinal ? "final" : "partial",
          sourceText: transcript
        });
        if (isFinal) this.activeSegmentId = `seg-${Date.now()}`;
      }
    };

    // ── onerror: skip "no-speech" noise, log real errors only ──────────
    this.recognition.onerror = (err) => {
      this._recognitionStarting = false;
      this._recognitionActive   = false;
      if (err.error === "not-allowed" || err.error === "service-not-allowed") {
        this.isRecording = false;
        this.micBtn.innerHTML = "🌐 Web Speech API (Browser Fallback)";
        this.micBtn.classList.remove("recording");
        this.log(`⚠️ WebSpeech permission denied: ${err.error}`);
      } else if (err.error !== "no-speech" && err.error !== "aborted") {
        this.log(`WebSpeech error: ${err.error}`);
      }
    };

    // ── onend: ROCK-SOLID self-healing keep-alive ───────────────────────
    // Guard against:
    //  a) duplicate .start() when onend fires while a new start is already in-flight
    //  b) DOMException if recognition is still in "starting" state
    //  c) calling .start() after the teacher deliberately stopped
    this.recognition.onend = () => {
      this._recognitionActive   = false;
      this._recognitionStarting = false;
      if (!this.isRecording) return;           // teacher stopped — do NOT restart
      // 50ms cool-down before restarting to avoid rapid-fire DOMException loops
      setTimeout(() => {
        if (!this.isRecording || this._recognitionStarting) return;
        try {
          this._recognitionStarting = true;
          this.recognition.start();
        } catch (e) {
          this._recognitionStarting = false;
          if (e.name !== "InvalidStateError") this.log(`WebSpeech restart error: ${e.message}`);
        }
      }, 50);
    };
  }

  // ── Safe internal helper — always use this instead of raw .start() ────
  _startRecognition() {
    if (this._recognitionStarting || this._recognitionActive) return;
    try {
      this._recognitionStarting = true;
      this.recognition.start();
    } catch (e) {
      this._recognitionStarting = false;
      this.log(`WebSpeech start error: ${e.message}`);
    }
  }

  toggleMicStream() {
    if (!this.recognition) return alert("Web Speech API not supported.");
    if (this.isPCMRecording) this.stopPCMStream();
    if (this.isRecording) {
      this.isRecording          = false;
      this._recognitionStarting = false;
      this._recognitionActive   = false;
      try { this.recognition.stop(); } catch(e) {}
      this.micBtn.innerHTML = "🌐 Web Speech API (Browser Fallback)";
      this.micBtn.classList.remove("recording");
    } else {
      this.isRecording = true;
      this.recognition.lang = this.selectedMicLang;
      this._startRecognition();
    }
  }

  sendManualCaption() {
    const text = this.captionInput.value.trim();
    if (!text) return;
    const segmentId = `seg-${Date.now()}`;
    this.broadcastMessage({ type: "partial_caption", sessionId: this.sessionId, segmentId, timestamp: Date.now(), status: "partial", sourceText: text });
    setTimeout(() => {
      this.broadcastMessage({ type: "final_caption",   sessionId: this.sessionId, segmentId, timestamp: Date.now(), status: "final",   sourceText: text });
    }, 50);
    this.log(`[MANUAL] ${text}`);
    this.captionInput.value = "";
  }

  // =========================================================================
  // Subject Management
  // =========================================================================
  async loadSubjects() {
    if (!this.subjectSelect) return;
    try {
      const res  = await fetch('/api/subjects');
      const data = await res.json();
      if (data.success && data.subjects?.length > 0) {
        this.subjectSelect.innerHTML = "";
        data.subjects.forEach(sub => {
          const opt = document.createElement("option");
          opt.value = sub.id; opt.textContent = sub.name;
          this.subjectSelect.appendChild(opt);
        });
        const newOpt = document.createElement("option");
        newOpt.value = "__new__"; newOpt.textContent = "➕ Create New Subject Class...";
        this.subjectSelect.appendChild(newOpt);
        if (this.subjectSelect.options.length > 1) this.sessionId = this.subjectSelect.value;
      }
    } catch(e) { console.log("loadSubjects error:", e); }
  }

  async createNewSubjectClass() {
    const name = this.newSubjectInput?.value?.trim();
    if (!name) return alert("Please enter a subject class name.");
    try {
      const res  = await fetch('/api/create-subject', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, instructor:"Prof. A. Sharma" }) });
      const data = await res.json();
      if (data.success) {
        if (this.newSubjectInput)    this.newSubjectInput.value = "";
        if (this.newSubjectContainer) this.newSubjectContainer.style.display = "none";
        await this.loadSubjects();
        if (this.subjectSelect && data.subject) { this.subjectSelect.value = data.subject.id; this.sessionId = data.subject.id; }
        this.log(`📚 Created: "${data.subject.name}"`);
      } else { alert(data.message); }
    } catch(err) { alert("Error: " + err.message); }
  }

  // =========================================================================
  // WebSocket
  // =========================================================================
  getWebSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host     = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `${window.location.hostname}:5000` : window.location.host;
    return `${protocol}//${host}?role=teacher&sessionId=${this.sessionId}`;
  }

  connectWebSocket() {
    const url = this.getWebSocketUrl();
    this.log(`Connecting: ${url}`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.statusEl.textContent = "📡 LIVE BROADCASTING";
      this.statusEl.style.color = "#10b981";
      this.log("WS connected.");
      // Send catch-up subscribe so server replays any unread doubts missed
      // during disconnect (uses lastDoubtSeq = 0 on first connect, so server
      // always replays all unread doubts from the buffer)
      this.ws.send(JSON.stringify({
        type:               "subscribe",
        role:               "teacher",
        sessionId:          this.sessionId,
        lastSequenceNumber: this._lastDoubtSeq
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Track highest sequence number seen for gap-recovery on reconnect
        if (data.sequenceNumber && data.sequenceNumber > this._lastDoubtSeq) {
          this._lastDoubtSeq = data.sequenceNumber;
        }

        if (data.type === "student_live_doubt") {
          this.addStudentDoubt(data);

        } else if (data.type === "teacher_resolve_doubt") {
          const d = this.doubts.find(x => x.id === data.doubtId);
          if (d) { d.status = "resolved"; this.updateDoubtsUI(); }

        } else if (data.type === "teacher_flag_doubt") {
          const d = this.doubts.find(x => x.id === data.doubtId);
          if (d) { d.status = "flagged"; this.updateDoubtsUI(); }

        } else if (data.type === "connection_ack") {
          this.log(`📡 Room [${data.sessionId}] acknowledged. Seq: ${data.currentSequenceNumber}`);
        }
      } catch(e) {}
    };

    this.ws.onclose = () => {
      this.statusEl.textContent = "⚠️ DISCONNECTED";
      this.statusEl.style.color = "#f43f5e";
      this.log("WS disconnected. Retrying 3s...");
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  broadcastMessage(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // =========================================================================
  // Doubts UI
  // =========================================================================
  addStudentDoubt(data) {
    if (!data || !data.doubtText) return;
    // Deduplicate by id — server replays buffered doubts on reconnect, so the
    // same doubt can arrive twice. Silently skip duplicates without beeping again.
    const isDuplicate = this.doubts.some(d => d.id === data.id);
    if (!isDuplicate) {
      this.doubts.unshift(data);
      this.updateDoubtsUI();
      this.playNotificationBeep();
      this.log(`🔔 NEW DOUBT [${data.id}]: "${data.doubtText}"`);
    } else {
      // Still refresh UI in case status changed (e.g. reconnect replayed resolved doubt)
      this.updateDoubtsUI();
    }
  }

  updateDoubtsUI() {
    // Lazy re-query — guard against any timing edge on initial construction
    const listEl  = this.doubtsList  || document.getElementById("teacher-doubts-list");
    const badgeEl = this.doubtBadge  || document.getElementById("doubt-badge");
    // Cache re-queried refs for future calls
    if (!this.doubtsList  && listEl)  this.doubtsList  = listEl;
    if (!this.doubtBadge  && badgeEl) this.doubtBadge  = badgeEl;
    if (!listEl) return;  // DOM not ready — skip silently

    // ── Update badge counter (works whether modal is open or closed) ────
    const unreadCount = this.doubts.filter(d => d.status === "unread").length;
    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent     = unreadCount;
        badgeEl.style.display   = "flex";
      } else {
        badgeEl.style.display   = "none";
      }
    }

    // ── Render doubts list ───────────────────────────────────────────────
    if (this.doubts.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:30px;font-size:0.88rem;">🔔 No student doubts right now!</div>`;
      return;
    }

    listEl.innerHTML = this.doubts.map(d => {
      const isResolved = d.status === "resolved";
      const isFlagged  = d.status === "flagged";
      const isUnread   = d.status === "unread";
      const timeStr    = new Date(d.timestamp || Date.now()).toLocaleTimeString();
      const bgColor    = isFlagged ? 'rgba(244,63,94,0.1)'   : isResolved ? 'rgba(255,255,255,0.02)' : 'rgba(245,158,11,0.08)';
      const border     = isFlagged ? 'rgba(244,63,94,0.4)'   : isResolved ? 'rgba(255,255,255,0.1)'  : 'rgba(245,158,11,0.3)';
      const textColor  = isFlagged ? '#f43f5e' : isResolved  ? '#94a3b8' : '#f8fafc';
      const labelColor = isFlagged ? '#f43f5e' : '#f59e0b';
      const label      = isFlagged ? '🚩 Flagged' : '🕵️ Anonymous';

      let actionHtml;
      if (isFlagged) {
        actionHtml = `<span style="font-size:0.78rem;color:#f43f5e;font-weight:800;">🚩 Flagged &amp; Reported</span>`;
      } else if (isResolved) {
        actionHtml = `<span style="font-size:0.78rem;color:#10b981;font-weight:800;">✓ Resolved</span>`;
      } else {
        actionHtml = `
          <button onclick="window.teacherApp.resolveDoubt('${d.id}')"
                  style="padding:5px 12px;background:linear-gradient(135deg,#10b981,#059669);color:#000;font-weight:800;border:none;border-radius:7px;font-size:0.78rem;cursor:pointer;">
            ✓ Resolve
          </button>
          <button onclick="window.teacherApp.flagDoubt('${d.id}')"
                  style="padding:5px 12px;background:linear-gradient(135deg,#ef4444,#f43f5e);color:#fff;font-weight:800;border:none;border-radius:7px;font-size:0.78rem;cursor:pointer;">
            🚩 Flag
          </button>`;
      }

      return `<div style="background:${bgColor};border:1px solid ${border};border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:${labelColor};font-size:0.9rem;">${label}</strong>
          <span style="font-size:0.72rem;color:#94a3b8;">${timeStr}</span>
        </div>
        <div style="color:${textColor};font-size:0.85rem;line-height:1.5;">${d.doubtText}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">${actionHtml}</div>
      </div>`;
    }).join("");
  }

  resolveDoubt(doubtId) {
    const d = this.doubts.find(x => x.id === doubtId);
    if (d) d.status = "resolved";
    this.updateDoubtsUI();
    this.broadcastMessage({ type: "teacher_resolve_doubt", sessionId: this.sessionId, doubtId });
  }

  flagDoubt(doubtId) {
    const d = this.doubts.find(x => x.id === doubtId);
    if (d) d.status = "flagged";
    this.updateDoubtsUI();
    this.broadcastMessage({ type: "teacher_flag_doubt", sessionId: this.sessionId, doubtId });
    this.log(`🚩 Doubt [${doubtId}] flagged.`);
  }

  playNotificationBeep() {
    try {
      const ac  = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain= ac.createGain();
      osc.type  = "sine"; osc.frequency.setValueAtTime(587.33, ac.currentTime);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.25);
    } catch(e) {}
  }

  // =========================================================================
  // Screen & Audio Recording (unchanged)
  // =========================================================================
  async toggleLectureRecording() {
    if (this.isScreenRecording) { this.stopLectureRecording(); } else { await this.startLectureRecording(); }
  }

  async startLectureRecording() {
    try {
      this.log("🎥 Requesting screen capture...");
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video:{ displaySurface:"browser", frameRate:{ max:30 } }, audio:true });
      let micStream = null;
      try { micStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } }); } catch(e) {}
      const audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      const audioDest = audioCtx.createMediaStreamDestination();
      let hasAudio    = false;
      if (displayStream.getAudioTracks().length > 0) { audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]])).connect(audioDest); hasAudio = true; }
      if (micStream?.getAudioTracks().length > 0)    { audioCtx.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]])).connect(audioDest);    hasAudio = true; }
      const tracks = [...displayStream.getVideoTracks()];
      if (hasAudio) tracks.push(audioDest.stream.getAudioTracks()[0]);
      this.recordingAudioCtx = audioCtx;
      this.recordingStream   = new MediaStream(tracks);
      displayStream.getVideoTracks()[0].onended = () => this.stopLectureRecording();
      let mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      this.mediaRecorder  = new MediaRecorder(this.recordingStream, { mimeType });
      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = e => { if (e.data?.size > 0) this.recordedChunks.push(e.data); };
      this.mediaRecorder.onstop = () => { this.saveAndDownloadRecording(); this.cleanUpRecordingTracks(); };
      this.mediaRecorder.start(1000);
      this.isScreenRecording = true;
      if (this.recordBtn) { this.recordBtn.innerHTML = "⏹️ Stop Recording"; this.recordBtn.classList.add("recording"); }
      if (this.recordIndicator) this.recordIndicator.style.display = "flex";
      this.log(`🔴 Recording started [${mimeType}]`);
    } catch(err) {
      this.log(`Recording error: ${err.message}`);
      if (err.name !== 'NotAllowedError') alert(`Could not start recording: ${err.message}`);
      this.cleanUpRecordingTracks();
    }
  }

  stopLectureRecording() {
    if (!this.isScreenRecording) return;
    this.isScreenRecording = false;
    if (this.mediaRecorder?.state !== "inactive") this.mediaRecorder.stop();
    if (this.recordBtn) { this.recordBtn.innerHTML = "🔴 Start Recording"; this.recordBtn.classList.remove("recording"); }
    if (this.recordIndicator) this.recordIndicator.style.display = "none";
    this.log("⏹️ Recording stopped.");
  }

  saveAndDownloadRecording() {
    if (!this.recordedChunks?.length) return;
    const blob     = new Blob(this.recordedChunks, { type:'video/webm' });
    const fileName = `Lecture_${this.sessionId}_${Date.now()}.webm`;
    const reader   = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const subId  = this.subjectSelect?.value || this.sessionId || "cs101-recursion";
      const subName= (this.subjectSelect && this.subjectSelect.selectedIndex >= 0) ? this.subjectSelect.options[this.subjectSelect.selectedIndex].text : "General";
      try {
        const r    = await fetch('/api/upload-lecture', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ videoBase64: reader.result, filename: fileName, subjectId: subId, subjectName: subName }) });
        const data = await r.json();
        if (data.success) { this.log(`✅ Uploaded via ${data.uploadMethod}`); alert(`🎉 Lecture uploaded!\n${data.videoUrl}`); }
        else              { this.log(`❌ Upload error: ${data.message}`); }
      } catch(err) { this.log(`❌ Upload exception: ${err.message}`); }
      this.recordedChunks = [];
    };
  }

  cleanUpRecordingTracks() {
    if (this.recordingAudioCtx) { try { this.recordingAudioCtx.close(); } catch(e){} this.recordingAudioCtx = null; }
    if (this.recordingStream)   { this.recordingStream.getTracks().forEach(t => t.stop()); this.recordingStream = null; }
  }

  // =========================================================================
  // Logger
  // =========================================================================
  log(msg) {
    const entry = document.createElement("div");
    entry.className   = "log-entry";
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logBox.appendChild(entry);
    this.logBox.scrollTop = this.logBox.scrollHeight;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.teacherApp = new TeacherControlPanel();
});
