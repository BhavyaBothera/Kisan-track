/**
 * ============================================================
 * KisanTrack — Alerts Module (alerts.js)
 * Alert feed, filter tabs, mark resolved, summary stats
 * ============================================================
 */

const AlertsModule = (function () {
  'use strict';

  let currentFilter = 'all';

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function getSeverityClass(severity) {
    return severity === 'Critical' ? 'critical'
         : severity === 'Warning'  ? 'warning'
         : 'info';
  }

  // ── Stats Row ─────────────────────────────────────────────
  function renderStats() {
    const state = getState();
    const statsRow = document.getElementById('alert-stats-row');
    if (!statsRow || !state) return;

    const total    = state.alerts.length;
    const resolved = state.alerts.filter(a => a.resolved).length;
    const pending  = total - resolved;

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

    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline' : 'none';
    }
  }

  // ── Alert Feed ────────────────────────────────────────────
  function getFilteredAlerts() {
    const state = getState();
    if (!state) return [];

    return state.alerts.filter(a => {
      if (currentFilter === 'all')      return true;
      if (currentFilter === 'resolved') return a.resolved;
      return a.severity === currentFilter && !a.resolved;
    }).sort((a, b) => a.resolved - b.resolved);
  }

  function renderFeed() {
    const feed = document.getElementById('alert-feed');
    if (!feed) return;

    const state = getState();
    if (!state || state.isLoading) {
      feed.innerHTML = Array(3).fill(0).map(() => `
        <div class="alert-card skeleton-pulse" style="height:120px; background:rgba(255,255,255,0.05); border:none; margin-bottom:1rem;"></div>
      `).join('');
      return;
    }

    const alerts = getFilteredAlerts();

    if (!alerts.length) {
      feed.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No alerts match this filter.<br>इस फ़िल्टर से कोई अलर्ट नहीं।</p>
        </div>`;
      return;
    }

    feed.innerHTML = alerts.map(a => {
      const sc = getSeverityClass(a.severity);
      const animal = state.animals.find(x => x.animalId === a.animalId);
      const emoji = animal ? animal.emoji : '🐄';
      const species = animal ? animal.species : 'Animal';

      const actionBtns = a.resolved
        ? `<div class="resolved-mark"><i class="fa-solid fa-circle-check"></i> Resolved / हल हुआ</div>`
        : `
          <div class="alert-actions">
            <button class="btn btn-sm btn-secondary resolve-btn" data-id="${a.id}">
              <i class="fa-solid fa-check"></i> Mark Resolved
            </button>
            <button class="btn btn-sm btn-secondary view-animal-btn" data-id="${animal ? animal.id : ''}">
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
            ${a.parameter}: <strong>${a.reading}</strong>
          </div>
          <p class="alert-note">${a.alertType || a.parameter}</p>
          <div class="alert-meta">
            <span class="alert-time">
              <i class="fa-regular fa-clock"></i>
              ${a.timestamp.toLocaleString()}
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

    feed.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await window.FirestoreStore.resolveAlert(btn.dataset.id);
          showToast('Alert resolved successfully!');
        } catch (err) {
          showToast('Failed to resolve alert.', 'error');
        }
      });
    });

    feed.querySelectorAll('.view-animal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openAnimalModal) window.openAnimalModal(btn.dataset.id);
      });
    });
  }

  // ── Filter Bar ────────────────────────────────────────────
  function initFilters() {
    const bar = document.getElementById('alert-filter-bar');
    if (!bar) return;
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

    document.addEventListener('kisanTrack:stateUpdated', () => {
      render();
    });
  }

  return { init, render };
})();
