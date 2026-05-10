// ============================================
// KisanTrack — alerts.js
// Purpose: Alert Feed & Management Logic
// Page: alerts.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-09
// ============================================
const AlertsModule = (function () {
  'use strict';

  let currentFilter = 'all';

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function getSeverityClass(severity) {
    if (!severity) return 'info';
    return severity.toLowerCase();
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
          <div class="alert-stat-label">Total Alerts / कुल अलर्ट</div>
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
    if (!state || !state.alerts) return [];

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
      const animal = state.animals.find(x => x.animalId === a.animalId || x.id === a.animalId);
      const emoji = animal ? (animal.emoji || '🐄') : '🐄';
      const species = animal ? (animal.species || 'Animal') : 'Animal';

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
                Confidence: ${a.confidence || 0}%
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
          if (window.FirestoreStore) {
            await window.FirestoreStore.resolveAlert(btn.dataset.id);
            if (window.showToast) window.showToast('Alert resolved successfully!');
          }
        } catch (err) {
          if (window.showToast) window.showToast('Failed to resolve alert.', 'error');
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
        render();
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


/**
 * ReportsModule
 */
const ReportsModule = (function () {
  'use strict';

  let alertsChart  = null;
  let tempChart    = null;

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#A89F8C', font: { size: 11 } } },
      tooltip: { backgroundColor: '#2C2C1A', titleColor: '#F0EAD6', bodyColor: '#A89F8C' },
    },
    scales: {
      x: { ticks: { color: '#706860', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#706860', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

  async function fetchReportData(days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    if (!auth.currentUser) return null;
    const uid = auth.currentUser.uid;

    try {
      const vitalsSnap = await db.collection('vitals')
        .where('farmerId', '==', uid)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'asc')
        .get();

      const alertsSnap = await db.collection('alerts')
        .where('farmerId', '==', uid)
        .where('timestamp', '>=', startDate)
        .orderBy('timestamp', 'asc')
        .get();

      return aggregateData(vitalsSnap, alertsSnap, days);
    } catch (err) {
      console.error('Reports: Fetch error:', err);
      return null;
    }
  }

  function aggregateData(vitalsSnap, alertsSnap, days) {
    const labels = [];
    const avgTemp = [];
    const critical = [];
    const warning = [];
    const info = [];
    const tableRows = [];

    const dailyData = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      labels.push(dateStr);
      dailyData[dateStr] = { tempSum: 0, tempCount: 0, critical: 0, warning: 0, info: 0 };
    }

    vitalsSnap.forEach(doc => {
      const d = doc.data();
      if (!d.timestamp) return;
      const dateStr = d.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyData[dateStr]) {
        dailyData[dateStr].tempSum += d.bodyTempCelsius;
        dailyData[dateStr].tempCount++;
      }
    });

    alertsSnap.forEach(doc => {
      const d = doc.data();
      if (!d.timestamp) return;
      const dateStr = d.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyData[dateStr]) {
        if (d.severity === 'Critical') dailyData[dateStr].critical++;
        else if (d.severity === 'Warning') dailyData[dateStr].warning++;
        else dailyData[dateStr].info++;
      }
      
      tableRows.push({
        date: d.timestamp.toDate().toLocaleDateString(),
        animalId: d.animalId,
        parameter: d.parameter,
        reading: d.readingValue,
        severity: d.severity,
        confidence: d.confidenceScore || 95,
        status: d.resolved ? 'Resolved' : 'Pending'
      });
    });

    labels.forEach(l => {
      const day = dailyData[l];
      avgTemp.push(day.tempCount > 0 ? +(day.tempSum / day.tempCount).toFixed(1) : 38.5);
      critical.push(day.critical);
      warning.push(day.warning);
      info.push(day.info);
    });

    return { labels, avgTemp, critical, warning, info, tableRows };
  }

  async function renderReports(days) {
    const data = await fetchReportData(days);
    if (!data) return;

    if (alertsChart) alertsChart.destroy();
    const barEl = document.getElementById('report-alerts-chart');
    if (barEl) {
      alertsChart = new Chart(barEl.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [
            { label: 'Critical', data: data.critical, backgroundColor: 'rgba(192,57,43,0.75)', borderRadius: 3 },
            { label: 'Warning', data: data.warning, backgroundColor: 'rgba(229,161,0,0.75)', borderRadius: 3 },
            { label: 'Info', data: data.info, backgroundColor: 'rgba(59,130,246,0.65)', borderRadius: 3 }
          ],
        },
        options: { ...CHART_DEFAULTS, scales: { x: { ...CHART_DEFAULTS.scales.x, stacked: true }, y: { ...CHART_DEFAULTS.scales.y, stacked: true } } },
      });
    }

    if (tempChart) tempChart.destroy();
    const tempEl = document.getElementById('report-temp-chart');
    if (tempEl) {
      tempChart = new Chart(tempEl.getContext('2d'), {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{ label: 'Avg Herd Temp (°C)', data: data.avgTemp, borderColor: '#7CB518', backgroundColor: 'rgba(124,181,24,0.1)', tension: 0.4, fill: true }],
        },
        options: { ...CHART_DEFAULTS, scales: { y: { ...CHART_DEFAULTS.scales.y, min: 37.5, max: 40.5 } } }
      });
    }

    const tbody = document.getElementById('report-table-body');
    if (tbody) {
      tbody.innerHTML = data.tableRows.slice(0, 10).map(row => `
        <tr>
          <td>${row.date}</td>
          <td><strong>${row.animalId}</strong></td>
          <td>${row.parameter}</td>
          <td><strong>${row.reading}</strong></td>
          <td><span class="severity-chip chip-${row.severity.toLowerCase()}">${row.severity}</span></td>
          <td>${row.confidence}%</td>
          <td><span class="status-chip ${row.status.toLowerCase()}">${row.status}</span></td>
        </tr>
      `).join('');
    }

    window.currentReportData = data; 
  }

  function exportCSV() {
    const data = window.currentReportData;
    if (!data || !data.tableRows.length) {
      if (window.showToast) window.showToast('No data available to export.', 'warning');
      return;
    }

    const header = ['Date', 'Animal ID', 'Parameter', 'Reading', 'Severity', 'Confidence', 'Status'];
    const csvRows = [
      header.join(','),
      ...data.tableRows.map(r => [
        r.date, r.animalId, r.parameter, r.reading,
        r.severity, r.confidence, r.status
      ].map(v => `"${v}"`).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'kisantrack_report_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
  }

  function init() {
    const range = document.getElementById('date-range');
    if (range) range.addEventListener('change', (e) => renderReports(parseInt(e.target.value)));
    
    const exp = document.getElementById('export-csv-btn');
    if (exp) exp.addEventListener('click', exportCSV);
  }

  function onActivate() {
    const range = document.getElementById('date-range');
    const days = range ? parseInt(range.value) : 14;
    renderReports(days);
  }

  return { init, onActivate };
})();
