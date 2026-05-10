// ============================================
// KisanTrack — reports.js
// Purpose: Historical Reporting & Data Analytics
// Page: alerts.html (Reports Tab)
// Dependencies: Firebase, Chart.js
// Last Updated: 2026-05-09
// ============================================
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
