/**
 * teacher-analysis.js
 * Smart Classroom 2.0 — Teacher Doubt Analysis Dashboard
 *
 * Analyses all anonymously submitted student doubts, clusters them by topic,
 * identifies weak areas, and gives actionable AI recommendations for the teacher.
 */

// =============================================================================
// TOPIC TAXONOMY — keyword clusters mapped to topic labels
// Add more entries here to improve detection coverage.
// =============================================================================
const TOPIC_TAXONOMY = [
  // Data Structures
  { topic: "Linked List",       keywords: ["linked list", "linklist", "node", "pointer", "next pointer", "singly linked", "doubly linked", "circular list", "ll"] },
  { topic: "Recursion",         keywords: ["recursion", "recursive", "base case", "call stack", "stack overflow", "recur", "factorial", "fibonacci"] },
  { topic: "Binary Search Tree", keywords: ["bst", "binary search tree", "binary tree", "inorder", "preorder", "postorder", "tree traversal", "tree node", "leaf node"] },
  { topic: "Stack & Queue",     keywords: ["stack", "queue", "deque", "push", "pop", "enqueue", "dequeue", "lifo", "fifo"] },
  { topic: "Array & Hashing",   keywords: ["array", "hash", "hashmap", "hashtable", "index", "2d array", "matrix", "hashing"] },
  { topic: "Sorting Algorithms", keywords: ["sort", "bubble sort", "merge sort", "quick sort", "insertion sort", "selection sort", "heap sort", "sorting"] },
  { topic: "Graph Theory",      keywords: ["graph", "bfs", "dfs", "directed", "undirected", "adjacency", "shortest path", "dijkstra", "traversal"] },
  { topic: "Dynamic Programming", keywords: ["dp", "dynamic programming", "memoization", "tabulation", "optimal substructure", "overlapping subproblems"] },
  { topic: "Time & Space Complexity", keywords: ["big o", "time complexity", "space complexity", "o(n)", "o(log n)", "o(n^2)", "complexity", "efficient"] },
  { topic: "OOP Concepts",      keywords: ["oops", "oop", "object", "class", "inheritance", "polymorphism", "encapsulation", "abstraction", "interface"] },
  { topic: "Operating System",  keywords: ["os", "operating system", "process", "thread", "deadlock", "scheduling", "memory management", "paging", "semaphore"] },
  { topic: "Database & SQL",    keywords: ["sql", "database", "query", "join", "dbms", "normalization", "primary key", "foreign key", "index"] },
  { topic: "Computer Networks", keywords: ["tcp", "ip", "udp", "http", "dns", "router", "protocol", "network", "socket", "packet", "osi"] },
  { topic: "Pointers & Memory", keywords: ["pointer", "memory", "malloc", "free", "heap", "address", "dereference", "null pointer", "memory leak"] },
  { topic: "Software Engineering", keywords: ["sdlc", "agile", "scrum", "uml", "design pattern", "software engineering", "testing", "ci/cd", "sprint"] },
  { topic: "Bit Manipulation",  keywords: ["bit", "bitwise", "xor", "and", "or", "shift", "binary", "two's complement", "bitmask"] },
  { topic: "Searching Algorithms", keywords: ["binary search", "linear search", "searching", "search algorithm"] },
  { topic: "Function & Scope",  keywords: ["function", "scope", "closure", "callback", "return", "parameter", "argument"] },
];

// Catch-all for doubts that don't match any taxonomy entry
const UNCATEGORIZED = "Other / General";

// =============================================================================
// TOPIC CLASSIFIER
// =============================================================================
function classifyDoubt(doubtText) {
  const lower = doubtText.toLowerCase();
  for (const entry of TOPIC_TAXONOMY) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return entry.topic;
      }
    }
  }
  return UNCATEGORIZED;
}

// =============================================================================
// ANALYSIS ENGINE
// =============================================================================
function analyseDoubts(doubts) {
  const topicCounts = {};
  const topicDoubts = {};
  let resolvedCount = 0;
  let flaggedCount = 0;
  let unreadCount = 0;

  doubts.forEach(d => {
    const topic = classifyDoubt(d.doubtText);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    if (!topicDoubts[topic]) topicDoubts[topic] = [];
    topicDoubts[topic].push(d);

    if (d.status === "resolved") resolvedCount++;
    else if (d.status === "flagged") flaggedCount++;
    else unreadCount++;
  });

  // Sort topics by count descending
  const sorted = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: Math.round((count / doubts.length) * 100),
      doubts: topicDoubts[topic]
    }));

  return { sorted, resolvedCount, flaggedCount, unreadCount, total: doubts.length };
}

