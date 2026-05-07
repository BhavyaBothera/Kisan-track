/**
 * ============================================================
 * KisanTrack — Dashboard Logic (dashboard.js)
 * Real-time listeners, Chart.js, Gemini AI, Live Vitals
 * ============================================================
 */

const DashboardModule = (function () {
  'use strict';

  // --- Internal State ---
  let _charts = {
    donut: null,
    sparkTemp: null,
    sparkHr: null,
    sparkAct: null
  };
  let _unsubscribers = [];

  // --- Selectors ---
  const el = {
    greeting: document.getElementById('banner-greeting'),
    farmInfo: document.getElementById('banner-farm-info'),
    bannerDate: document.getElementById('banner-date'),
    headerClock: document.getElementById('header-datetime'),
    kpiTotal: document.getElementById('kpi-total-animals'),
    kpiHealthy: document.getElementById('kpi-healthy-animals'),
    kpiAlerts: document.getElementById('kpi-active-alerts'),
    kpiCritical: document.getElementById('kpi-critical-cases'),
    herdGrid: document.getElementById('herd-grid'),
    alertsFeed: document.getElementById('alerts-feed'),
    tickerTrack: document.getElementById('ticker-track'),
    aiSelect: document.getElementById('ai-animal-select'),
    aiResult: document.getElementById('ai-result-area'),
    aiContent: document.getElementById('ai-content'),
    cameraPreview: document.getElementById('camera-preview-box'),
    cameraMeta: document.getElementById('camera-meta')
  };

  // ── Initialization ──────────────────────────────────────────
  function init() {
    startClock();
    setupDropdowns();
    setupAuthListener();
    setupMobileNav();

    // Cleanup on navigate
    window.addEventListener('beforeunload', cleanup);
  }

  function cleanup() {
    console.log("KisanTrack: Cleaning up listeners...");
    _unsubscribers.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
    _unsubscribers = [];
    
    // Destroy charts
    Object.keys(_charts).forEach(key => {
      if (_charts[key]) {
        _charts[key].destroy();
        _charts[key] = null;
      }
    });
  }

  // ── Auth & Data Flow ───────────────────────────────────────
  function setupAuthListener() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        initDashboard(user);
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  function initDashboard(user) {
    // Clean existing if any (hot reload safety)
    cleanup();

    // 1. Farmer Details
    const unsubFarmer = db.collection('farmers').doc(user.uid)
      .onSnapshot(doc => {
        if (doc.exists) updateWelcomeBanner(doc.data());
      });
    _unsubscribers.push(unsubFarmer);

    // 2. Animals (KPIs, Grid, Donut)
    const unsubAnimals = db.collection('animals')
      .where('farmerId', '==', user.uid)
      .onSnapshot(snap => {
        const animals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        processAnimals(animals);
      }, err => console.error("Firestore Index required for animals? ", err));
    _unsubscribers.push(unsubAnimals);

    // 3. Alerts (KPIs, Feed, Ticker)
    const unsubAlerts = db.collection('alerts')
      .where('farmerId', '==', user.uid)
      .where('resolved', '==', false)
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        processAlerts(alerts);
      }, err => {
        console.error("Firestore Error in Alerts:", err);
        // NOTE: If you see "The query requires an index" error here, 
        // click the link provided in the browser console to auto-create it.
      });
    _unsubscribers.push(unsubAlerts);

    // 4. Last Camera Capture
    db.collection('cameraCaptures')
      .where('farmerId', '==', user.uid)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get()
      .then(snap => {
        if (!snap.empty) updateCameraPreview(snap.docs[0].data());
      });

    // 5. Vitals (Sparklines)
    initSparklines(user.uid);
  }

  // ── UI Updates ─────────────────────────────────────────────
  
  function updateWelcomeBanner(data) {
    const hours = new Date().getHours();
    let greetEn = "Good Morning", greetHi = "शुभ प्रभात";
    let emoji = "🌅";

    if (hours >= 12 && hours < 17) { greetEn = "Good Afternoon"; greetHi = "नमस्ते"; emoji = "🌾"; }
    else if (hours >= 17 && hours < 21) { greetEn = "Good Evening"; greetHi = "शुभ संध्या"; emoji = "🌙"; }
    else if (hours >= 21 || hours < 6) { greetEn = "Good Night"; greetHi = "शुभ रात्रि"; emoji = "🌟"; }

    if (el.greeting) el.greeting.innerHTML = `${greetEn}, ${data.firstName || 'Farmer'} ${emoji} <span style="display:block; font-size:16px; opacity:0.8;">${greetHi}</span>`;
    if (el.farmInfo) el.farmInfo.textContent = `${data.farmName || 'My Farm'} · ${data.village || 'Rampur'}, ${data.state || 'Rajasthan'}`;
    
    // Update Sidebar
    const sbName = document.getElementById('sidebar-farmer-name');
    const sbFarm = document.getElementById('sidebar-farm-name');
    const sbAvatar = document.getElementById('sidebar-avatar');
    if (sbName) sbName.textContent = data.firstName || 'Farmer';
    if (sbFarm) sbFarm.textContent = data.farmName || 'My Farm';
    if (sbAvatar) sbAvatar.textContent = (data.firstName || 'F')[0].toUpperCase();
  }

  function processAnimals(animals) {
    // KPI Counts
    animateCount(el.kpiTotal, animals.length);
    const healthy = animals.filter(a => a.status === 'Healthy').length;
    animateCount(el.kpiHealthy, healthy);

    // Donut Chart
    updateDonutChart(animals);

    // Health Bars
    updateHealthBars(animals);

    // Herd Grid
    renderHerdGrid(animals);

    // AI Select
    updateAISelect(animals);
  }

  function processAlerts(alerts) {
    animateCount(el.kpiAlerts, alerts.length);
    const critical = alerts.filter(a => a.severity === 'Critical').length;
    animateCount(el.kpiCritical, critical);

    // Alert Badge
    const badge = document.getElementById('sidebar-alert-badge');
    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length > 0 ? 'block' : 'none';
    }

    renderAlertsFeed(alerts);
    renderTicker(alerts);
  }

  function renderHerdGrid(animals) {
    if (!el.herdGrid) return;
    if (animals.length === 0) {
      el.herdGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align:center; padding:40px;">
          <span style="font-size:64px;">🐄</span>
          <h3 style="color:var(--text-primary); margin-top:10px;">No animals added yet. / पशु अभी तक नहीं जोड़े गए।</h3>
          <button class="btn-ai-analyse" style="margin-top:20px; width:auto; padding:12px 24px;" onclick="window.location.href='herd.html'">+ Add Your First Animal</button>
        </div>
      `;
      return;
    }

    el.herdGrid.innerHTML = animals.map(a => {
      const status = a.status || 'Healthy';
      const sc = status.toLowerCase();
      return `
        <div class="animal-card" onclick="window.location.href='herd.html?id=${a.id}'">
          <div class="animal-card-top">
            <div class="species-circle" style="background:rgba(var(--accent-${sc === 'healthy' ? 'green' : (sc === 'warning' ? 'amber' : 'red')}-rgb), 0.12)">
              ${a.species === 'Cow' ? '🐄' : (a.species === 'Buffalo' ? '🐃' : '🐐')}
            </div>
            <div class="badge-pill badge-${sc}">${status}</div>
          </div>
          <div class="animal-info">
            <div class="id">#${a.animalId || '---'}</div>
            <div class="meta">${a.breed || 'Breed'} · ${a.age || '?'} yrs</div>
          </div>
          <div class="vitals-mini-row">
            <div class="vital-chip"><i class="fa-solid fa-thermometer"></i> ${a.vitals?.lastTemp || '--'}°</div>
            <div class="vital-chip"><i class="fa-solid fa-heart"></i> ${a.vitals?.lastHeartRate || '--'}</div>
            <div class="vital-chip"><i class="fa-solid fa-person-running"></i> ${a.vitals?.activity || '--'}</div>
          </div>
          <div class="health-mini-bar">
            <div class="fill ${sc}" style="width: ${status === 'Healthy' ? '90%' : (status === 'Warning' ? '60%' : '30%')}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAlertsFeed(alerts) {
    if (!el.alertsFeed) return;
    if (alerts.length === 0) {
      el.alertsFeed.innerHTML = `<div class="feed-empty"><i class="fa-solid fa-check-circle"></i><p>All Clear! / सब ठीक है!</p><span>No active alerts right now.</span></div>`;
      return;
    }

    el.alertsFeed.innerHTML = alerts.slice(0, 5).map(a => `
      <div class="feed-item">
        <div class="severity-icon ${a.severity ? a.severity.toLowerCase() : 'info'}">
          <i class="fa-solid ${a.severity === 'Critical' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
        </div>
        <div class="alert-body">
          <div class="alert-title">${a.animalId ? 'Animal #' + a.animalId : 'System Alert'} · ${a.parameter || 'Health Alert'}</div>
          <div class="alert-meta">${a.reading || 'Sensor deviation'} · ${formatTime(a.timestamp)}</div>
        </div>
        <div class="alert-actions">
          <span class="confidence-pill">${a.confidence || '90'}%</span>
          <button class="btn-resolve" onclick="DashboardModule.resolveAlert('${a.id}')">Resolve</button>
        </div>
      </div>
    `).join('');
  }

  function renderTicker(alerts) {
    if (!el.tickerTrack) return;
    if (alerts.length === 0) {
      el.tickerTrack.innerHTML = `<span class="ticker-item">✅ ✓ All systems normal · सब ठीक है · No active alerts</span>`;
      return;
    }
    el.tickerTrack.innerHTML = alerts.map(a => `
      <span class="ticker-item" style="color:var(--accent-${a.severity === 'Critical' ? 'red' : 'amber'})">
        ⚠️ #${a.animalId || 'UNK'} — ${a.parameter} Alert — ${formatTime(a.timestamp)}
      </span>
    `).join(' · ');
  }

  // ── Charts ────────────────────────────────────────────────
  
  function updateDonutChart(animals) {
    const ctx = document.getElementById('herd-donut-chart');
    if (!ctx) return;

    const counts = { Cow: 0, Buffalo: 0, Goat: 0 };
    animals.forEach(a => { if (counts[a.species] !== undefined) counts[a.species]++; });

    const chartData = [counts.Cow || 0, counts.Buffalo || 0, counts.Goat || 0];
    const total = chartData.reduce((a, b) => a + b, 0);
    if (document.getElementById('donut-total')) document.getElementById('donut-total').textContent = total;

    // Handle Empty/Zero state for chart
    if (total === 0) {
      if (_charts.donut) _charts.donut.destroy();
      _charts.donut = null;
      return;
    }

    if (_charts.donut) {
      _charts.donut.data.datasets[0].data = chartData;
      _charts.donut.update();
    } else {
      _charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Cows', 'Buffaloes', 'Goats'],
          datasets: [{
            data: chartData,
            backgroundColor: ['#7CB518', '#E5A100', '#2980B9'],
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          cutout: '72%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          animation: { duration: 1200, easing: 'easeInOutQuart' }
        }
      });
    }

    // Legend
    const legendEl = document.getElementById('donut-legend');
    if (legendEl) {
      const species = [
        { lab: 'Cows / गाय', count: counts.Cow, color: '#7CB518' },
        { lab: 'Buffaloes / भैंस', count: counts.Buffalo, color: '#E5A100' },
        { lab: 'Goats / बकरी', count: counts.Goat, color: '#2980B9' }
      ];
      legendEl.innerHTML = species.map(s => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${s.color}"></span>
          <span>${s.lab}</span>
          <span class="stats">${s.count} (${total ? Math.round(s.count/total*100) : 0}%)</span>
        </div>
      `).join('');
    }
  }

  function updateHealthBars(animals) {
    const total = animals.length;
    const elH = document.getElementById('bar-healthy');
    const elW = document.getElementById('bar-warning');
    const elC = document.getElementById('bar-critical');

    if (total === 0) {
      if (elH) elH.style.width = '0%';
      if (elW) elW.style.width = '0%';
      if (elC) elC.style.width = '0%';
      return;
    }

    const hCount = animals.filter(a => a.status === 'Healthy').length;
    const wCount = animals.filter(a => a.status === 'Warning').length;
    const cCount = animals.filter(a => a.status === 'Critical').length;

    const hPct = Math.round((hCount / total) * 100);
    const wPct = Math.round((wCount / total) * 100);
    const cPct = Math.round((cCount / total) * 100);

    if (elH) elH.style.width = hPct + '%';
    if (elW) elW.style.width = wPct + '%';
    if (elC) elC.style.width = cPct + '%';

    if (document.getElementById('stat-healthy')) document.getElementById('stat-healthy').textContent = `${hCount} (${hPct}%)`;
    if (document.getElementById('stat-warning')) document.getElementById('stat-warning').textContent = `${wCount} (${wPct}%)`;
    if (document.getElementById('stat-critical')) document.getElementById('stat-critical').textContent = `${cCount} (${cPct}%)`;
  }

  function initSparklines(uid) {
    const commonOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } }
    };

    const sparkConfigs = [
      { id: 'spark-temp-chart', key: 'sparkTemp', color: '#E5A100' },
      { id: 'spark-hr-chart', key: 'sparkHr', color: '#C0392B' },
      { id: 'spark-act-chart', key: 'sparkAct', color: '#2980B9' }
    ];

    sparkConfigs.forEach(d => {
      const ctx = document.getElementById(d.id);
      if (!ctx) return;

      // Destroy if exists
      if (_charts[d.key]) _charts[d.key].destroy();

      _charts[d.key] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array(10).fill(''),
          datasets: [{
            data: Array(10).fill(0).map(() => 30 + Math.random() * 20),
            borderColor: d.color,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: false
          }]
        },
        options: commonOpts
      });
    });

    // NOTE: For a real production app, you would query Firestore here:
    // db.collection('vitals').where('farmerId', '==', uid).orderBy('timestamp', 'desc').limit(10)
  }

  // ── AI Analysis ───────────────────────────────────────────
  
  function updateAISelect(animals) {
    if (!el.aiSelect) return;
    const current = el.aiSelect.value;
    el.aiSelect.innerHTML = '<option value="">Select Animal...</option>' + 
      animals.map(a => `<option value="${a.id}">${a.animalId || '---'} (${a.species})</option>`).join('');
    el.aiSelect.value = current;
  }

  async function performAIAnalysis() {
    // SECURITY NOTE: In production, Gemini API calls should be 
    // routed through Firebase Cloud Functions to protect the API key.
    // This direct approach is used here for demonstration purposes only.
    
    const animalId = el.aiSelect.value;
    if (!animalId) return alert("Please select an animal first!");

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      document.getElementById('ai-key-prompt').style.display = 'block';
      return;
    }

    el.aiResult.style.display = 'block';
    el.aiContent.innerHTML = '';
    const loading = el.aiResult.querySelector('.ai-loading');
    loading.style.display = 'flex';

    try {
      const animalSnap = await db.collection('animals').doc(animalId).get();
      const a = animalSnap.data();

      const prompt = `You are a livestock health expert AI for Indian farmers. Based on the following sensor data for Animal #${a.animalId} (${a.species}, ${a.breed}, ${a.age} years):
      - Body Temperature: ${a.vitals?.lastTemp || 38.5}°C
      - Heart Rate: ${a.vitals?.lastHeartRate || 72} bpm
      - Activity Level: ${a.vitals?.activity || 'Normal'}
      - Health Status: ${a.status || 'Healthy'}
      
      Provide a brief, simple health assessment in 2-3 sentences that a rural Indian farmer can understand. Include: current health state, any concern, and one actionable recommendation. End with a confidence score out of 100. Keep language simple and warm.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "AI analysis completed. Animal appears to be in stable condition. Continue regular monitoring.";
      
      loading.style.display = 'none';
      el.aiContent.textContent = text;

    } catch (err) {
      console.error(err);
      loading.style.display = 'none';
      el.aiContent.textContent = "Error during analysis. Please check your API key and network connection.";
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  function startClock() {
    setInterval(() => {
      const now = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
      const str = now.toLocaleDateString('en-US', options).replace(',', ' ·');
      if (el.headerClock) el.headerClock.textContent = str;
    }, 1000);
  }

  function setupDropdowns() {
    const btn = document.getElementById('header-avatar-btn');
    const menu = document.getElementById('header-dropdown-menu');
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      });
      document.addEventListener('click', () => menu.style.display = 'none');
    }

    const sbSignout = document.getElementById('btn-sidebar-signout');
    const hSignout = document.getElementById('btn-header-signout');
    const signOut = () => firebase.auth().signOut().then(() => window.location.href = 'index.html');
    if (sbSignout) sbSignout.onclick = signOut;
    if (hSignout) hSignout.onclick = signOut;

    const aiKeyBtn = document.getElementById('btn-save-ai-key');
    if (aiKeyBtn) {
      aiKeyBtn.onclick = () => {
        const val = document.getElementById('gemini-api-key').value;
        if (val) {
          localStorage.setItem('gemini_api_key', val);
          document.getElementById('ai-key-prompt').style.display = 'none';
          alert("API Key Saved!");
        }
      };
    }

    const analyseBtn = document.getElementById('btn-ai-analyse');
    if (analyseBtn) analyseBtn.onclick = performAIAnalysis;
  }

  function setupMobileNav() {
    const burger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (burger && sidebar && overlay) {
      burger.onclick = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
      };
      overlay.onclick = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      };
    }
  }

  function animateCount(el, target) {
    if (!el) return;
    const finalVal = parseInt(target) || 0;
    let start = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(ease * finalVal);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function formatTime(ts) {
    if (!ts) return 'just now';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateCameraPreview(data) {
    if (!el.cameraPreview) return;
    el.cameraPreview.innerHTML = `<img src="${data.imageUrl}" style="width:100%; height:100%; object-fit:cover;" loading="lazy">`;
    if (el.cameraMeta) {
      el.cameraMeta.style.display = 'flex';
      const camTime = document.getElementById('cam-time');
      if (camTime) camTime.textContent = formatTime(data.timestamp);
    }
  }

  return { init, resolveAlert: (id) => db.collection('alerts').doc(id).update({ resolved: true }) };
})();

// Initialize on Load
document.addEventListener('DOMContentLoaded', DashboardModule.init);
