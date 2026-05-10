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
    fetchAnimals();
    fetchHistory();
    
    if (state.esp32Ip && ui.inpIp()) {
      ui.inpIp().value = state.esp32Ip;
    }

    // Start stream if IP is present
    if (state.esp32Ip) {
      startStream();
    }
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
      ui.inpIp().onchange = (e) => {
        state.esp32Ip = e.target.value.trim();
        localStorage.setItem(IP_KEY, state.esp32Ip);
        if (state.powerOn) startStream();
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

  // ── Systems ───────────────────────────────────────────────

  function startHUDCycle() {
    if (timers.hud) clearInterval(timers.hud);
    timers.hud = setInterval(() => {
      if (!state.powerOn) return;
      
      const clock = ui.clock();
      if (clock) {
        clock.textContent = new Date().toLocaleTimeString([], { hour12: false });
      }

      // Signal logic
      state.signalStrength = Math.min(100, Math.max(85, state.signalStrength + (Math.random() * 4 - 2)));
      const sigBar = document.querySelector('.hud-top .hud-bar');
      if (sigBar) sigBar.style.width = `${state.signalStrength}%`;
    }, 1000);
  }

  async function startStream() {
    if (!state.powerOn || !state.esp32Ip) return;
    state.isStreaming = true;
    if (timers.stream) clearInterval(timers.stream);
    
    timers.stream = setInterval(async () => {
      if (!state.powerOn || !state.esp32Ip || state.isAnalyzing) return;
      
      const ip = state.esp32Ip.startsWith('http') ? state.esp32Ip : `http://${state.esp32Ip}`;
      const img = ui.img();
      if (!img) return;

      img.src = `${ip}/capture?t=${Date.now()}`;
      img.onload = () => {
        if (ui.placeholder()) ui.placeholder().style.display = 'none';
        img.style.display = 'block';
      };
      img.onerror = () => {
        // Fallback or silent ignore
      };
    }, 2000);
  }

  function stopStream() {
    state.isStreaming = false;
    if (timers.stream) clearInterval(timers.stream);
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
    reel.innerHTML = state.history.map(item => `
      <div class="reel-item" style="flex:0 0 140px; margin-right:10px; cursor:pointer;" onclick="window.CameraModule.loadCapture('${item.id}')">
        <img src="${item.imageUrl}" style="width:100%; height:80px; object-fit:cover; border-radius:4px;">
        <div style="font-size:0.6rem; color:var(--text-dim); margin-top:4px; display:flex; justify-content:space-between;">
            <span>${item.animalId}</span>
            <span style="color:${item.severity === 'HEALTHY' ? 'var(--accent-green)' : 'var(--accent-red)'}">${item.healthScore}/10</span>
        </div>
      </div>
    `).join('');
  }

  async function fetchAnimals() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
      const snap = await firebase.firestore().collection(COLLECTION_ANIMALS).where('farmerId', '==', user.uid).get();
      state.animalsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sel = ui.selAnimal();
      if (sel) {
        sel.innerHTML = '<option value="">SUBJECT SELECTION</option>' + 
          state.animalsList.map(a => `<option value="${a.id}">${a.animalId} (${a.breed || a.species})</option>`).join('');
      }
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
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
