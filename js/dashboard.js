/**
 * ============================================================
 * KisanTrack — Dashboard Module (dashboard.js)
 * KPI cards, Herd Grid, Alert Ticker
 * ============================================================
 */

const DashboardModule = (function () {
  'use strict';

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
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

    grid.innerHTML = config.map(k => `
      <div class="kpi-card ${k.extraClass || ''} ${k.cardExtraClass || ''}">
        <div class="kpi-icon ${k.colorClass}"><i class="${k.icon}"></i></div>
        <div class="kpi-body">
          <div class="kpi-number">${k.number}</div>
          <div class="bilingual"><span class="en">${k.labelEn}</span><span class="hi">${k.labelHi}</span></div>
        </div>
      </div>
    `).join('');
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
            <span class="view-details">Click for details <i class="fa-solid fa-chevron-right"></i></span>
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
      return `
        <span class="ticker-item">
          <span class="tick-severity">${a.severity === 'Critical' ? '🔴' : '🟡'} ${a.severity}</span>
          <span class="tick-id">${emoji} #${a.animalId}</span> — ${a.parameter}: ${a.reading}
        </span>
      `;
    }).join(' <span style="color:var(--border);margin:0 8px;">|</span> ');
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
    renderKPIs();
    renderHerdGrid();
    renderTicker();
    updateHeader();

    document.addEventListener('kisanTrack:stateUpdated', () => {
      renderKPIs();
      renderHerdGrid();
      renderTicker();
      updateHeader();
    });
  }

  return { init };
})();