// =============================================================================
// AI RECOMMENDATION ENGINE
// =============================================================================
function generateRecommendations(sorted) {
  if (!sorted || sorted.length === 0) return [];
  return sorted.slice(0, 5).map((item, i) => {
    const { topic, count, percentage } = item;
    let urgency = "low";
    let icon = "💡";
    if (percentage >= 40) { urgency = "critical"; icon = "🔴"; }
    else if (percentage >= 20) { urgency = "high"; icon = "🟠"; }
    else if (percentage >= 10) { urgency = "medium"; icon = "🟡"; }

    const tips = {
      "Linked List": "Consider a dedicated revision session with live pointer animation on the whiteboard. Visualize memory addresses and the 'next' pointer chain step-by-step.",
      "Recursion": "Use the 'call tree' visualization. Show how the call stack grows and unwinds. Trace factorial(4) fully on whiteboard.",
      "Binary Search Tree": "Draw BST insert/delete/search live. Ask students to predict outputs before executing.",
      "Stack & Queue": "Demonstrate with real-world analogies: browser Back button (stack), print spooler (queue). Implement in-class.",
      "Array & Hashing": "Show collision handling in hashmaps. Use index visualization on whiteboard.",
      "Sorting Algorithms": "Run step-by-step bubble sort trace on a 5-element array live. Compare complexities visually.",
      "Graph Theory": "Draw adjacency list vs matrix. Trace BFS/DFS with colored markers on whiteboard.",
      "Dynamic Programming": "Start with coin change problem. Show overlapping subproblems by drawing the recursion tree.",
      "Time & Space Complexity": "Explain Big-O with concrete examples: what happens when N doubles? Use a comparison table.",
      "OOP Concepts": "Live coding demo: create a base class Animal with polymorphic speak() method. Show inheritance hierarchy.",
      "Operating System": "Use real-world analogy for deadlock (4 cars at intersection). Diagram Banker's algorithm.",
      "Database & SQL": "Run live SQL queries on a sample table. Show JOIN types with Venn diagrams.",
      "Computer Networks": "Simulate a TCP handshake with 3-step diagram. Trace a browser request end-to-end.",
      "Pointers & Memory": "Draw memory boxes in C. Show what malloc does. Trace pointer arithmetic.",
      "Software Engineering": "Walk through an Agile sprint timeline. Diagram a UML class diagram live.",
      "Bit Manipulation": "Show binary representation of numbers. Trace XOR and left-shift operations manually.",
      "Searching Algorithms": "Compare linear vs binary search on a sorted array with 10 elements live.",
      "Function & Scope": "Show scope chain with nested functions. Trace closure in JavaScript/Python.",
    };

    const tip = tips[topic] || `Dedicate extra revision time to '${topic}'. Add targeted practice problems and invite students to clarify with live examples.`;

    return { rank: i + 1, topic, count, percentage, urgency, icon, tip };
  });
}

