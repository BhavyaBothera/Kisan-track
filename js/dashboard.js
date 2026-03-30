/**
 * ============================================================
 * KisanTrack — Dashboard Module (dashboard.js)
 * KPI cards, Herd Grid, Alert Ticker
 * ============================================================
 */

const DashboardModule = (function () {
  'use strict';

  // ── Helpers ───────────────────────────────────────────────
  function statusClass(status) {
    return status === 'Healthy' ? 'healthy'
         : status === 'Warning' ? 'warning'
         : 'critical';
  }

  function getAnimalEmoji(animal) {
    return animal.emoji;
  }

  // ── KPI Cards ─────────────────────────────────────────────
  function renderKPIs() {
    const animals  = APP_DATA.animals;
    const total    = animals.length;
    const healthy  = animals.filter(a => a.status === 'Healthy').length;
    const warnings = animals.filter(a => a.status === 'Warning').length;
    const critical = animals.filter(a => a.status === 'Critical').length;

    const kpis = [
      {
        icon: 'fa-solid fa-cow',
        colorClass: 'blue',
        number: total,
        numberClass: 'white',
        labelEn: 'Total Animals',
        labelHi: 'कुल पशु',
      },
      {
        icon: 'fa-solid fa-heart',
        colorClass: 'green',
        number: healthy,
        numberClass: 'green',
        labelEn: 'Healthy',
        labelHi: 'स्वस्थ',
        extraClass: 'green',
      },
      {
        icon: 'fa-solid fa-triangle-exclamation',
        colorClass: 'amber',
        number: warnings,
        numberClass: 'amber',
        labelEn: 'Alerts Active',
        labelHi: 'सक्रिय अलर्ट',
        extraClass: 'amber',
      },
      {
        icon: 'fa-solid fa-circle-exclamation',
        colorClass: 'red',
        number: critical,
        numberClass: 'red',
        labelEn: 'Critical Cases',
        labelHi: 'गंभीर मामले',
        extraClass: 'red',
        cardExtraClass: 'critical-card',
      },
    ];

    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.extraClass || ''} ${k.cardExtraClass || ''}">
        <div class="kpi-icon ${k.colorClass}">
          <i class="${k.icon}"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-number ${k.numberClass}">${k.number}</div>
          <div class="bilingual">
            <span class="en">${k.labelEn}</span>
            <span class="hi">${k.labelHi}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ── Herd Grid ─────────────────────────────────────────────
  function renderHerdGrid() {
    const grid = document.getElementById('herd-grid');

    grid.innerHTML = APP_DATA.animals.map(animal => {
      const sc = statusClass(animal.status);
      const actLabel = typeof animal.vitals.activity === 'number'
        ? animal.vitals.activity + '%'
        : animal.vitals.activity;

      return `
        <div class="animal-card status-${sc.toLowerCase()}"
             data-id="${animal.id}"
             role="button"
             tabindex="0"
             aria-label="View details for ${animal.species} ${animal.id}">
          <div class="animal-card-header">
            <span class="animal-emoji">${animal.emoji}</span>
            <span class="badge badge-${sc.toLowerCase()}">${animal.status}</span>
          </div>
          <div class="animal-id">#${animal.id}</div>
          <div class="animal-species">${animal.species} · ${animal.breed}</div>
          <div class="animal-vitals">
            <span class="mini-vital">
              <i class="fa-solid fa-thermometer-half"></i>
              <span>${animal.vitals.temp}°C</span>
            </span>
            <span class="mini-vital">
              <i class="fa-solid fa-heart-pulse"></i>
              <span>${animal.vitals.hr} bpm</span>
            </span>
            <span class="mini-vital">
              <i class="fa-solid fa-person-running"></i>
              <span>${actLabel}</span>
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Click / keyboard handlers
    grid.querySelectorAll('.animal-card').forEach(card => {
      card.addEventListener('click', () => window.openAnimalModal(card.dataset.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.openAnimalModal(card.dataset.id);
        }
      });
    });
  }

  // ── Alert Ticker ──────────────────────────────────────────
  function renderTicker() {
    const track    = document.getElementById('ticker-track');
    const alerts   = APP_DATA.alerts.filter(a => !a.resolved);

    if (!alerts.length) {
      track.innerHTML = '<span class="ticker-item">✅ No active alerts at this time</span>';
      return;
    }

    // Duplicate items to create seamless loop
    const items = [...alerts, ...alerts].map(a => {
      const severityIcon = a.severity === 'Critical' ? '🔴' : '⚠️';
      const animal = APP_DATA.animals.find(x => x.id === a.animalId);
      const emoji  = animal ? animal.emoji : '🐄';
      return `
        <span class="ticker-item">
          <span class="tick-severity">${severityIcon} ${a.severity}</span>
          <span class="tick-id">${emoji} ${animal ? animal.species : ''} #${a.animalId}</span>
          — ${a.parameter}: ${a.value}
          <span class="tick-time">· ${a.timestamp}</span>
        </span>
        <span style="color:var(--border);margin:0 8px;">|</span>
      `;
    }).join('');

    track.innerHTML = items;
  }

  // ── Public API ────────────────────────────────────────────
  function init() {
    renderKPIs();
    renderHerdGrid();
    renderTicker();
  }

  return { init };
})();
