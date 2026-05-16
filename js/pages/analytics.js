// ============================================
// KisanTrack — analytics.js
// Purpose: Deep analytics and historical trend visualization
// Page: analytics.html
// Dependencies: Chart.js, Firebase, FirestoreStore
// Last Updated: 2026-05-17
// ============================================

const AnalyticsModule = (function () {
  'use strict';

  let chartAlerts = null;
  let chartVitals = null;
  let _cachedEvents = []; // Used by CSV export

  // ── Initialization ──────────────────────────────────────────
  function init() {
    setupListeners();

    // Show loading state in table immediately
    setTableLoading();

    // Seed charts with realistic mock data right away — replaced when real data loads
    seedChartsWithMock();

    // Wait for auth before fetching real data
    document.addEventListener('kisanTrack:stateUpdated', () => {
      refreshData();
    }, { once: true });

    // Re-refresh on range change after first load too
    document.addEventListener('kisanTrack:stateUpdated', () => {
      // subsequent updates — handled by the range change listener
    });
  }

  function setupListeners() {
    const rangeSelect = document.getElementById('report-date-range');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', () => refreshData());
    }

    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => exportToCSV());
    }
  }

  // ── Loading state for table ─────────────────────────────────
  function setTableLoading() {
    const tbody = document.getElementById('event-log-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:40px; color:var(--text-dim);">
            <i class="fa-solid fa-circle-notch fa-spin" style="margin-right:8px;"></i>
            Loading event history...
          </td>
        </tr>`;
    }
  }

  // ── Seed charts with mock data so they're never blank ────────
  function seedChartsWithMock() {
    const days = getDays();
    const labels = buildDateLabels(days);

    // Realistic-looking mock: low alert counts, mostly healthy temps
    const mockAlerts = labels.map(() => Math.floor(Math.random() * 3));
    const mockTemps  = labels.map(() => +(38.2 + Math.random() * 1.2).toFixed(1));

    renderCharts({ labels, alertCounts: mockAlerts, avgTemps: mockTemps }, true);
  }

  // ── Data Refresh ─────────────────────────────────────────────
  async function refreshData() {
    if (!auth.currentUser) return;

    const days = getDays();
    setTableLoading();

    try {
      const data = await fetchHistoricalData(days);
      renderCharts(data, false);
      renderTable(data.events);
      _cachedEvents = data.events;
    } catch (err) {
      console.error('Analytics: Error fetching data:', err);
      // Still clear the loading state with an informative message
      renderTable([]);
      _cachedEvents = [];
    }
  }

  function getDays() {
    const sel = document.getElementById('report-date-range');
    return sel ? parseInt(sel.value) : 14;
  }

  function buildDateLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString([], { month: 'short', day: 'numeric' }));
    }
    return labels;
  }

  // ── Firestore Fetch ──────────────────────────────────────────
  async function fetchHistoricalData(days) {
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const uid = auth.currentUser.uid;

    const [vitalsSnap, alertsSnap] = await Promise.all([
      db.collection('vitals')
        .where('farmerId', '==', uid)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'desc')
        .get()
        .catch(() => ({ docs: [] })),   // graceful fallback if index missing
      db.collection('alerts')
        .where('farmerId', '==', uid)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'desc')
        .get()
        .catch(() => ({ docs: [] })),
    ]);

    return processData(vitalsSnap, alertsSnap, days);
  }

  function processData(vitalsSnap, alertsSnap, days) {
    const labels = buildDateLabels(days);
    const dailyAlerts = {};
    const dailyTemps  = {};
    const events = [];

    labels.forEach(l => {
      dailyAlerts[l] = 0;
      dailyTemps[l]  = [];
    });

    // Process vitals
    vitalsSnap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.timestamp) return;
      const label = d.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyTemps[label] !== undefined && d.bodyTempCelsius) {
        dailyTemps[label].push(d.bodyTempCelsius);
      }
      events.push({
        timestamp: d.timestamp.toDate(),
        animalId:  d.animalId || 'Unknown',
        type:      'Vitals Log',
        status:    d.healthStatus || 'Healthy',
        action:    'Monitoring',
      });
    });

    // Process alerts
    alertsSnap.docs.forEach(doc => {
      const d = doc.data();
      if (!d.timestamp) return;
      const label = d.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyAlerts[label] !== undefined) dailyAlerts[label]++;

      events.push({
        timestamp: d.timestamp.toDate(),
        animalId:  d.animalId || 'Unknown',
        type:      'Alert: ' + (d.alertType || d.parameter || 'Health'),
        status:    d.severity || 'Warning',
        action:    d.resolved ? 'Resolved' : 'Pending',
      });
    });

    const alertCounts = labels.map(l => dailyAlerts[l]);
    const avgTemps = labels.map(l => {
      const temps = dailyTemps[l];
      // If no data for this day, use 38.5 as the baseline (healthy cow temp)
      // so the chart always has a visible line instead of 0 gaps
      return temps.length
        ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
        : 38.5;
    });

    return {
      labels,
      alertCounts,
      avgTemps,
      events: events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50),
    };
  }

  // ── Charts ───────────────────────────────────────────────────
  function renderCharts(data, isMock) {
    const mockNote = isMock ? ' (sample)' : '';

    // Alert Frequency Chart
    const ctxAlerts = document.getElementById('chart-alert-trends');
    if (ctxAlerts) {
      if (chartAlerts) chartAlerts.destroy();
      chartAlerts = new Chart(ctxAlerts.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Alerts' + mockNote,
            data: data.alertCounts,
            backgroundColor: 'rgba(229,161,0,0.45)',
            borderColor: 'rgba(229,161,0,0.9)',
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: makeChartOptions({ yMin: 0 }),
      });
    }

    // Herd Avg Temp Chart
    const ctxVitals = document.getElementById('chart-vital-averages');
    if (ctxVitals) {
      if (chartVitals) chartVitals.destroy();
      chartVitals = new Chart(ctxVitals.getContext('2d'), {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Avg Temp (°C)' + mockNote,
            data: data.avgTemps,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124,181,24,0.12)',
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            borderWidth: 2,
          }],
        },
        options: makeChartOptions({ yMin: 37, yMax: 42 }),
      });
    }
  }

  function makeChartOptions({ yMin, yMax } = {}) {
    const scaleY = {
      grid:  { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } },
    };
    if (yMin !== undefined) scaleY.min = yMin;
    if (yMax !== undefined) scaleY.max = yMax;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 }, maxTicksLimit: 8 } },
        y: scaleY,
      },
    };
  }

  // ── Event Log Table ──────────────────────────────────────────
  function renderTable(events) {
    const tbody = document.getElementById('event-log-body');
    if (!tbody) return;

    if (!events || events.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:48px; color:var(--text-dim);">
            <div style="font-size:2rem;margin-bottom:12px;">📋</div>
            <div>No events recorded in this time range.</div>
            <div style="font-size:0.8rem;margin-top:6px;opacity:0.6;">
              Events appear here as vitals readings and alerts are generated.
            </div>
          </td>
        </tr>`;
      return;
    }

    const statusColour = s => {
      s = (s || '').toLowerCase();
      if (s === 'healthy' || s === 'resolved') return 'var(--accent-green)';
      if (s === 'warning') return 'var(--accent-amber)';
      if (s === 'critical') return 'var(--accent-red)';
      return 'var(--text-muted)';
    };

    tbody.innerHTML = events.map(e => `
      <tr>
        <td>${e.timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td><strong>${e.animalId}</strong></td>
        <td>${e.type}</td>
        <td>
          <span style="background:${statusColour(e.status)}18; color:${statusColour(e.status)};
                padding:2px 9px; border-radius:12px; font-size:0.75rem; font-weight:600;">
            ${e.status}
          </span>
        </td>
        <td>${e.action}</td>
      </tr>`).join('');
  }

  // ── CSV Export ───────────────────────────────────────────────
  function exportToCSV() {
    if (!_cachedEvents || _cachedEvents.length === 0) {
      if (window.showToast) window.showToast('No data to export. Try a wider date range.', 'error');
      return;
    }

    const header = ['Date', 'Animal ID', 'Event Type', 'Status', 'Action'];
    const rows = _cachedEvents.map(e => [
      e.timestamp.toLocaleString(),
      e.animalId,
      e.type,
      e.status,
      e.action,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KisanTrack_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (window.showToast) window.showToast(`✓ Exported ${_cachedEvents.length} events to CSV`);
  }

  return { init };
})();
