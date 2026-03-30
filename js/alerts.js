/**
 * ============================================================
 * KisanTrack — Alerts Module (alerts.js)
 * Alert feed, filter tabs, mark resolved, summary stats
 * ============================================================
 */

const AlertsModule = (function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  // Work with a local copy so we can mutate resolved state
  let alertsState = APP_DATA.alerts.map(a => ({ ...a }));
  let currentFilter = 'all';

  // ── Helpers ───────────────────────────────────────────────
  function getAnimalEmoji(id) {
    const a = APP_DATA.animals.find(x => x.id === id);
    return a ? a.emoji : '🐄';
  }

  function getAnimalSpecies(id) {
    const a = APP_DATA.animals.find(x => x.id === id);
    return a ? a.species : 'Animal';
  }

  function getSeverityClass(severity) {
    return severity === 'Critical' ? 'critical'
         : severity === 'Warning'  ? 'warning'
         : 'info';
  }

  // ── Stats Row ─────────────────────────────────────────────
  function renderStats() {
    const total    = alertsState.length;
    const resolved = alertsState.filter(a => a.resolved).length;
    const pending  = total - resolved;

    const statsRow = document.getElementById('alert-stats-row');
    statsRow.innerHTML = `
      <div class="alert-stat-card">
        <div class="alert-stat-icon amber"><i class="fa-solid fa-bell"></i></div>
        <div>
          <div class="alert-stat-num">${total}</div>
          <div class="alert-stat-label">Total Alerts Today / आज के अलर्ट</div>
        </div>
      </div>
      <div class="alert-stat-card">
        <div class="alert-stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
        <div>
          <div class="alert-stat-num" style="color:var(--accent-green)">${resolved}</div>
          <div class="alert-stat-label">Resolved / हल हुए</div>
        </div>
      </div>
      <div class="alert-stat-card">
        <div class="alert-stat-icon blue"><i class="fa-solid fa-clock"></i></div>
        <div>
          <div class="alert-stat-num" style="color:var(--accent-amber)">${pending}</div>
          <div class="alert-stat-label">Pending / लंबित</div>
        </div>
      </div>
    `;

    // Update sidebar badge
    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline' : 'none';
    }
  }

  // ── Alert Feed ────────────────────────────────────────────
  function getFilteredAlerts() {
    return alertsState.filter(a => {
      if (currentFilter === 'all')      return true;
      if (currentFilter === 'resolved') return a.resolved;
      return a.severity === currentFilter && !a.resolved;
    }).sort((a, b) => a.resolved - b.resolved); // unresolved first
  }

  function renderFeed() {
    const feed    = document.getElementById('alert-feed');
    const alerts  = getFilteredAlerts();

    if (!alerts.length) {
      feed.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No alerts match this filter.<br>इस फ़िल्टर से कोई अलर्ट नहीं।</p>
        </div>`;
      return;
    }

    feed.innerHTML = alerts.map(a => {
      const sc      = getSeverityClass(a.severity);
      const emoji   = getAnimalEmoji(a.animalId);
      const species = getAnimalSpecies(a.animalId);

      const actionBtns = a.resolved
        ? `<div class="resolved-mark"><i class="fa-solid fa-circle-check"></i> Resolved / हल हुआ</div>`
        : `
          <div class="alert-actions">
            <button class="btn btn-sm btn-secondary resolve-btn" data-id="${a.id}">
              <i class="fa-solid fa-check"></i> Mark Resolved
            </button>
            <button class="btn btn-sm btn-secondary view-animal-btn" data-id="${a.animalId}">
              <i class="fa-solid fa-eye"></i> View Animal
            </button>
          </div>
        `;

      return `
        <div class="alert-card ${a.resolved ? 'resolved' : ''} ${sc}-alert" data-alert="${a.id}">
          <div class="alert-card-top">
            <div class="alert-animal">
              <span class="animal-icon">${emoji}</span>
              <span class="alert-animal-id">${species} #${a.animalId}</span>
            </div>
            <span class="badge badge-${a.resolved ? 'resolved' : sc}">
              ${a.resolved ? '✓ Resolved' : a.severity}
            </span>
          </div>

          <div class="alert-reading">
            <i class="fa-solid fa-${sc === 'critical' ? 'circle-exclamation' : sc === 'warning' ? 'triangle-exclamation' : 'circle-info'}"></i>
            ${a.parameter}: <strong>${a.value}</strong>
          </div>

          <p class="alert-note">${a.note}</p>

          <div class="alert-meta">
            <span class="alert-time">
              <i class="fa-regular fa-clock"></i>
              ${a.timestamp}
              &nbsp;·&nbsp;
              <span class="badge" style="background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.2);padding:2px 8px;font-size:0.7rem;">
                Confidence: ${a.confidence}%
              </span>
            </span>
            ${actionBtns}
          </div>
        </div>
      `;
    }).join('');

    // Attach resolve handlers
    feed.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.addEventListener('click', () => resolveAlert(btn.dataset.id));
    });

    // Attach view-animal handlers
    feed.querySelectorAll('.view-animal-btn').forEach(btn => {
      btn.addEventListener('click', () => window.openAnimalModal(btn.dataset.id));
    });
  }

  // ── Mark Resolved ─────────────────────────────────────────
  function resolveAlert(alertId) {
    const alert = alertsState.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      render();

      // Also update the APP_DATA for global consistency
      const globalAlert = APP_DATA.alerts.find(a => a.id === alertId);
      if (globalAlert) globalAlert.resolved = true;
    }
  }

  // ── Filter Bar ────────────────────────────────────────────
  function initFilters() {
    const bar = document.getElementById('alert-filter-bar');
    bar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderFeed();
      });
    });
  }

  // ── Public ────────────────────────────────────────────────
  function render() {
    renderStats();
    renderFeed();
  }

  function init() {
    render();
    initFilters();
  }

  return { init, render };
})();
