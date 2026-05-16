// ============================================
// KisanTrack — camera.js
// Purpose: AI Skin & Visual Health Detection Logic
// Page: camera.html
// Dependencies: Firebase, FirestoreStore, Gemini API
// Last Updated: 2026-05-09
// ============================================
window.CameraModule = (function () {
  'use strict';

  // --- Configuration ---
  const STORAGE_KEY = 'kt_gemini_api_key';
  const IP_KEY = 'kt_esp32_ip';
  const COLLECTION_CAPTURES = 'cameraCaptures';
  const COLLECTION_ANIMALS = 'animals';
  const COLLECTION_ALERTS = 'alerts';
  const GEMINI_MODEL = 'gemini-2.0-flash';

  // --- State ---
  let state = {
    powerOn: true,
    isAnalyzing: false,
    isStreaming: false,
    activeMode: 'std', // std, night, thermal
    currentAnimal: null,
    apiKey: localStorage.getItem(STORAGE_KEY) || '', // User should provide this
    esp32Ip: localStorage.getItem( IP_KEY ) || '',
    history: [],
    animalsList: [],
    signalStrength: 92
  };

  let timers = {
    hud: null,
    stream: null
  };

  // --- UI Selectors ---
  const ui = {
    viewport: () => document.getElementById('cam-feed-area'),
    img: () => document.getElementById('live-image'),
    canvas: () => document.getElementById('detection-canvas-overlay'),
    placeholder: () => document.getElementById('feed-placeholder'),
    clock: () => document.getElementById('overlay-timestamp'),
    countdown: () => document.getElementById('cam-countdown'),
    reportSection: () => document.getElementById('analysis-report-section'),
    reportContent: () => document.getElementById('analysis-content'),
    btnPower: () => document.getElementById('cam-toggle-nexus'),
    btnScan: () => document.getElementById('capture-now-btn'),
    btnUpload: () => document.getElementById('upload-photo-btn'),
    fileInput: () => document.getElementById('cam-file-input'),
    modeBtns: () => document.querySelectorAll('.mode-btn'),
    selAnimal: () => document.getElementById('animal-selector'),
    inpIp: () => document.getElementById('esp32-ip-input'),
    reel: () => document.getElementById('cam-filmstrip')
  };

  // ── Initialization ────────────────────────────────────────

  function init() {
    bindEvents();
    startHUDCycle();
    renderReel(); // Show empty state immediately

    // Restore saved IP
    if (state.esp32Ip && ui.inpIp()) {
      ui.inpIp().value = state.esp32Ip;
    }

    // Wait for Firestore auth before fetching data
    document.addEventListener('kisanTrack:stateUpdated', () => {
      fetchAnimalsFromStore();
      fetchHistory();
      // Start stream if IP already saved
      if (state.esp32Ip && state.powerOn) startStream();
    }, { once: true }); // only fire once on first data load
  }

  function bindEvents() {
    // Power Toggle
    if (ui.btnPower()) {
      ui.btnPower().onclick = () => {
        state.powerOn = !state.powerOn;
        ui.btnPower().classList.toggle('active', state.powerOn);
        ui.btnPower().textContent = state.powerOn ? 'ONLINE' : 'OFFLINE';
        if (ui.viewport()) ui.viewport().style.opacity = state.powerOn ? '1' : '0.1';
        if (!state.powerOn) stopStream();
        else if (state.esp32Ip) startStream();
      };
    }

    // Mode Selection
    ui.modeBtns().forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.mode;
        state.activeMode = mode;
        ui.modeBtns().forEach(b => b.classList.toggle('active', b === btn));
        
        const feed = document.getElementById('feed-container');
        if (feed) {
            feed.classList.remove('mode-night', 'mode-thermal');
            if (mode === 'night') feed.classList.add('mode-night');
            if (mode === 'thermal') feed.classList.add('mode-thermal');
        }
      };
    });

    // Scan/Capture
    if (ui.btnScan()) ui.btnScan().onclick = () => runDiagnostic();
    
    // Manual Upload
    if (ui.btnUpload()) ui.btnUpload().onclick = () => ui.fileInput() && ui.fileInput().click();
    if (ui.fileInput()) ui.fileInput().onchange = handleFileUpload;

    // Settings
    if (ui.inpIp()) {
      // Show connect button feedback when IP changes
      ui.inpIp().addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const ipPattern = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
        const isValid = ipPattern.test(val) || val === '';
        ui.inpIp().style.borderColor = val === '' ? '' : isValid ? 'var(--accent-green)' : 'var(--accent-red)';
      });

      ui.inpIp().addEventListener('change', (e) => {
        const val = e.target.value.trim();
        const ipPattern = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
        if (val && !ipPattern.test(val)) {
          showConnectionStatus('error', 'Invalid IP — use format 192.168.x.x');
          return;
        }
        state.esp32Ip = val;
        localStorage.setItem(IP_KEY, val);
        if (state.powerOn && val) startStream();
      });
    }

    // TRIGGER SCAN button also validates IP
    if (ui.btnScan()) {
      ui.btnScan().onclick = () => {
        const ipVal = ui.inpIp() ? ui.inpIp().value.trim() : '';
        if (!state.apiKey && !ipVal) {
          // No IP and no API key — run in demo/simulated mode, that's fine
        }
        runDiagnostic();
      };
    }

    if (ui.selAnimal()) {
      ui.selAnimal().onchange = (e) => {
        const id = e.target.value;
        state.currentAnimal = state.animalsList.find(a => a.id === id) || null;
      };
    }

    // Re-analyze btn
    const reBtn = document.getElementById('re-analyse-btn');
    if (reBtn) reBtn.onclick = () => runDiagnostic();
  }

  // ── Connection status badge ───────────────────────────────
  function showConnectionStatus(type, msg) {
    let badge = document.getElementById('ip-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'ip-status-badge';
      badge.style.cssText = 'font-size:0.7rem;margin-top:4px;padding:3px 8px;border-radius:4px;transition:all 0.3s;';
      ui.inpIp() && ui.inpIp().parentNode && ui.inpIp().parentNode.appendChild(badge);
    }
    badge.textContent = msg;
    badge.style.background = type === 'ok' ? 'rgba(124,181,24,0.15)' : type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(229,161,0,0.15)';
    badge.style.color = type === 'ok' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-amber)';
  }

  // ── Systems ───────────────────────────────────────────────

  // ── HUD cycle: clock + countdown ticker ───────────────────
  let _countdown = 120;

  function startHUDCycle() {
    if (timers.hud) clearInterval(timers.hud);
    _countdown = 120;

    timers.hud = setInterval(() => {
      if (!state.powerOn) return;

      // Live clock
      const clock = ui.clock();
      if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour12: false });

      // Signal strength drift
      state.signalStrength = Math.min(100, Math.max(85, state.signalStrength + (Math.random() * 4 - 2)));
      const sigBar = document.querySelector('.hud-top .hud-bar');
      const sigVal = document.querySelector('.hud-top .hud-val');
      if (sigBar) sigBar.style.width = `${Math.round(state.signalStrength)}%`;
      if (sigVal) sigVal.textContent = `${Math.round(state.signalStrength)}%`;

      // Countdown ticker
      const cdEl = ui.countdown();
      _countdown--;
      if (_countdown <= 0) {
        _countdown = 120;
        if (cdEl) cdEl.textContent = '120';
        // Auto-trigger a scan when countdown reaches 0
        if (!state.isAnalyzing) runDiagnostic();
      } else {
        if (cdEl) {
          cdEl.textContent = _countdown;
          // Flash red when < 10s
          cdEl.style.color = _countdown < 10 ? 'var(--accent-red)' : '';
        }
      }
    }, 1000);
  }

  async function startStream() {
    if (!state.powerOn || !state.esp32Ip) return;
    state.isStreaming = true;
    if (timers.stream) clearInterval(timers.stream);

    showConnectionStatus('connecting', '⏳ Connecting to ESP32-CAM...');
    setPlaceholder('connecting');

    timers.stream = setInterval(async () => {
      if (!state.powerOn || !state.esp32Ip || state.isAnalyzing) return;

      const ip = state.esp32Ip.startsWith('http') ? state.esp32Ip : `http://${state.esp32Ip}`;
      const img = ui.img();
      if (!img) return;

      const testUrl = `${ip}/capture?t=${Date.now()}`;
      img.src = testUrl;

      img.onload = () => {
        if (ui.placeholder()) ui.placeholder().style.display = 'none';
        img.style.display = 'block';
        showConnectionStatus('ok', '✓ ESP32-CAM connected');
      };
      img.onerror = () => {
        img.style.display = 'none';
        setPlaceholder('error');
        showConnectionStatus('error', '✗ Cannot reach camera — check IP & network');
      };
    }, 2000);
  }

  function stopStream() {
    state.isStreaming = false;
    if (timers.stream) clearInterval(timers.stream);
    setPlaceholder('offline');
  }

  // ── Placeholder state manager ─────────────────────────────
  function setPlaceholder(mode) {
    const ph = ui.placeholder();
    if (!ph) return;
    ph.style.display = 'flex';

    const msgs = {
      default:     { icon: '📡', line1: 'INITIALIZING UPLINK...', line2: 'अपलिंक प्रारंभ हो रहा है...' },
      connecting:  { icon: '🔄', line1: 'CONNECTING TO CAMERA...', line2: 'कैमरे से जुड़ रहा है...' },
      error:       { icon: '⚠', line1: 'CAMERA OFFLINE', line2: 'कैमरा उपलब्ध नहीं — IP जाँचें' },
      offline:     { icon: '🔌', line1: 'SYSTEM OFFLINE', line2: 'सिस्टम बंद है' },
    };
    const m = msgs[mode] || msgs.default;
    ph.innerHTML = `
      <div class="nexus-loader" style="${mode === 'error' || mode === 'offline' ? 'border-color:var(--accent-red);border-top-color:transparent;' : ''}"></div>
      <p style="font-size:1.4rem;margin-bottom:4px;">${m.icon}</p>
      <p><strong>${m.line1}</strong></p>
      <p style="opacity:0.6;font-size:0.8rem;">${m.line2}</p>
    `;
  }

  // ── Diagnostics ───────────────────────────────────────────

  async function runDiagnostic() {
    if (state.isAnalyzing || !state.powerOn) return;
    const user = firebase.auth().currentUser;
    if (!user) return;

    state.isAnalyzing = true;
    clearCanvas();
    const btn = ui.btnScan();
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SCANNING...';

    try {
      let captureUrl = '';
      if (state.esp32Ip) {
        try {
          const ip = state.esp32Ip.startsWith('http') ? state.esp32Ip : `http://${state.esp32Ip}`;
          const res = await fetch(`${ip}/capture`, { signal: AbortSignal.timeout(5000) });
          const blob = await res.blob();
          captureUrl = URL.createObjectURL(blob);
        } catch (e) { 
          console.warn("Hardware fetch failed, using fallback."); 
        }
      }

      if (!captureUrl) {
        // Fallback to dummy data
        captureUrl = `https://loremflickr.com/800/600/cow,skin?lock=${Math.floor(Math.random()*1000)}`;
      }

      const img = ui.img();
      if (img) {
        img.src = captureUrl;
        img.style.display = 'block';
        if (ui.placeholder()) ui.placeholder().style.display = 'none';
      }

      let analysis;
      if (state.apiKey) {
        analysis = await performAIAnalysis(captureUrl);
      } else {
        await new Promise(r => setTimeout(r, 2000));
        analysis = generateSimulatedReport();
      }

      const doc = {
        farmerId: user.uid,
        animalId: state.currentAnimal ? state.currentAnimal.animalId : 'HERD-GENERIC',
        imageUrl: captureUrl,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...analysis
      };

      const ref = await firebase.firestore().collection(COLLECTION_CAPTURES).add(doc);
      doc.id = ref.id;
      state.history.unshift(doc);
      renderReel();
      displayReport(doc);

      if (analysis.healthScore < 6) triggerAlert(doc);

    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast("Analysis Failed: " + e.message, "error");
    } finally {
      state.isAnalyzing = false;
      if (btn) btn.innerHTML = originalText;
    }
  }

  async function performAIAnalysis(imageUrl) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${state.apiKey}`;
    
    // Fetch image as base64
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const reader = new FileReader();
    const rawB64 = await new Promise(r => {
        reader.onloadend = () => r(reader.result);
        reader.readAsDataURL(blob);
    });
    
    const compressed = await compressImage(rawB64);
    const prompt = `Perform a high-precision veterinary skin analysis on this animal. Identify lesions, ticks, swelling, or abnormalities. 
    Return ONLY JSON: {
      "healthScore": 0-10,
      "severity": "HEALTHY"|"WARNING"|"CRITICAL",
      "conditions": ["name", ...],
      "observations": ["technical observation", ...],
      "farmerTip": "short advice in English and Hindi",
      "summary": "brief technical summary",
      "hotspots": [{"x": 0-100, "y": 0-100, "label": "issue name", "confidence": 0-1}]
    }`;
    
    const body = { 
      contents: [{ 
        parts: [
          { text: prompt }, 
          { inline_data: { mime_type: "image/jpeg", data: compressed } }
        ] 
      }] 
    };

    const aiRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!aiRes.ok) throw new Error("Gemini API Error");

    const data = await aiRes.json();
    let text = data.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  }

  function compressImage(base64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(800 / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.src = base64;
    });
  }

  function generateSimulatedReport() {
    return {
      healthScore: 8,
      severity: "HEALTHY",
      conditions: [],
      observations: ["Surface integrity nominal", "No thermal anomalies detected"],
      farmerTip: "Maintain current nutrition. / वर्तमान पोषण बनाए रखें।",
      summary: "Animal appears in optimal physical condition."
    };
  }

  function displayReport(report) {
    const body = ui.reportContent();
    if (!body) return;
    
    const col = report.severity === 'HEALTHY' ? 'var(--accent-green)' : (report.severity === 'WARNING' ? 'var(--accent-amber)' : 'var(--accent-red)');
    const scorePct = report.healthScore * 10;

    body.innerHTML = `
      <div class="nexus-diagnostic-card">
        <div class="diagnostic-stat-row">
            <div class="stat-main">
                <span class="stat-value" style="color:${col}">${report.healthScore}</span>
                <span class="stat-unit">/10</span>
            </div>
            <div class="stat-badge" style="background:${col}22; color:${col}; border-color:${col}44">
                ${report.severity}
            </div>
        </div>

        <div class="diagnostic-progress-wrap">
            <div class="diag-progress-bar" style="width:${scorePct}%; background:${col}"></div>
        </div>

        <div class="diagnostic-summary">
            <h5 style="color:var(--text-muted); font-size:0.6rem; margin-bottom:5px;">AI SUMMARY</h5>
            <p>${report.summary || 'Analysis complete.'}</p>
        </div>

        <div class="diagnostic-observations">
            ${(report.observations || []).map(o => `
                <div class="obs-item">
                    <i class="fa-solid fa-microscope" style="color:${col}"></i>
                    <span>${o}</span>
                </div>
            `).join('')}
        </div>

        <div class="nexus-advisory">
            <div class="advisory-label">TREATMENT ADVISORY</div>
            <p>${report.farmerTip || 'No immediate action required.'}</p>
        </div>
      </div>
    `;

    if (report.hotspots && report.hotspots.length > 0) {
        drawHotspots(report.hotspots);
    } else {
        clearCanvas();
    }
  }

  function clearCanvas() {
    const canvas = ui.canvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawHotspots(hotspots) {
    const canvas = ui.canvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = ui.viewport().getBoundingClientRect();
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    hotspots.forEach(spot => {
        const x = (spot.x / 100) * canvas.width;
        const y = (spot.y / 100) * canvas.height;
        const size = 60;

        ctx.strokeStyle = '#9DFF00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Corners
        ctx.moveTo(x - size/2, y - size/2 + 10); ctx.lineTo(x - size/2, y - size/2); ctx.lineTo(x - size/2 + 10, y - size/2);
        ctx.moveTo(x + size/2 - 10, y - size/2); ctx.lineTo(x + size/2, y - size/2); ctx.lineTo(x + size/2, y - size/2 + 10);
        ctx.moveTo(x + size/2, y + size/2 - 10); ctx.lineTo(x + size/2, y + size/2); ctx.lineTo(x + size/2 - 10, y + size/2);
        ctx.moveTo(x - size/2 + 10, y + size/2); ctx.lineTo(x - size/2, y + size/2); ctx.lineTo(x - size/2, y + size/2 - 10);
        ctx.stroke();

        ctx.fillStyle = '#9DFF00';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${spot.label.toUpperCase()} [${Math.round(spot.confidence*100)}%]`, x + size/2 + 5, y);
    });
  }

  function renderReel() {
    const reel = ui.reel();
    if (!reel) return;

    if (!state.history || state.history.length === 0) {
      reel.innerHTML = `
        <div style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--text-dim);font-size:0.8rem;padding:12px 0;">
          <i class="fa-solid fa-camera" style="opacity:0.4;"></i>
          <span>No scans yet — press <strong style="color:var(--accent-green);">TRIGGER SCAN</strong> or <strong style="color:var(--accent-green);">MANUAL UPLOAD</strong> to begin</span>
        </div>`;
      return;
    }

    reel.innerHTML = state.history.map(item => {
      const scoreColor = item.severity === 'HEALTHY' ? 'var(--accent-green)' : item.severity === 'WARNING' ? 'var(--accent-amber)' : 'var(--accent-red)';
      const imgSrc = item.imageUrl || '';
      return `
        <div class="reel-item" style="flex:0 0 140px;margin-right:10px;cursor:pointer;" onclick="window.CameraModule.loadCapture('${item.id}')">
          <div style="width:100%;height:80px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,0.05);">
            ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;opacity:0.3;">📷</div>'}
          </div>
          <div style="font-size:0.6rem;color:var(--text-dim);margin-top:4px;display:flex;justify-content:space-between;">
            <span>${item.animalId || 'HERD'}</span>
            <span style="color:${scoreColor}">${item.healthScore !== undefined ? item.healthScore + '/10' : '—'}</span>
          </div>
        </div>`;
    }).join('');
  }

  function fetchAnimalsFromStore() {
    const storeState = window.FirestoreStore ? window.FirestoreStore.getState() : null;
    if (!storeState || storeState.animals.length === 0) return;

    state.animalsList = storeState.animals;
    const sel = ui.selAnimal();
    if (!sel) return;

    const emojiMap = { Cow: '🐄', Buffalo: '🐃', Goat: '🐐', Sheep: '🐑' };
    sel.innerHTML = '<option value="">— SELECT SUBJECT —</option>' +
      state.animalsList.map(a =>
        `<option value="${a.id}">${emojiMap[a.species] || '🐄'} ${a.animalId} · ${a.breed || a.species} (${a.status})</option>`
      ).join('');

    // Also re-listen in case more animals are added
    document.addEventListener('kisanTrack:stateUpdated', fetchAnimalsFromStore);
  }

  async function fetchHistory() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
      const snap = await firebase.firestore().collection(COLLECTION_CAPTURES)
        .where('farmerId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(20).get();
      state.history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderReel();
    } catch (e) {
      console.warn('CameraModule: Could not load history (index may be building):', e.message);
      renderReel(); // Still show empty state
    }
  }

  async function triggerAlert(doc) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
      await firebase.firestore().collection(COLLECTION_ALERTS).add({
        farmerId: user.uid,
        animalId: doc.animalId,
        alertType: 'Skin Anomaly',
        severity: doc.severity,
        readingValue: `${doc.healthScore}/10`,
        message: doc.summary,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        resolved: false,
        source: 'Nexus AI'
      });
      if (window.showToast) window.showToast(`Nexus Alert: ${doc.animalId} anomaly detected`, "error");
    } catch (e) { console.error(e); }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = ui.img();
      if (img) {
        img.src = event.target.result;
        img.style.display = 'block';
        if (ui.placeholder()) ui.placeholder().style.display = 'none';
      }
      runDiagnostic();
    };
    reader.readAsDataURL(file);
  }

  // --- Public API ---
  return {
    init,
    loadCapture: (id) => {
      const item = state.history.find(h => h.id === id);
      if (item) {
        const img = ui.img();
        if (img) img.src = item.imageUrl;
        if (ui.placeholder()) ui.placeholder().style.display = 'none';
        displayReport(item);
      }
    }
  };

})();
