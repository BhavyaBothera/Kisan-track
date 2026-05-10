// ============================================
// KisanTrack — analytics.js
// Purpose: Deep analytics and historical trend visualization
// Page: analytics.html
// Dependencies: Chart.js, Firebase
// ============================================

const AnalyticsModule = (function () {
  'use strict';

  let chartAlerts = null;
  let chartVitals = null;

  // ── Initialization ─────────────────────────────────────────
  function init() {
    setupListeners();
    refreshData();
    
    // Listen for state changes
    document.addEventListener('kisanTrack:stateUpdated', () => {
      refreshData();
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

  // ── Data Fetching & Processing ─────────────────────────────
  async function refreshData() {
    const rangeSelect = document.getElementById('report-date-range');
    const days = rangeSelect ? parseInt(rangeSelect.value) : 14;
    
    if (!auth.currentUser) return;

    try {
      const data = await fetchHistoricalData(days);
      renderCharts(data);
      renderTable(data.events);
    } catch (err) {
      console.error('Analytics: Error refreshing data:', err);
    }
  }

  async function fetchHistoricalData(days) {
    const now = new Date();
    const startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const [vitalsSnap, alertsSnap] = await Promise.all([
      db.collection('vitals')
        .where('farmerId', '==', auth.currentUser.uid)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'desc')
        .get(),
      db.collection('alerts')
        .where('farmerId', '==', auth.currentUser.uid)
        .where('timestamp', '>=', startTime)
        .orderBy('timestamp', 'desc')
        .get()
    ]);

    return processData(vitalsSnap, alertsSnap, days);
  }

  function processData(vitalsSnap, alertsSnap, days) {
    const labels = [];
    const alertCounts = [];
    const avgTemps = [];
    const events = [];

    // Initialize daily maps
    const dailyAlerts = {};
    const dailyTemps = {};

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      labels.push(dStr);
      dailyAlerts[dStr] = 0;
      dailyTemps[dStr] = [];
    }

    // Process Vitals
    vitalsSnap.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      const dStr = data.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyTemps[dStr] !== undefined) {
        dailyTemps[dStr].push(data.bodyTempCelsius);
      }
      
      // Add to event log
      events.push({
        timestamp: data.timestamp.toDate(),
        animalId: data.animalId || 'Unknown',
        type: 'Vitals Log',
        status: data.healthStatus || 'Healthy',
        action: 'Monitoring'
      });
    });

    // Process Alerts
    alertsSnap.forEach(doc => {
      const data = doc.data();
      if (!data.timestamp) return;
      const dStr = data.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyAlerts[dStr] !== undefined) {
        dailyAlerts[dStr]++;
      }

      // Add to event log
      events.push({
        timestamp: data.timestamp.toDate(),
        animalId: data.animalId || 'Unknown',
        type: 'Alert: ' + data.alertType,
        status: data.severity || 'Warning',
        action: data.resolved ? 'Resolved' : 'Pending'
      });
    });

    // Finalize Arrays
    labels.forEach(l => {
      alertCounts.push(dailyAlerts[l]);
      const temps = dailyTemps[l];
      const avg = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 0;
      avgTemps.push(avg);
    });

    return { labels, alertCounts, avgTemps, events: events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50) };
  }

  // ── Rendering ──────────────────────────────────────────────
  function renderCharts(data) {
    // Alert Trends Chart
    const ctxAlerts = document.getElementById('chart-alert-trends');
    if (ctxAlerts) {
      if (chartAlerts) chartAlerts.destroy();
      chartAlerts = new Chart(ctxAlerts.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Alert Count',
            data: data.alertCounts,
            backgroundColor: 'rgba(229, 161, 0, 0.4)',
            borderColor: 'rgba(229, 161, 0, 1)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: chartOptions('Daily Alerts')
      });
    }

    // Vital Averages Chart
    const ctxVitals = document.getElementById('chart-vital-averages');
    if (ctxVitals) {
      if (chartVitals) chartVitals.destroy();
      chartVitals = new Chart(ctxVitals.getContext('2d'), {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Avg Body Temp (°C)',
            data: data.avgTemps,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124, 181, 24, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: chartOptions('Avg Temp')
      });
    }
  }

  function chartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } } }
      }
    };
  }

  function renderTable(events) {
    const tbody = document.getElementById('event-log-body');
    if (!tbody) return;

    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">No events found in this range.</td></tr>';
      return;
    }

    tbody.innerHTML = events.map(e => `
      <tr>
        <td>${e.timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td><strong>${e.animalId}</strong></td>
        <td>${e.type}</td>
        <td><span class="status-pill ${e.status.toLowerCase()}">${e.status}</span></td>
        <td>${e.action}</td>
      </tr>
    `).join('');
  }

  // ── CSV Export ─────────────────────────────────────────────
  function exportToCSV() {
    const tbody = document.getElementById('event-log-body');
    if (!tbody || tbody.rows.length <= 1) {
      showToast('No data available to export.', 'error');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Date,Animal,Event,Status,Action\n";
    
    // We can either scrape the table or use the processed data. Scaping is easier for the current module scope.
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(row => {
      const cols = Array.from(row.querySelectorAll('td')).map(c => `"${c.innerText.replace(/"/g, '""')}"`);
      csvContent += cols.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KisanTrack_Analytics_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Analytics report exported successfully!', 'success');
  }

  return { init };
})();
