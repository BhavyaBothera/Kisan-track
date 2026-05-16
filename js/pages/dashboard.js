// ============================================
// KisanTrack — dashboard.js
// Purpose: Main Dashboard Rendering Logic
// Page: dashboard.html
// Dependencies: Firebase, FirestoreStore, Chart.js
// Last Updated: 2026-05-17
// ============================================
const DashboardModule = (function () {
  'use strict';

  let _charts = { donut: null, main: null, modal: null };
  let _initialized = false;

  // ── Initialization ──────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Show skeleton immediately so the page doesn't look blank
    renderSkeletons();

    // Listen for every state update from FirestoreStore
    document.addEventListener('kisanTrack:stateUpdated', () => renderDashboard());

    // Also listen for farmer name specifically (fires as soon as farmer doc loads)
    document.addEventListener('kisanTrack:farmerLoaded', (e) => {
      if (e.detail) updateWelcomeBanner(e.detail);
    });

    // Render now in case store already has data (e.g. navigated back to page)
    renderDashboard();

    setupLocalListeners();
    startTelemetryPulse();

    // Safety net: if data hasn't arrived in 8 seconds, show empty states
    setTimeout(() => {
      const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
      if (!state || state.isLoading) {
        console.warn('DashboardModule: Data timeout — showing empty states');
        showEmptyStates();
      }
    }, 8000);
  }

  // ── Show skeleton shimmer while loading ───────────────────
  function renderSkeletons() {
    const grid = document.getElementById('herd-grid');
    if (grid && grid.children.length === 0) {
      grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="animal-card skeleton-pulse" style="height:140px;background:rgba(255,255,255,0.05);border:none;"></div>
      `).join('');
    }

    const feed = document.getElementById('alerts-feed');
    if (feed && feed.children.length === 0) {
      feed.innerHTML = `<div class="feed-empty" style="opacity:0.4;">⏳ Loading alerts...</div>`;
    }

    const ticker = document.getElementById('ticker-track');
    if (ticker && ticker.children.length === 0) {
      ticker.innerHTML = `<span class="ticker-item" style="opacity:0.4;">⏳ Fetching live data...</span>`;
    }
  }

  // ── Show empty states on timeout ─────────────────────────
  function showEmptyStates() {
    // KPIs - set to 0 rather than leave blank
    ['kpi-total-animals','kpi-healthy-animals','kpi-active-alerts','kpi-critical-cases'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.textContent === '0') el.textContent = '0';
    });
    const grid = document.getElementById('herd-grid');
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">🐄<br>No animals found.<br><small>Add animals from the <a href="herd.html" style="color:var(--accent-green)">Herd page</a>.</small></div>`;
    const feed = document.getElementById('alerts-feed');
    if (feed) feed.innerHTML = `<div class="feed-empty">✅ All systems normal. No active alerts.</div>`;
    const ticker = document.getElementById('ticker-track');
    if (ticker) ticker.innerHTML = `<span class="ticker-item">✅ System Normal · सब ठीक है</span>`;
  }

  // ── Main Render ───────────────────────────────────────────
  function renderDashboard() {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
    if (!state) return;

    // Update greeting even while loading (farmer may have loaded first)
    if (state.farmer) updateWelcomeBanner(state.farmer);

    // Don't render data sections until Firestore has responded at least once
    if (state.isLoading) return;

    // 1. KPIs
    updateKPIs(state.kpis);

    // 2. Bio Gauge + Health Index
    updateBioGauge(state.animals);

    // 3. Charts
    updateDonutChart(state.animals);
    initMainChart(state.animals);

    // 4. Herd grid + alerts feed
    renderHerdGrid(state.animals);
    renderAlertsFeed(state.alerts);
    renderTicker(state.alerts);

    // 5. Auto-populate detail panel with first animal
    if (state.animals.length > 0) {
      populateDetailPanel(state.animals[0], state.vitals);
    }
  }

  function updateWelcomeBanner(farmer) {
    const greetSpan = document.getElementById('greeting-text');
    const greetEl   = document.getElementById('banner-greeting');
    const farmEl    = document.getElementById('banner-farm-info');
    if (!greetEl) return;

    const hours = new Date().getHours();
    let greetEn = 'Good Morning', greetHi = 'शुभ प्रभात', emoji = '🌅';
    if (hours >= 12 && hours < 17) { greetEn = 'Good Afternoon'; greetHi = 'नमस्ते';    emoji = '☀️'; }
    else if (hours >= 17 && hours < 21) { greetEn = 'Good Evening'; greetHi = 'शुभ संध्या'; emoji = '🌙'; }
    else if (hours >= 21 || hours < 6)  { greetEn = 'Good Night';   greetHi = 'शुभ रात्रि'; emoji = '🌟'; }

    const displayName = farmer.fullName || farmer.firstName || 'Farmer';
    const firstName = displayName.split(' ')[0];

    const greetHtml = `${greetEn}, ${firstName} ${emoji} <span style="display:block;font-size:16px;opacity:0.7;">${greetHi}</span>`;

    // If the inner span exists, update just it. Otherwise update full h1 innerHTML.
    if (greetSpan) {
      greetSpan.style.opacity = '1';
      greetSpan.innerHTML = greetHtml;
    } else {
      greetEl.innerHTML = `<i class="fa-solid fa-gauge-high" style="color:var(--accent-green);margin-right:10px;"></i>${greetHtml}`;
    }

    if (farmEl) {
      const loc = [farmer.village, farmer.state].filter(Boolean).join(', ');
      farmEl.textContent = `${farmer.farmName || 'My Farm'}${loc ? ' · ' + loc : ''}`;
    }
  }


  // ── KPI Cards ────────────────────────────────────────────
  function updateKPIs(kpis) {
    animateCount(document.getElementById('kpi-total-animals'),   kpis.totalAnimals);
    animateCount(document.getElementById('kpi-healthy-animals'), kpis.healthyAnimals);
    animateCount(document.getElementById('kpi-active-alerts'),   kpis.activeAlerts);
    animateCount(document.getElementById('kpi-critical-cases'),  kpis.criticalCases);
  }

  // ── Bio Gauge + Health Index ──────────────────────────────
  function updateBioGauge(animals) {
    const valEl = document.getElementById('bio-score-val');
    const path  = document.getElementById('bio-gauge-path');
    const labelEl = document.getElementById('bio-score-label');
    const signalEl = document.querySelector('.nexus-stat-pill');

    const total = animals.length;
    let score = 0;

    if (total > 0) {
      const healthy = animals.filter(a => a.status === 'Healthy').length;
      score = Math.round((healthy / total) * 100);
    }

    if (valEl) valEl.textContent = score;

    // Update the label with context
    if (labelEl) {
      const ctx = score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : score >= 40 ? 'FAIR' : 'POOR';
      labelEl.textContent = `${ctx} · ${score}/100`;
    }

    // Update signal pill colour
    if (signalEl) {
      signalEl.style.color = score >= 60 ? 'var(--accent-green)' : score >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)';
      signalEl.innerHTML = `<i class="fa-solid fa-wave-square"></i> ${score >= 60 ? 'SIGNAL STABLE' : score >= 40 ? 'SIGNAL WEAK' : 'SIGNAL CRITICAL'}`;
    }

    if (path) {
      const circumference = 283;
      const offset = circumference - (score / 100) * circumference;
      path.style.strokeDashoffset = offset;
      // Colour the arc based on score
      path.style.stroke = score >= 60 ? 'var(--accent-green)' : score >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
  }

  // ── Donut Chart ───────────────────────────────────────────
  function updateDonutChart(animals) {
    const canvas = document.getElementById('herd-donut-chart');
    if (!canvas) return;

    const counts = { Cow: 0, Buffalo: 0, Goat: 0, Other: 0 };
    animals.forEach(a => {
      if (counts[a.species] !== undefined) counts[a.species]++;
      else counts.Other++;
    });

    if (_charts.donut) _charts.donut.destroy();

    _charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Cows', 'Buffaloes', 'Goats', 'Other'],
        datasets: [{
          data: [counts.Cow, counts.Buffalo, counts.Goat, counts.Other],
          backgroundColor: ['#7CB518', '#E5A100', '#2980B9', '#6C757D'],
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
        { lab: 'Cows / गाय',       count: counts.Cow,     color: '#7CB518' },
        { lab: 'Buffaloes / भैंस', count: counts.Buffalo,  color: '#E5A100' },
        { lab: 'Goats / बकरी',    count: counts.Goat,    color: '#2980B9' },
        { lab: 'Other / अन्य',    count: counts.Other,   color: '#6C757D' },
      ].filter(i => i.count > 0);

      legendEl.innerHTML = items.length
        ? items.map(s => `
            <div class="legend-row">
              <span class="legend-dot" style="background:${s.color}"></span>
              <span>${s.lab}</span>
              <span class="stats">${s.count}</span>
            </div>`).join('')
        : `<div style="color:var(--text-dim);font-size:0.8rem;">No animals yet</div>`;
    }
  }

  // ── Main Telemetry Chart ──────────────────────────────────
  function initMainChart(animals) {
    const canvas = document.getElementById('main-telemetry-chart');
    if (!canvas) return;
    if (_charts.main) _charts.main.destroy();

    // Calculate a real health trend if we have animals, otherwise mock
    const total = animals ? animals.length : 0;
    const healthy = animals ? animals.filter(a => a.status === 'Healthy').length : 0;
    const baseScore = total > 0 ? Math.round((healthy / total) * 100) : 75;
    // Generate 6 slightly varied data points around the current score
    const data = Array.from({ length: 6 }, (_, i) =>
      Math.min(100, Math.max(0, baseScore + Math.round((Math.random() - 0.5) * 10)))
    );

    _charts.main = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [{
          label: 'Health Index',
          data,
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
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#64748B', font: { size: 10 }, callback: v => v + '%' }
          }
        }
      }
    });
  }

  // ── Herd Grid ─────────────────────────────────────────────
  function renderHerdGrid(animals) {
    const grid = document.getElementById('herd-grid');
    if (!grid) return;

    if (!animals || animals.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1; padding:40px; text-align:center;">
          <div style="font-size:3rem;margin-bottom:12px;">🐄</div>
          <p style="color:var(--text-dim);">No animals registered yet.<br>
          <a href="herd.html" style="color:var(--accent-green); text-decoration:none;">
            + Add your first animal →
          </a></p>
        </div>`;
      return;
    }

    grid.innerHTML = animals.slice(0, 4).map(a => {
      const statusCls = (a.status || 'healthy').toLowerCase();
      const barWidth  = a.status === 'Healthy' ? '88%' : a.status === 'Warning' ? '55%' : '25%';
      return `
        <div class="animal-card" role="button" tabindex="0"
             onclick="window.DashboardModule && window.DashboardModule.openAnimalPanel('${a.id}')"
             onkeydown="if(event.key==='Enter') this.click()">
          <div class="animal-card-top">
            <div class="species-circle">${a.emoji || '🐄'}</div>
            <div class="badge-pill badge-${statusCls}">${a.status || 'Healthy'}</div>
          </div>
          <div class="animal-info">
            <div class="id">#${a.animalId}</div>
            <div class="meta">${a.breed} · ${a.age} yrs</div>
          </div>
          <div class="health-mini-bar">
            <div class="fill ${statusCls}" style="width:${barWidth}"></div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Alert Feed ────────────────────────────────────────────
  function renderAlertsFeed(alerts) {
    const feed = document.getElementById('alerts-feed');
    if (!feed) return;

    const unresolved = (alerts || []).filter(a => !a.resolved).slice(0, 5);

    if (unresolved.length === 0) {
      feed.innerHTML = `
        <div class="feed-empty">
          <i class="fa-solid fa-circle-check" style="color:var(--accent-green);margin-right:8px;"></i>
          All systems normal · सब ठीक है
        </div>`;
      return;
    }

    feed.innerHTML = unresolved.map(a => `
      <div class="feed-item">
        <div class="severity-icon ${(a.severity || 'warning').toLowerCase()}">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="alert-body">
          <div class="alert-title">#${a.animalId || '?'} · ${a.parameter || 'Alert'}</div>
          <div class="alert-meta">${a.reading || 'Deviation detected'} · ${formatTime(a.timestamp)}</div>
        </div>
        <button class="btn-resolve" onclick="window.FirestoreStore && window.FirestoreStore.resolveAlert('${a.id}')">
          Resolve
        </button>
      </div>`).join('');
  }

  // ── Alert Ticker ──────────────────────────────────────────
  function renderTicker(alerts) {
    const track = document.getElementById('ticker-track');
    if (!track) return;

    const unresolved = (alerts || []).filter(a => !a.resolved);
    if (unresolved.length === 0) {
      track.innerHTML = `<span class="ticker-item">✅ System Normal · सब ठीक है · All Clear</span>`;
      return;
    }

    track.innerHTML = unresolved.map(a =>
      `<span class="ticker-item" style="color:var(--accent-${a.severity === 'Critical' ? 'red' : 'amber'})">
        ⚠️ #${a.animalId}: ${a.parameter} Alert
      </span>`
    ).join(' &nbsp;·&nbsp; ');
  }

  // ── Detail Panel (auto-populated) ─────────────────────────
  function populateDetailPanel(animal, vitals) {
    const titleEl    = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    const emojiEl    = document.getElementById('modal-emoji');
    const tempEl     = document.getElementById('modal-temp');
    const hrEl       = document.getElementById('modal-hr');
    const actEl      = document.getElementById('modal-act');
    const breedEl    = document.getElementById('modal-breed');
    const ageEl      = document.getElementById('modal-age');
    const weightEl   = document.getElementById('modal-weight');

    if (!titleEl) return;

    const v = (vitals && vitals[animal.id]) || animal.vitals || {};

    if (emojiEl)    emojiEl.textContent    = animal.emoji || '🐄';
    if (titleEl)    titleEl.textContent    = `${animal.species} #${animal.animalId}`;
    if (subtitleEl) subtitleEl.textContent = `${animal.breed} · ${animal.status}`;
    if (tempEl)     tempEl.textContent     = v.temp ? `${v.temp}°C` : '--';
    if (hrEl)       hrEl.textContent       = v.hr   ? `${v.hr} bpm` : '--';
    if (actEl)      actEl.textContent      = v.activity || '--';
    if (breedEl)    breedEl.textContent    = animal.breed  || '--';
    if (ageEl)      ageEl.textContent      = animal.age    ? `${animal.age} yrs` : '--';
    if (weightEl)   weightEl.textContent   = animal.weight ? `${animal.weight} kg` : '--';

    // Draw a simple placeholder 7-day chart
    const canvas = document.getElementById('modal-chart');
    if (canvas) {
      if (_charts.modal) _charts.modal.destroy();
      _charts.modal = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
          datasets: [{
            label: 'Health Score',
            data: [85, 83, 88, 86, 90, 87, 89],
            borderColor: 'var(--accent-green)',
            backgroundColor: 'rgba(124,181,24,0.1)',
            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: '#64748B', font: { size: 9 } } }
          }
        }
      });
    }
  }

  // ── Public: open panel from card click ────────────────────
  function openAnimalPanel(animalId) {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
    if (!state) return;
    const animal = state.animals.find(a => a.id === animalId);
    if (animal) populateDetailPanel(animal, state.vitals);
  }

  // ── Telemetry Pulse ───────────────────────────────────────
  function startTelemetryPulse() {
    setInterval(() => {
      const latencyEl = document.querySelector('.nexus-header .subtitle');
      if (latencyEl) {
        const lat = Math.floor(Math.random() * 15) + 38;
        latencyEl.textContent = `System Latency: ${lat}ms | Uplink: Active`;
      }
    }, 3000);
  }

  // ── Local Listeners ───────────────────────────────────────
  function setupLocalListeners() {
    // Modal close
    const closeBtn = document.getElementById('modal-close');
    const overlay  = document.getElementById('animal-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay && overlay.classList.remove('open'));
    if (overlay)  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

    // Sidebar sign-out
    const logoutBtn = document.getElementById('btn-sidebar-signout');
    if (logoutBtn) logoutBtn.onclick = () =>
      firebase.auth().signOut().then(() => window.location.href = 'index.html');
  }

  // ── Helpers ───────────────────────────────────────────────
  function animateCount(el, target) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const duration = 600;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = Math.round(start + (target - start) * progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function formatTime(ts) {
    if (!ts) return 'Just now';
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { init, openAnimalPanel };
})();

window.DashboardModule = DashboardModule;

// Expose openAnimalModal globally for legacy onclick calls
window.openAnimalModal = function(id) {
  if (window.DashboardModule) window.DashboardModule.openAnimalPanel(id);
};
