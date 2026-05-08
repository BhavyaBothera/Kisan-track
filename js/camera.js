/**
 * ============================================================
 * KisanTrack — AI Camera Monitor Module (camera.js)
 * Mission Control Visual Health Detection System
 * ============================================================
 */
window.CameraModule = (function () {
  'use strict';

  // --- Configuration ---
  const DEFAULT_INTERVAL = 120;
  const STORAGE_KEY = 'kt_gemini_api_key';
  const COLLECTION_CAPTURES = 'cameraCaptures';
  const COLLECTION_ANIMALS = 'animals';
  const COLLECTION_ALERTS = 'alerts';

  // --- State ---
  let state = {
    cameraOn: true,
    autoAnalysis: true,
    interval: DEFAULT_INTERVAL,
    countdown: DEFAULT_INTERVAL,
    isAnalyzing: false,
    currentAnimal: null,
    apiKey: localStorage.getItem(STORAGE_KEY) || '',
    history: [],
    animalsList: []
  };

  let timers = {
    countdown: null,
    scan: null
  };

  // --- UI Elements ---
  const ui = {
    // Settings
    togCam: () => document.getElementById('cam-toggle'),
    lblStatus: () => document.getElementById('cam-status-label'),
    inpInterval: () => document.getElementById('capture-interval-input'),
    selAnimal: () => document.getElementById('animal-selector'),
    togAuto: () => document.getElementById('auto-analysis-toggle'),
    inpLoc: () => document.getElementById('cam-location-input'),
    btnKeyChip: () => document.getElementById('api-key-chip'),
    lblKeyText: () => document.getElementById('api-key-text'),

    // Feed Area
    feedArea: () => document.getElementById('cam-feed-area'),
    imgLive: () => document.getElementById('live-image'),
    canvasOverlay: () => document.getElementById('detection-canvas-overlay'),
    placeholder: () => document.getElementById('feed-placeholder'),
    lblCountdown: () => document.getElementById('cam-countdown'),
    overlayAnimal: () => document.getElementById('overlay-animal-id'),
    overlayTime: () => document.getElementById('overlay-timestamp'),
    flash: () => document.getElementById('cam-flash'),

    // Buttons
    btnCapture: () => document.getElementById('capture-now-btn'),
    btnUpload: () => document.getElementById('upload-photo-btn'),
    fileInput: () => document.getElementById('cam-file-input'),
    btnReAnalyse: () => document.getElementById('re-analyse-btn'),

    // Status Panel
    boxAnimalInfo: () => document.getElementById('current-animal-info'),
    boxAnalysisSummary: () => document.getElementById('analysis-summary'),
    lblAutoAIStatus: () => document.getElementById('auto-ai-status'),

    // Analysis Report
    reportSection: () => document.getElementById('analysis-report-section'),
    reportContent: () => document.getElementById('analysis-content'),
    keyPrompt: () => document.getElementById('gemini-key-prompt'),
    inpPromptKey: () => document.getElementById('gemini-prompt-input'),
    btnSavePrompt: () => document.getElementById('save-prompt-key'),

    // History
    filmstrip: () => document.getElementById('cam-filmstrip'),

    // Guide
    guideToggle: () => document.getElementById('guide-toggle'),
    guideContent: () => document.getElementById('guide-content'),

    // Key Modal
    modalOverlay: () => document.getElementById('api-modal-overlay'),
    modalInput: () => document.getElementById('gemini-modal-input'),
    btnSaveModal: () => document.getElementById('save-modal-key')
  };

  // ── Initialization ────────────────────────────────────────

  function init() {
    console.log("Initializing Camera Module...");
    bindEvents();
    loadApiKey();
    fetchAnimals();
    fetchHistory();
    startCountdown();
    
    // Initial UI state
    updateKeyUI();
    
    // If user changes, refresh
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        fetchAnimals();
        fetchHistory();
      }
    });
  }

  function bindEvents() {
    ui.togCam().onchange = (e) => {
      state.cameraOn = e.target.checked;
      ui.lblStatus().textContent = state.cameraOn ? 'ON' : 'OFF';
      ui.lblStatus().style.color = state.cameraOn ? 'var(--accent-green)' : 'var(--text-dim)';
    };

    ui.inpInterval().onchange = (e) => {
      let val = parseInt(e.target.value);
      if (val < 30) val = 30;
      if (val > 600) val = 600;
      state.interval = val;
      state.countdown = val;
      ui.inpInterval().value = val;
    };

    ui.selAnimal().onchange = (e) => {
      const animalId = e.target.value;
      state.currentAnimal = state.animalsList.find(a => a.id === animalId) || null;
      updateAnimalDisplay();
    };

    ui.togAuto().onchange = (e) => {
      state.autoAnalysis = e.target.checked;
      ui.lblAutoAIStatus().innerHTML = state.autoAnalysis ? 
        '<i class="fa-solid fa-robot"></i> Auto-analysis: Active' : 
        '<i class="fa-solid fa-robot"></i> Auto-analysis: Disabled';
    };

    ui.btnCapture().onclick = () => doCapture();
    ui.btnReAnalyse().onclick = () => doCapture(true); // Force analysis

    ui.btnSavePrompt().onclick = () => saveApiKey(ui.inpPromptKey().value);
    ui.btnSaveModal().onclick = () => saveApiKey(ui.modalInput().value);

    ui.guideToggle().onclick = () => {
      ui.guideContent().classList.toggle('active');
      ui.guideToggle().querySelector('.fa-chevron-down').style.transform = 
        ui.guideContent().classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    // Upload simulation
    ui.btnUpload().onclick = () => ui.fileInput().click();
    ui.fileInput().onchange = handleFileUpload;
  }

  // ── API Key Management ────────────────────────────────────

  function loadApiKey() {
    state.apiKey = localStorage.getItem(STORAGE_KEY) || '';
    updateKeyUI();
  }

  function saveApiKey(key) {
    if (!key) return;
    state.apiKey = key;
    localStorage.setItem(STORAGE_KEY, key);
    updateKeyUI();
    ui.modalOverlay().classList.remove('active');
    ui.keyPrompt().style.display = 'none';
    if (window.utils && window.utils.showToast) {
      window.utils.showToast("API Key Connected / API कुंजी जुड़ गयी", "success");
    }
  }

  function updateKeyUI() {
    const hasKey = !!state.apiKey;
    const chip = ui.btnKeyChip();
    const prompt = ui.keyPrompt();
    const keyText = ui.lblKeyText();

    if (hasKey) {
      chip.classList.add('connected');
      keyText.textContent = "API Connected";
      prompt.style.display = 'none';
    } else {
      chip.classList.remove('connected');
      keyText.textContent = "Add API Key";
      prompt.style.display = 'flex';
    }
  }

  // ── Logic ─────────────────────────────────────────────────

  async function fetchAnimals() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      const snap = await firebase.firestore().collection(COLLECTION_ANIMALS)
        .where('farmerId', '==', user.uid)
        .get();

      state.animalsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const sel = ui.selAnimal();
      sel.innerHTML = '<option value="">Select Animal / पशु चुनें</option>';
      state.animalsList.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.id} (${a.breed || a.species})`;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error("Error fetching animals:", e);
    }
  }

  async function fetchHistory() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      const snap = await firebase.firestore().collection(COLLECTION_CAPTURES)
        .where('farmerId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      state.history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderFilmstrip();
    } catch (e) {
      console.error("Error fetching history:", e);
    }
  }

  function startCountdown() {
    if (timers.countdown) clearInterval(timers.countdown);
    timers.countdown = setInterval(() => {
      if (!state.cameraOn || state.isAnalyzing) return;
      
      state.countdown--;
      if (state.countdown <= 0) {
        doCapture();
        state.countdown = state.interval;
      }
      ui.lblCountdown().textContent = state.countdown;
    }, 1000);
  }

  async function doCapture(forceAnalysis = false) {
    if (!state.cameraOn && !forceAnalysis) return;
    
    const user = firebase.auth().currentUser;
    if (!user) return;

    state.isAnalyzing = true;
    showFlash();
    ui.feedArea().classList.add('scanning');
    
    // Simulate getting image from ESP32-CAM (Demo mode)
    // In real app, this would be a fetch to ESP32 local IP or a Cloud Function
    const demoImg = `https://loremflickr.com/800/600/cow,farm?lock=${Math.floor(Math.random() * 1000)}`;
    
    ui.imgLive().src = demoImg;
    ui.imgLive().style.display = 'block';
    ui.placeholder().style.display = 'none';
    
    ui.overlayTime().textContent = `Captured: ${new Date().toLocaleTimeString()}`;
    ui.overlayAnimal().textContent = state.currentAnimal ? `🐄 ${state.currentAnimal.id}` : '🐄 Surveillance Mode';

    // AI Analysis
    if (state.autoAnalysis || forceAnalysis) {
      await runAIAnalysis(demoImg);
    } else {
      state.isAnalyzing = false;
      ui.feedArea().classList.remove('scanning');
    }
  }

  async function runAIAnalysis(imageUrl) {
    ui.reportContent().innerHTML = `
      <div class="analysis-loading" style="grid-column: span 3; padding: 40px; text-align:center;">
        <div class="analysis-spinner"></div>
        <p style="margin-top:20px; color:var(--text-muted);">Gemini AI is examining skin patterns... / जेमिनी एआई त्वचा के नमूनों की जांच कर रहा है...</p>
      </div>
    `;

    try {
      const user = firebase.auth().currentUser;
      let analysis;

      if (state.apiKey) {
        // REAL GEMINI CALL
        analysis = await callGeminiREST(imageUrl);
      } else {
        // SIMULATED ANALYSIS
        await new Promise(r => setTimeout(r, 2000));
        analysis = generateSimulatedReport();
      }

      // Save to Firestore
      const captureData = {
        farmerId: user.uid,
        animalId: state.currentAnimal ? state.currentAnimal.id : 'Herd-01',
        imageUrl: imageUrl,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ...analysis
      };

      const docRef = await firebase.firestore().collection(COLLECTION_CAPTURES).add(captureData);
      captureData.id = docRef.id;

      // Update state & UI
      state.history.unshift(captureData);
      renderFilmstrip();
      renderReport(captureData);

      // Trigger Alert if critical
      if (analysis.healthScore < 6) {
        triggerHealthAlert(captureData);
      }

    } catch (e) {
      console.error("AI Analysis Failed:", e);
      ui.reportContent().innerHTML = `<div class="analysis-error" style="grid-column: span 3; color:var(--accent-red); text-align:center; padding:20px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
        <p>AI Analysis Failed: ${e.message}</p>
      </div>`;
    } finally {
      state.isAnalyzing = false;
      ui.feedArea().classList.remove('scanning');
    }
  }

  async function callGeminiREST(imageUrl) {
    // Note: In a production app, proxy this through a Cloud Function to hide API Key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`;
    
    // We need to convert remote URL to Base64 for the inline_data part
    // For demo, we'll fetch the image then convert
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const prompt = `Analyze this livestock image for skin diseases or health issues. 
    Return ONLY a JSON object with this structure:
    {
      "healthScore": 0-10,
      "severity": "Healthy" | "Warning" | "Critical",
      "conditions": [{"name": "Disease Name", "confidence": "95%"}],
      "observations": ["bullet point 1", "bullet point 2"],
      "farmerTip": "Actionable advice for the farmer in English and Hindi",
      "summary": "Short 1 sentence summary"
    }`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64 } }
        ]
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Gemini API Error: ${res.statusText}`);
    
    const data = await res.json();
    const resultText = data.candidates[0].content.parts[0].text;
    
    // Clean JSON from Markdown blocks
    const jsonStr = resultText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  }

  function generateSimulatedReport() {
    const scores = [9, 8, 5, 4, 9, 8, 7];
    const score = scores[Math.floor(Math.random() * scores.length)];
    const severity = score >= 8 ? 'Healthy' : (score >= 6 ? 'Warning' : 'Critical');
    
    return {
      healthScore: score,
      severity: severity,
      conditions: severity === 'Healthy' ? [] : [{ name: "Potential Dermatitis", confidence: "72%" }],
      observations: [
        "Animal appears active and responsive",
        severity === 'Healthy' ? "Skin texture is normal" : "Minor lesions detected on flank",
        "Body condition score: 3.5/5"
      ],
      farmerTip: "Keep the area dry and consult a vet if redness persists. / क्षेत्र को सूखा रखें और लालिमा बनी रहने पर पशु चिकित्सक से परामर्श करें।",
      summary: severity === 'Healthy' ? "Visual check confirms good health status." : "Visual anomalies detected requiring manual inspection.",
      isSimulated: true
    };
  }

  // ── UI Rendering ──────────────────────────────────────────

  function renderReport(report) {
    const col = report.healthScore >= 8 ? 'var(--accent-green)' : (report.healthScore >= 6 ? 'var(--accent-amber)' : 'var(--accent-red)');
    const radius = 60;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (report.healthScore / 10) * circ;

    ui.reportContent().innerHTML = `
      <!-- Score Column -->
      <div class="diag-summary-col">
        <div class="score-ring-container">
          <svg class="score-ring-svg" width="140" height="140">
            <circle class="score-ring-bg" cx="70" cy="70" r="${radius}"></circle>
            <circle class="score-ring-fill" cx="70" cy="70" r="${radius}" 
              style="stroke-dasharray: ${circ}; stroke-dashoffset: ${circ}; stroke: ${col}">
            </circle>
          </svg>
          <div class="score-ring-text">
            <span class="score-num" style="color:${col}">${report.healthScore}</span>
            <span class="score-label">Health Score</span>
          </div>
        </div>
        <div class="severity-pill ${report.severity.toLowerCase()}">${report.severity}</div>
      </div>

      <!-- Details Column -->
      <div class="diag-details-col">
        <div class="obs-section">
          <h4><i class="fa-solid fa-list-check"></i> Observations / अवलोकन</h4>
          <ul class="obs-list">
            ${report.observations.map(o => `<li>${o}</li>`).join('')}
          </ul>
        </div>
        <div class="condition-section">
          <h4><i class="fa-solid fa-virus"></i> Detected Conditions / पाई गई स्थितियां</h4>
          <div class="condition-list">
            ${report.conditions.length > 0 ? 
              report.conditions.map(c => `
                <div class="condition-item" style="border-left-color:${col}">
                  <span class="condition-name">${c.name}</span>
                  <span class="condition-conf">${c.confidence} Confidence</span>
                </div>
              `).join('') : 
              '<p style="font-size:0.85rem; color:var(--text-muted);">No major skin issues detected.</p>'
            }
          </div>
        </div>
      </div>

      <!-- Actions Column -->
      <div class="diag-actions-col">
        <div class="summary-section">
          <h4><i class="fa-solid fa-comment-medical"></i> AI Summary / सारांश</h4>
          <p class="summary-para">${report.summary}</p>
        </div>
        <div class="farmer-tip-box">
          <h5><i class="fa-solid fa-lightbulb"></i> Farmer Tip / किसान सुझाव</h5>
          <p>${report.farmerTip}</p>
        </div>
        ${report.isSimulated ? '<div class="badge-sim" style="margin-top:20px; width:fit-content;">Simulated Result</div>' : ''}
      </div>
    `;

    // Animate the ring
    setTimeout(() => {
      const fill = ui.reportContent().querySelector('.score-ring-fill');
      if (fill) fill.style.strokeDashoffset = offset;
    }, 100);

    // Also update the small status card on the right
    updateStatusCard(report);
  }

  function updateStatusCard(report) {
    const col = report.healthScore >= 8 ? 'var(--accent-green)' : (report.healthScore >= 6 ? 'var(--accent-amber)' : 'var(--accent-red)');
    ui.boxAnalysisSummary().innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.75rem; color:var(--text-muted);">Health Score</span>
        <strong style="color:${col}; font-size:1.2rem;">${report.healthScore}/10</strong>
      </div>
      <p style="font-size:0.8rem; margin:8px 0 0; line-height:1.4;">${report.summary}</p>
    `;
  }

  function renderFilmstrip() {
    const strip = ui.filmstrip();
    if (state.history.length === 0) {
      strip.innerHTML = '<div class="empty-analysis"><p>No history yet.</p></div>';
      return;
    }

    strip.innerHTML = state.history.map(cap => {
      const time = cap.timestamp ? (cap.timestamp.toDate ? cap.timestamp.toDate() : new Date(cap.timestamp)).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Now';
      const col = cap.healthScore >= 8 ? 'var(--accent-green)' : (cap.healthScore >= 6 ? 'var(--accent-amber)' : 'var(--accent-red)');
      
      return `
        <div class="film-card" onclick="window.CameraModule.loadHistoryItem('${cap.id}')">
          <img src="${cap.imageUrl}" class="film-img" alt="Capture">
          <div class="film-meta">
            <span class="film-time">${time}</span>
            <span class="film-status" style="color:${col}">${cap.severity} (${cap.healthScore}/10)</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateAnimalDisplay() {
    if (!state.currentAnimal) {
      ui.boxAnimalInfo().innerHTML = `
        <div class="empty-analysis"><p>Select an animal to track its history.</p></div>
      `;
      return;
    }

    const a = state.currentAnimal;
    ui.boxAnimalInfo().innerHTML = `
      <div class="animal-info-main">
        <span class="animal-emoji">🐄</span>
        <div class="animal-ids">
          <strong id="info-id">${a.id}</strong>
          <span id="info-breed">${a.breed || a.species}</span>
        </div>
      </div>
      <div class="mini-vitals-row">
        <div class="mini-vital-chip">Age: ${a.age || '--'}y</div>
        <div class="mini-vital-chip">Weight: ${a.weight || '--'}kg</div>
      </div>
    `;
  }

  // ── Utils ─────────────────────────────────────────────────

  function showFlash() {
    const flash = ui.flash();
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 150);
  }

  async function triggerHealthAlert(report) {
    const user = firebase.auth().currentUser;
    try {
      await firebase.firestore().collection(COLLECTION_ALERTS).add({
        farmerId: user.uid,
        animalId: report.animalId,
        parameter: 'Visual Health (AI)',
        readingValue: `${report.healthScore}/10`,
        severity: report.severity,
        alertType: 'Skin Disease Detection',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        resolved: false,
        source: 'AI-Camera',
        message: report.summary
      });
      if (window.utils && window.utils.showToast) {
        window.utils.showToast(`Critical health alert for ${report.animalId}!`, "error");
      }
    } catch (e) {
      console.error("Error triggering alert:", e);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      ui.imgLive().src = event.target.result;
      ui.imgLive().style.display = 'block';
      ui.placeholder().style.display = 'none';
      ui.overlayTime().textContent = `Uploaded: ${new Date().toLocaleTimeString()}`;
      runAIAnalysis(event.target.result);
    };
    reader.readAsDataURL(file);
  }

  // --- Exposed API ---
  return {
    init,
    openKeyModal: () => ui.modalOverlay().classList.add('active'),
    closeKeyModal: () => ui.modalOverlay().classList.remove('active'),
    toggleKeyVisibility: () => {
      const inp = ui.modalInput();
      inp.type = inp.type === 'password' ? 'text' : 'password';
    },
    loadHistoryItem: (id) => {
      const item = state.history.find(h => h.id === id);
      if (item) {
        ui.imgLive().src = item.imageUrl;
        ui.imgLive().style.display = 'block';
        ui.placeholder().style.display = 'none';
        renderReport(item);
      }
    }
  };

})();