// =============================================================================
// BAR CHART SVG RENDERER (inline SVG, no dependencies)
// =============================================================================
function renderBarChart(sorted) {
  if (!sorted || sorted.length === 0) return '<div style="color:#94a3b8; text-align:center; padding:30px;">No data to chart yet.</div>';

  const topN = sorted.slice(0, 10);
  const maxCount = topN[0]?.count || 1;
  const barH = 36;
  const gap = 10;
  const labelW = 200;
  const barAreaW = 320;
  const svgH = topN.length * (barH + gap) + 20;
  const totalW = labelW + barAreaW + 60;

  const COLORS = ["#f43f5e","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#06b6d4","#3b82f6","#a855f7"];

  const bars = topN.map((item, i) => {
    const y = i * (barH + gap) + 10;
    const barW = Math.round((item.count / maxCount) * barAreaW);
    const color = COLORS[i % COLORS.length];
    const label = item.topic.length > 24 ? item.topic.slice(0, 22) + "…" : item.topic;
    return `
      <g>
        <text x="${labelW - 8}" y="${y + barH / 2 + 5}" text-anchor="end" font-size="12" fill="#94a3b8" font-family="Inter,sans-serif">${label}</text>
        <rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" rx="6" fill="${color}" opacity="0.85"/>
        <text x="${labelW + barW + 8}" y="${y + barH / 2 + 5}" font-size="12" fill="#f8fafc" font-family="'JetBrains Mono',monospace" font-weight="700">${item.count} (${item.percentage}%)</text>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${totalW} ${svgH}" style="max-width:640px; display:block; margin:0 auto;">${bars}</svg>`;
}

// =============================================================================
// HEAT SIGNAL DONUT SVG (top 5 topics as a donut)
// =============================================================================
function renderDonut(sorted) {
  if (!sorted || sorted.length === 0) return '';

  const topN = sorted.slice(0, 6);
  const total = topN.reduce((s, t) => s + t.count, 0);
  const COLORS = ["#f43f5e","#f97316","#f59e0b","#22c55e","#3b82f6","#a855f7"];
  const R = 70, CX = 90, CY = 90, INNER = 38;

  let startAngle = -Math.PI / 2;
  let slices = "";
  topN.forEach((item, i) => {
    const angle = (item.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const xi1 = CX + INNER * Math.cos(startAngle);
    const yi1 = CY + INNER * Math.sin(startAngle);
    const xi2 = CX + INNER * Math.cos(endAngle);
    const yi2 = CY + INNER * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    slices += `<path d="M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${INNER} ${INNER} 0 ${largeArc} 0 ${xi1} ${yi1} Z" fill="${COLORS[i]}" opacity="0.9"/>`;
    startAngle = endAngle;
  });

  const legend = topN.map((item, i) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <div style="width:12px;height:12px;border-radius:3px;background:${COLORS[i]};flex-shrink:0;"></div>
      <span style="font-size:0.78rem;color:#cbd5e1;">${item.topic}</span>
      <span style="font-size:0.78rem;color:#f8fafc;font-weight:700;margin-left:auto;">${item.percentage}%</span>
    </div>`).join("");

  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
      <svg width="180" height="180" xmlns="http://www.w3.org/2000/svg">
        ${slices}
        <text x="${CX}" y="${CY + 5}" text-anchor="middle" font-size="13" fill="#f8fafc" font-family="Inter,sans-serif" font-weight="700">${total} Doubts</text>
      </svg>
      <div style="flex:1;min-width:160px;">${legend}</div>
    </div>`;
}

// =============================================================================
// TIMELINE MINI CHART — doubts per hour (last 24h)
// =============================================================================
function renderTimeline(doubts) {
  if (!doubts || doubts.length === 0) return '';
  const now = Date.now();
  const buckets = new Array(24).fill(0);
  doubts.forEach(d => {
    const age = now - (d.timestamp || now);
    const hour = Math.floor(age / 3600000);
    if (hour < 24) buckets[23 - hour]++;
  });
  const max = Math.max(...buckets, 1);
  const W = 480, H = 60, barW = Math.floor(W / 24) - 1;
  const bars = buckets.map((v, i) => {
    const bh = Math.round((v / max) * (H - 10)) + 2;
    return `<rect x="${i * (barW + 1)}" y="${H - bh}" width="${barW}" height="${bh}" rx="2" fill="#38bdf8" opacity="${v > 0 ? 0.8 : 0.15}"/>`;
  }).join("");
  return `
    <div style="margin-top:8px;">
      <div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px;">Doubt frequency — last 24 hours (left = older, right = recent)</div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:500px;">${bars}</svg>
    </div>`;
}

// =============================================================================
// MAIN DASHBOARD RENDER
// =============================================================================
// Resolve the server base URL once at startup.
// If the page is served through the Node server (localhost:5000), use relative paths.
// If opened directly from disk (file://) or another port, point explicitly to port 5000.
const API_BASE = (() => {
  const loc = window.location;
  if ((loc.hostname === "localhost" || loc.hostname === "127.0.0.1") && loc.port === "5000") {
    return "";
  }
  return "https://smart-classroom-platform-1j6d.onrender.com";
})();

class DoubtsAnalysisDashboard {
  constructor() {
    this.doubts         = [];
    this.filteredDoubts = [];
    this.currentSession = "all";
    this.subjects       = [];
    this._serverOk      = true;
    this._retryAttempt  = 0;     // tracks how many consecutive failures
    this._retryTimer    = null;  // so we never schedule two retry loops at once
    this.init();
  }

  async init() {
    await this.loadSubjects();
    const ok = await this.loadDoubts();
    this.bindEvents();
    if (ok) {
      this.render();
    }
    // Steady-state auto-refresh every 15 s (only fires when server is already up)
    setInterval(async () => {
      const ok = await this.loadDoubts();
      if (ok) this.render();
    }, 15000);
  }

  async loadSubjects() {
    try {
      const res  = await fetch(`${API_BASE}/api/subjects`);
      const data = await res.json();
      this.subjects = data.subjects || [];
    } catch(e) {}
  }

  // Returns true on success, false on failure.
  // On failure schedules an exponential-backoff retry that self-heals as soon
  // as the Node server comes online — no manual page refresh needed.
  async loadDoubts() {
    try {
      const url  = this.currentSession === "all"
        ? `${API_BASE}/api/doubts`
        : `${API_BASE}/api/doubts?sessionId=${encodeURIComponent(this.currentSession)}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error("API returned success:false");

      this.doubts         = data.doubts || [];
      this.filteredDoubts = this.doubts;
      this._serverOk      = true;
      this._retryAttempt  = 0;   // reset backoff counter on success

      // Cancel any in-flight retry timer — server is back
      if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }

      this._clearErrorBanner();
      return true;
    } catch(e) {
      this._serverOk = false;
      this._retryAttempt++;

      // Exponential backoff: 3s → 6s → 12s → 24s → capped at 30s
      const delay = Math.min(3000 * Math.pow(2, this._retryAttempt - 1), 30000);
      const secs  = Math.round(delay / 1000);

      this._showPersistentError(
        `⚠️ Cannot connect to server. Make sure the server is running on port 5000. ` +
        `Retrying in ${secs}s… (attempt ${this._retryAttempt})`
      );

      // Schedule self-healing retry — only one timer at a time
      if (!this._retryTimer) {
        this._retryTimer = setTimeout(async () => {
          this._retryTimer = null;
          const ok = await this.loadDoubts();
          if (ok) {
            // Server came back — do a full render immediately
            await this.loadSubjects();
            this.render();
            this.showStatus("✅ Connected to server! Dashboard loaded.", "success");
          }
        }, delay);
      }

      return false;
    }
  }

  bindEvents() {
    const sessionSel = document.getElementById("da-session-filter");
    if (sessionSel) {
      sessionSel.addEventListener("change", async (e) => {
        this.currentSession = e.target.value;
        const ok = await this.loadDoubts();
        if (ok) this.render();
      });
    }

    const refreshBtn = document.getElementById("da-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "⏳ Refreshing…";
        const ok = await this.loadDoubts();
        if (ok) this.render();
        refreshBtn.disabled = false;
        refreshBtn.textContent = "🔄 Refresh";
      });
    }

    const clearBtn = document.getElementById("da-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        if (!confirm("Clear ALL stored doubts" + (this.currentSession !== "all" ? ` for session "${this.currentSession}"` : "") + "? This cannot be undone.")) return;
        try {
          await fetch(`${API_BASE}/api/doubts/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: this.currentSession === "all" ? null : this.currentSession })
          });
        } catch(_) {}
        const ok = await this.loadDoubts();
        if (ok) this.render();
      });
    }

    // Seed demo doubts button
    const seedBtn = document.getElementById("da-seed-btn");
    if (seedBtn) {
      seedBtn.addEventListener("click", () => this.seedDemoDoubts());
    }

    // Populate session filter with subjects
    if (sessionSel && this.subjects.length > 0) {
      this.subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        sessionSel.appendChild(opt);
      });
    }
  }

  // Demo data injection for demo/presentation purposes
  async seedDemoDoubts() {
    const seeds = [
      { session: "cs101-recursion", text: "Sir linked list me node insert kaise karte hain?" },
      { session: "cs101-recursion", text: "Linked list ka traversal samajh nahi aaya" },
      { session: "cs101-recursion", text: "Doubly linked list aur singly linked list me kya difference hai?" },
      { session: "cs101-recursion", text: "Recursion base case kaise define karte hain?" },
      { session: "cs101-recursion", text: "Recursion call stack me kya hota hai?" },
      { session: "cs101-recursion", text: "Binary search tree me insert kaise karte hain?" },
      { session: "cs101-recursion", text: "BST traversal inorder kya hota hai?" },
      { session: "cs101-recursion", text: "Time complexity O(n log n) kaise calculate hoti hai?" },
      { session: "se202-software-engineering", text: "SDLC me agile aur waterfall me kya fark hai?" },
      { session: "se202-software-engineering", text: "OOP me polymorphism ka example kya hai?" },
      { session: "cn301-computer-networks", text: "TCP aur UDP me kya difference hai?" },
      { session: "cn301-computer-networks", text: "DNS kaise kaam karta hai?" },
      { session: "cs101-recursion", text: "Stack overflow kab hota hai recursion me?" },
      { session: "cs101-recursion", text: "Sir mujhe linked list ka pointer samajh nahi aata" },
      { session: "cs101-recursion", text: "Circular linked list kya hoti hai?" },
    ];

    const seedBtn = document.getElementById("da-seed-btn");
    if (seedBtn) { seedBtn.disabled = true; seedBtn.textContent = "⏳ Seeding…"; }

    let seeded = 0;
    for (const seed of seeds) {
      try {
        const resp = await fetch(`${API_BASE}/api/doubts/seed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: seed.session,
            doubtText: seed.text,
            timestamp: Date.now() - Math.floor(Math.random() * 3600000 * 6),
            status: ["unread","resolved","unread","unread","resolved"][Math.floor(Math.random() * 5)]
          })
        });
        if (resp.ok) seeded++;
      } catch(_) {}
    }

    if (seedBtn) { seedBtn.disabled = false; seedBtn.textContent = "🎲 Load Demo Doubts"; }

    const ok = await this.loadDoubts();
    if (ok) {
      this.render();
      this.showStatus(`✅ ${seeded} demo doubts seeded successfully! Dashboard updated.`, "success");
    } else {
      this.showStatus("⚠️ Doubts seeded but could not reload — check server.", "error");
    }
  }

  // Persistent error banner — stays visible until a successful fetch clears it
  _showPersistentError(msg) {
    const el = document.getElementById("da-status-msg");
    if (!el) return;
    el.textContent    = msg;
    el.style.display  = "block";
    el.className      = "da-status error";
    // Do NOT auto-hide — it stays until _clearErrorBanner() is called
  }

  _clearErrorBanner() {
    const el = document.getElementById("da-status-msg");
    if (!el) return;
    el.style.display = "none";
  }

  // Transient status (success / info) — auto-hides after 4s
  showStatus(msg, type = "info") {
    const el = document.getElementById("da-status-msg");
    if (!el) return;
    el.textContent    = msg;
    el.style.display  = "block";
    el.className      = "da-status " + type;
    if (type !== "error") {
      setTimeout(() => { el.style.display = "none"; }, 4000);
    }
  }

  render() {
    const doubts = this.filteredDoubts;
    const analysis = analyseDoubts(doubts);
    const recs = generateRecommendations(analysis.sorted);

    this.renderKPICards(analysis);
    this.renderBarChart(analysis.sorted);
    this.renderDonut(analysis.sorted);
    this.renderTimeline(doubts);
    this.renderRecommendations(recs);
    this.renderWeakTopicsAlert(analysis.sorted);
    this.renderDoubtsList(doubts, analysis.sorted);

    // Update last-refreshed
    const ts = document.getElementById("da-last-refresh");
    if (ts) ts.textContent = new Date().toLocaleTimeString();
  }

  renderKPICards(analysis) {
    const kpiEl = document.getElementById("da-kpi-row");
    if (!kpiEl) return;
    const topTopic = analysis.sorted[0];
    kpiEl.innerHTML = `
      <div class="da-kpi-card">
        <div class="da-kpi-num">${analysis.total}</div>
        <div class="da-kpi-label">Total Doubts Received</div>
      </div>
      <div class="da-kpi-card da-kpi-danger">
        <div class="da-kpi-num">${analysis.unreadCount}</div>
        <div class="da-kpi-label">Pending / Unresolved</div>
      </div>
      <div class="da-kpi-card da-kpi-success">
        <div class="da-kpi-num">${analysis.resolvedCount}</div>
        <div class="da-kpi-label">Resolved by Teacher</div>
      </div>
      <div class="da-kpi-card da-kpi-warn">
        <div class="da-kpi-num">${analysis.sorted.length}</div>
        <div class="da-kpi-label">Unique Topics Detected</div>
      </div>
      <div class="da-kpi-card da-kpi-accent">
        <div class="da-kpi-num" style="font-size:1.1rem;">${topTopic ? topTopic.topic : '—'}</div>
        <div class="da-kpi-label">#1 Struggle Topic (${topTopic ? topTopic.count + ' doubts' : '—'})</div>
      </div>
    `;
  }

  renderBarChart(sorted) {
    const el = document.getElementById("da-bar-chart");
    if (el) el.innerHTML = renderBarChart(sorted);
  }

  renderDonut(sorted) {
    const el = document.getElementById("da-donut");
    if (el) el.innerHTML = renderDonut(sorted);
  }

  renderTimeline(doubts) {
    const el = document.getElementById("da-timeline");
    if (el) el.innerHTML = renderTimeline(doubts);
  }

  renderRecommendations(recs) {
    const el = document.getElementById("da-recommendations");
    if (!el) return;
    if (!recs || recs.length === 0) {
      el.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">No recommendations yet — collect more doubts first.</div>';
      return;
    }
    el.innerHTML = recs.map(r => `
      <div class="da-rec-card da-urgency-${r.urgency}">
        <div class="da-rec-header">
          <span class="da-rec-icon">${r.icon}</span>
          <span class="da-rec-topic">${r.topic}</span>
          <span class="da-rec-count">${r.count} student doubt${r.count > 1 ? 's' : ''} (${r.percentage}%)</span>
          <span class="da-urgency-badge da-urgency-${r.urgency}">${r.urgency.toUpperCase()}</span>
        </div>
        <p class="da-rec-tip">${r.tip}</p>
      </div>
    `).join("");
  }

  renderWeakTopicsAlert(sorted) {
    const el = document.getElementById("da-weak-alert");
    if (!el) return;
    const critical = sorted.filter(t => t.percentage >= 20 && t.topic !== UNCATEGORIZED);
    if (critical.length === 0) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.innerHTML = `
      <div class="da-alert-title">🚨 Bachon Ko Ye Topics Samajh Nahi Aaye (Critical Weak Areas)</div>
      <div class="da-alert-tags">
        ${critical.map(t => `<span class="da-topic-tag">${t.topic} — ${t.count} doubts</span>`).join("")}
      </div>
      <div class="da-alert-note">In topics pe zyada time spend karen — live demonstration, extra practice questions, ya ek revision class schedule karen.</div>
    `;
  }

  renderDoubtsList(doubts, sorted) {
    const el = document.getElementById("da-doubts-table");
    if (!el) return;
    if (doubts.length === 0) {
      el.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:30px; font-size:0.88rem;">No doubts recorded yet. Once students send doubts, they appear here.</div>';
      return;
    }
    // Sort by timestamp descending
    const sorted_doubts = [...doubts].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    el.innerHTML = sorted_doubts.map(d => {
      const topic = classifyDoubt(d.doubtText);
      const time = d.timestamp ? new Date(d.timestamp).toLocaleString('en-IN') : '—';
      const statusColor = d.status === "resolved" ? "#10b981" : d.status === "flagged" ? "#f43f5e" : "#f59e0b";
      const statusLabel = d.status === "resolved" ? "✓ Resolved" : d.status === "flagged" ? "🚩 Flagged" : "⏳ Pending";
      return `
        <div class="da-doubt-row">
          <div class="da-doubt-meta">
            <span class="da-doubt-topic-tag">${topic}</span>
            <span style="font-size:0.72rem; color:#64748b;">${time}</span>
            <span style="font-size:0.72rem; font-weight:700; color:${statusColor};">${statusLabel}</span>
          </div>
          <div class="da-doubt-text">💬 ${d.doubtText}</div>
        </div>`;
    }).join("");
  }
}

// Seed endpoint (add to server too if not present)
// (The seeding is handled client-side using server API)

document.addEventListener("DOMContentLoaded", () => {
  window.dashboardApp = new DoubtsAnalysisDashboard();
});
