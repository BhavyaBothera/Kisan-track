/**
 * ============================================================
 * KisanTrack — Dashboard Logic (dashboard.js)
 * Visualizations and KPI summaries for the main overview.
 * ============================================================
 */

const DashboardModule = (function () {
  'use strict';

  let _charts = {
    donut: null,
    main: null
  };

  // ── Initialization ──────────────────────────────────────────
  function init() {
    console.log("DashboardModule: Initializing...");
    
    // Listen for state updates from FirestoreStore
    document.addEventListener('kisanTrack:stateUpdated', renderDashboard);
    
    // Initial render if data already exists
    renderDashboard();
    
    setupLocalListeners();
    startTelemetryPulse();
  }

  function renderDashboard() {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
    if (!state || state.isLoading) return;

    console.log("DashboardModule: Rendering with latest state...");

    // 1. Welcome Banner
    updateWelcomeBanner(state.farmer);

    // 2. KPIs (Nexus Style)
    updateKPIs(state.kpis);

    // 3. Charts & Gauges (Nexus Style)
    updateBioGauge(state.animals);
    updateDonutChart(state.animals);
    initMainChart();

    // 4. Feeds
    renderHerdGrid(state.animals);
    renderAlertsFeed(state.alerts);
    renderTicker(state.alerts);
  }

  // ── UI Components ──────────────────────────────────────────

  function startTelemetryPulse() {
    // Adds a "live" feel by slightly shifting telemetry values
    setInterval(() => {
        const latencyEl = document.querySelector('.nexus-header .subtitle');
        if (latencyEl) {
            const lat = Math.floor(Math.random() * 15) + 38;
            latencyEl.textContent = `System Latency: ${lat}ms | Uplink: Active`;
        }
    }, 3000);
  }

  function updateWelcomeBanner(farmer) {
    const greetEl = document.getElementById('banner-greeting');
    const farmEl = document.getElementById('banner-farm-info');
    if (!greetEl || !farmer) return;

    const hours = new Date().getHours();
    let greetEn = "Good Morning", greetHi = "शुभ प्रभात", emoji = "🌅";

    if (hours >= 12 && hours < 17) { greetEn = "Good Afternoon"; greetHi = "नमस्ते"; emoji = "🌾"; }
    else if (hours >= 17 && hours < 21) { greetEn = "Good Evening"; greetHi = "शुभ संध्या"; emoji = "🌙"; }
    else if (hours >= 21 || hours < 6) { greetEn = "Good Night"; greetHi = "शुभ रात्रि"; emoji = "🌟"; }

    greetEl.innerHTML = `${greetEn}, ${farmer.firstName || 'Farmer'} ${emoji} <span style="display:block; font-size:16px; opacity:0.8;">${greetHi}</span>`;
    if (farmEl) farmEl.textContent = `${farmer.farmName || 'My Farm'} · ${farmer.village || 'Rampur'}, ${farmer.state || 'Rajasthan'}`;

    // Sidebar sync
    const sbName = document.getElementById('sidebar-farmer-name');
    const sbFarm = document.getElementById('sidebar-farm-name');
    const sbAvatar = document.getElementById('sidebar-avatar');
    if (sbName) sbName.textContent = farmer.firstName || 'Farmer';
    if (sbFarm) sbFarm.textContent = farmer.farmName || 'My Farm';
    if (sbAvatar) sbAvatar.textContent = (farmer.firstName || 'F')[0].toUpperCase();
  }

  function updateKPIs(kpis) {
    const totalEl = document.getElementById('kpi-total-animals');
    const healthyEl = document.getElementById('kpi-healthy-animals');
    const alertsEl = document.getElementById('kpi-active-alerts');
    const criticalEl = document.getElementById('kpi-critical-cases');

    if (totalEl) totalEl.textContent = kpis.totalAnimals;
    if (healthyEl) healthyEl.textContent = kpis.healthyAnimals;
    if (alertsEl) alertsEl.textContent = kpis.activeAlerts;
    if (criticalEl) criticalEl.textContent = kpis.criticalCases;
  }

  function updateBioGauge(animals) {
    const total = animals.length;
    if (total === 0) return;
    const healthyCount = animals.filter(a => a.status === 'Healthy').length;
    const score = Math.round((healthyCount / total) * 100);
    
    const valEl = document.getElementById('bio-score-val');
    const path = document.getElementById('bio-gauge-path');
    
    if (valEl) valEl.textContent = score;
    if (path) {
      const circumference = 283;
      const offset = circumference - (score / 100) * circumference;
      path.style.strokeDashoffset = offset;
    }
  }

  function updateDonutChart(animals) {
    const canvas = document.getElementById('herd-donut-chart');
    if (!canvas) return;

    const counts = { Cow: 0, Buffalo: 0, Goat: 0 };
    animals.forEach(a => { if (counts[a.species] !== undefined) counts[a.species]++; });

    const chartData = [counts.Cow, counts.Buffalo, counts.Goat];
    const total = animals.length;

    if (_charts.donut) _charts.donut.destroy();

    _charts.donut = new Chart(canvas, {
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
        plugins: { legend: { display: false } }
      }
    });

    const legendEl = document.getElementById('donut-legend');
    if (legendEl) {
      const items = [
        { lab: 'Cows / गाय', count: counts.Cow, color: '#7CB518' },
        { lab: 'Buffaloes / भैंस', count: counts.Buffalo, color: '#E5A100' },
        { lab: 'Goats / बकरी', count: counts.Goat, color: '#2980B9' }
      ];
      legendEl.innerHTML = items.map(s => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${s.color}"></span>
          <span>${s.lab}</span>
          <span class="stats">${s.count}</span>
        </div>
      `).join('');
    }
  }

  function initMainChart() {
    const canvas = document.getElementById('main-telemetry-chart');
    if (!canvas) return;
    if (_charts.main) _charts.main.destroy();

    _charts.main = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [{
          label: 'Health Index',
          data: [82, 85, 84, 88, 86, 90],
          borderColor: '#00FF88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748B', font: { size: 10 } } }
        }
      }
    });
  }

  function renderHerdGrid(animals) {
    const grid = document.getElementById('herd-grid');
    if (!grid) return;

    if (animals.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">🐄<br>No animals found.</div>`;
      return;
    }

    grid.innerHTML = animals.slice(0, 4).map(a => `
      <div class="animal-card" onclick="window.openAnimalModal('${a.id}')">
        <div class="animal-card-top">
          <div class="species-circle">${a.emoji}</div>
          <div class="badge-pill badge-${a.status.toLowerCase()}">${a.status}</div>
        </div>
        <div class="animal-info">
          <div class="id">#${a.animalId}</div>
          <div class="meta">${a.breed} · ${a.age} yrs</div>
        </div>
        <div class="health-mini-bar">
          <div class="fill ${a.status.toLowerCase()}" style="width: ${a.status === 'Healthy' ? '90%' : '50%'}"></div>
        </div>
      </div>
    `).join('');
  }

  function renderAlertsFeed(alerts) {
    const feed = document.getElementById('alerts-feed');
    if (!feed) return;

    const unresolved = alerts.filter(a => !a.resolved).slice(0, 5);
    if (unresolved.length === 0) {
      feed.innerHTML = `<div class="feed-empty">✅ All systems normal.</div>`;
      return;
    }

    feed.innerHTML = unresolved.map(a => `
      <div class="feed-item">
        <div class="severity-icon ${a.severity.toLowerCase()}">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="alert-body">
          <div class="alert-title">#${a.animalId} · ${a.parameter}</div>
          <div class="alert-meta">${a.reading || 'Deviation detected'} · ${formatTime(a.timestamp)}</div>
        </div>
        <button class="btn-resolve" onclick="FirestoreStore.resolveAlert('${a.id}')">Resolve</button>
      </div>
    `).join('');
  }

  function renderTicker(alerts) {
    const track = document.getElementById('ticker-track');
    if (!track) return;

    const unresolved = alerts.filter(a => !a.resolved);
    if (unresolved.length === 0) {
      track.innerHTML = `<span class="ticker-item">✅ System Normal · सब ठीक है</span>`;
      return;
    }

    track.innerHTML = unresolved.map(a => `
      <span class="ticker-item" style="color:var(--accent-${a.severity === 'Critical' ? 'red' : 'amber'})">
        ⚠️ #${a.animalId}: ${a.parameter} Alert
      </span>
    `).join(' · ');
  }

  function updateHealthBars(animals) {
    const total = animals.length;
    if (total === 0) return;
    const h = animals.filter(a => a.status === 'Healthy').length;
    const w = animals.filter(a => a.status === 'Warning').length;
    const c = animals.filter(a => a.status === 'Critical').length;

    const elH = document.getElementById('bar-healthy');
    const elW = document.getElementById('bar-warning');
    const elC = document.getElementById('bar-critical');

    if (elH) elH.style.width = Math.round((h/total)*100) + '%';
    if (elW) elW.style.width = Math.round((w/total)*100) + '%';
    if (elC) elC.style.width = Math.round((c/total)*100) + '%';
  }

  // ── Helpers ───────────────────────────────────────────────

  function setupLocalListeners() {
    const logoutBtn = document.getElementById('btn-sidebar-signout');
    if (logoutBtn) logoutBtn.onclick = () => firebase.auth().signOut().then(() => window.location.href = 'index.html');
  }

  function animateCount(el, target) {
    if (!el) return;
    el.textContent = target; // Simplified
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { init };
})();
