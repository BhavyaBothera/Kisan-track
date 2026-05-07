/**
 * ============================================================
 * KisanTrack — Dashboard Module (dashboard.js)
 * KPI cards, Herd Grid, Alert Ticker
 * ============================================================
 */

const DashboardModule = (function () {
  'use strict';

  // --- Internal State ---
  let _sparklines = {};

  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Bio-Score Calculation ─────────────────────────────────
  function updateBioScoreHub() {
    const state = getState();
    if (!state || state.isLoading || state.animals.length === 0) return;

    const total = state.animals.length;
    const healthy = state.animals.filter(a => a.status === 'Healthy').length;
    const warning = state.animals.filter(a => a.status === 'Warning').length;
    const critical = state.animals.filter(a => a.status === 'Critical').length;

    // Calculation: Healthy=100, Warning=60, Critical=20
    const score = Math.round(((healthy * 100) + (warning * 60) + (critical * 20)) / total);
    
    // Update Gauge
    const fill = document.getElementById('bio-score-fill');
    const valEl = document.getElementById('bio-score-val');
    if (fill && valEl) {
      const circumference = 2 * Math.PI * 45;
      const offset = circumference * (1 - score / 100);
      fill.style.strokeDashoffset = offset;
      
      // Animate number
      animateValue(valEl, parseInt(valEl.textContent) || 0, score, 1000);
    }

    // Update Text
    const statusText = document.getElementById('bio-status-text');
    const statusDesc = document.getElementById('bio-status-desc');
    if (statusText && statusDesc) {
      if (score > 85) {
        statusText.textContent = 'Operational Excellence';
        statusText.style.color = 'var(--accent-green)';
        statusDesc.textContent = 'Herd vitals are within optimal range. Environmental stressors are minimal.';
      } else if (score > 60) {
        statusText.textContent = 'Active Monitoring Required';
        statusText.style.color = 'var(--accent-amber)';
        statusDesc.textContent = 'Minor deviations detected in sub-group vitals. Check individual alerts.';
      } else {
        statusText.textContent = 'Critical Intervention Protocol';
        statusText.style.color = 'var(--accent-red)';
        statusDesc.textContent = 'Multiple critical alerts active. Emergency veterinary protocols recommended.';
      }
    }

    // Update Telemetry
    const totalEl = document.getElementById('hub-total-animals');
    const sensorEl = document.getElementById('hub-active-sensors');
    const pingEl = document.getElementById('hub-last-ping');
    if (totalEl) totalEl.textContent = total;
    if (sensorEl) sensorEl.textContent = Math.round(total * 0.94); // Mock active ratio
    if (pingEl) pingEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.innerHTML = Math.floor(progress * (end - start) + start).toString().padStart(2, '0');
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  // ── Helpers ───────────────────────────────────────────────
  function statusClass(status) {
    return status === 'Healthy' ? 'healthy'
         : status === 'Warning' ? 'warning'
         : 'critical';
  }

  // ── KPI Cards ─────────────────────────────────────────────
  function renderKPIs() {
    const state = getState();
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;

    if (!state || state.isLoading) {
      grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="kpi-card skeleton-pulse" style="height:110px; background:rgba(255,255,255,0.05); border:none;"></div>
      `).join('');
      return;
    }

    const { kpis } = state;

    const config = [
      { icon: 'fa-solid fa-cow', colorClass: 'blue', number: kpis.totalAnimals, labelEn: 'Total Animals', labelHi: 'कुल पशु' },
      { icon: 'fa-solid fa-heart', colorClass: 'green', number: kpis.healthyAnimals, labelEn: 'Healthy', labelHi: 'स्वस्थ', extraClass: 'green' },
      { icon: 'fa-solid fa-triangle-exclamation', colorClass: 'amber', number: kpis.activeAlerts, labelEn: 'Alerts Active', labelHi: 'सक्रिय अलर्ट', extraClass: 'amber' },
      { icon: 'fa-solid fa-circle-exclamation', colorClass: 'red', number: kpis.criticalCases, labelEn: 'Critical Cases', labelHi: 'गंभीर मामले', extraClass: 'red', cardExtraClass: 'critical-card' }
    ];

    grid.innerHTML = config.map((k, idx) => `
      <div class="kpi-card ${k.extraClass || ''} ${k.cardExtraClass || ''}" style="display:flex; flex-direction:column; align-items:stretch; gap:12px;">
        <div style="display:flex; align-items:center; gap:18px;">
          <div class="kpi-icon ${k.colorClass}"><i class="${k.icon}"></i></div>
          <div class="kpi-body">
            <div class="kpi-number">${k.number}</div>
            <div class="bilingual"><span class="en">${k.labelEn}</span><span class="hi">${k.labelHi}</span></div>
          </div>
        </div>
        <div class="kpi-sparkline" style="height:40px; margin-top:8px;">
          <canvas id="kpi-sparkline-${idx}"></canvas>
        </div>
      </div>
    `).join('');

    renderSparklines(config);
  }

  function renderSparklines(config) {
    config.forEach((k, idx) => {
      const ctx = document.getElementById(`kpi-sparkline-${idx}`);
      if (!ctx) return;

      if (_sparklines[idx]) _sparklines[idx].destroy();

      // Mock trend data
      const data = Array(12).fill(0).map(() => Math.round(Math.random() * 100));

      _sparklines[idx] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array(12).fill(''),
          datasets: [{
            data: data,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue(`--accent-${k.colorClass === 'blue' ? 'blue' : (k.colorClass === 'green' ? 'green' : (k.colorClass === 'amber' ? 'amber' : 'red'))}`).trim(),
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: false
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } }
        }
      });
    });
  }

  // ── Herd Grid ─────────────────────────────────────────────
  function renderHerdGrid() {
    const state = getState();
    const grid = document.getElementById('herd-grid');
    if (!grid) return;

    if (!state || state.isLoading) {
      grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="animal-card skeleton-pulse" style="height:150px; background:rgba(255,255,255,0.05); border:none;"></div>
      `).join('');
      return;
    }

    if (state.animals.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🐄</div>
          <h3>Initialize Your Farm</h3>
          <p>No animals detected. You can add them manually or use our AI seeder for a demo.</p>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:20px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="document.getElementById('open-add-animal-btn').click()">+ Add Manually</button>
            <button class="btn btn-secondary" onclick="DataSeeder.seedInitialData()" style="border-color:var(--accent-green); color:var(--accent-green);">
              <i class="fa-solid fa-wand-magic-sparkles"></i> AI Quick Setup
            </button>
          </div>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.animals.map(animal => {
      const sc = statusClass(animal.status);
      
      // Real-time vitals from the central store (vitals collection)
      const realTimeVitals = state.vitals ? state.vitals[animal.id] : null;
      
      // Fallback to the static vitals in the animal document (from seed/add)
      const temp = realTimeVitals ? realTimeVitals.temp : (animal.vitals ? animal.vitals.lastTemp : '—');
      const hr   = realTimeVitals ? realTimeVitals.hr   : (animal.vitals ? animal.vitals.lastHeartRate : '—');
      
      return `
        <div class="animal-card status-${sc.toLowerCase()}" data-id="${animal.id}" role="button" tabindex="0">
          <div class="animal-card-header">
            <span class="animal-emoji">${animal.emoji}</span>
            <div class="live-pulse">
              <svg viewBox="0 0 50 20" class="pulse-svg">
                <path d="M0 10 L10 10 L15 2 L20 18 L25 10 L50 10" class="pulse-path pulse-${sc.toLowerCase()}"></path>
              </svg>
            </div>
            <span class="badge badge-${sc.toLowerCase()}">${animal.status}</span>
          </div>
          <div class="animal-id">#${animal.animalId}</div>
          <div class="animal-species">${animal.species} · ${animal.breed}</div>
          <div class="animal-vitals">
            <span class="mini-vital">
              <i class="fa-solid fa-thermometer-half"></i>
              <span>${temp}${temp !== '—' ? '°C' : ''}</span>
            </span>
            <span class="mini-vital">
              <i class="fa-solid fa-heart-pulse"></i>
              <span>${hr}${hr !== '—' ? ' bpm' : ''}</span>
            </span>
          </div>
          <div class="card-footer">
            <span class="view-details">Tactical Overview <i class="fa-solid fa-chevron-right"></i></span>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.animal-card').forEach(card => {
      card.addEventListener('click', () => {
        if (window.openAnimalModal) window.openAnimalModal(card.dataset.id);
      });
    });
  }

  // ── Alert Ticker ──────────────────────────────────────────
  function renderTicker() {
    const state = getState();
    const track = document.getElementById('ticker-track');
    if (!track) return;

    if (!state || state.isLoading || state.alerts.filter(a => !a.resolved).length === 0) {
      track.innerHTML = '<span class="ticker-item">✅ All systems normal. No active alerts.</span>';
      return;
    }

    const activeAlerts = state.alerts.filter(a => !a.resolved);
    track.innerHTML = activeAlerts.map(a => {
      const animal = state.animals.find(x => x.animalId === a.animalId);
      const emoji = animal ? animal.emoji : '⚠️';
      const severityGlyph = a.severity === 'Critical' ? '⬢' : '⬡';
      const severityColor = a.severity === 'Critical' ? 'var(--accent-red)' : 'var(--accent-amber)';
      
      return `
        <span class="ticker-item" style="display:inline-flex; align-items:center; gap:8px;">
          <span style="color:${severityColor}; font-size:1.2rem; filter:drop-shadow(0 0 5px ${severityColor})">${severityGlyph}</span>
          <span class="tick-id" style="font-weight:800; color:var(--text-primary)">${emoji} #${a.animalId}</span>
          <span style="color:var(--text-muted)">//</span>
          <span style="color:var(--text-muted)">${a.parameter}: <span style="color:var(--text-primary)">${a.reading}</span></span>
        </span>
      `;
    }).join(' <span style="color:var(--border); margin:0 20px; opacity:0.3">/ / /</span> ');
  }

  // ── Header Display ────────────────────────────────────────
  function updateHeader() {
    const state = getState();
    const lastUpdEl = document.getElementById('last-updated-text');
    if (!lastUpdEl || !state) return;
    
    lastUpdEl.textContent = 'Syncing Live...';
    if (!state.isLoading) {
      lastUpdEl.textContent = 'Last sync: ' + new Date().toLocaleTimeString();
    }
  }

  // ── Initialization ────────────────────────────────────────
  function init() {
    updateBioScoreHub();
    renderKPIs();
    renderHerdGrid();
    renderTicker();
    updateHeader();

    document.addEventListener('kisanTrack:stateUpdated', () => {
      updateBioScoreHub();
      renderKPIs();
      renderHerdGrid();
      renderTicker();
      updateHeader();
    });
  }

  return { init };
})();
