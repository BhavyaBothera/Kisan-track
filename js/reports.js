/**
 * ============================================================
 * KisanTrack — Reports Module (reports.js)
 * Stacked bar chart, line chart, data table, CSV export
 * ============================================================
 */

const ReportsModule = (function () {
  'use strict';

  let alertsChart  = null;
  let tempChart    = null;
  let chartsReady  = false;

  // ── Chart defaults ─────────────────────────────────────────
  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeInOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#A89F8C',
          font: { family: "'Noto Sans', sans-serif", size: 11 },
          boxWidth: 12,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#2C2C1A',
        titleColor: '#F0EAD6',
        bodyColor: '#A89F8C',
        borderColor: '#3D3D28',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#706860', font: { size: 10 }, maxRotation: 30 },
        grid: { color: 'rgba(61,61,40,0.35)' },
      },
      y: {
        ticks: { color: '#706860', font: { size: 10 } },
        grid: { color: 'rgba(61,61,40,0.35)' },
      },
    },
  };

  // ── Render Charts ──────────────────────────────────────────
  function renderCharts(days) {
    const hist   = APP_DATA.history;
    const labels = hist.labels.slice(-days);
    const critical= hist.alertCounts.critical.slice(-days);
    const warning = hist.alertCounts.warning.slice(-days);
    const info    = hist.alertCounts.info.slice(-days);
    const avgTemp = hist.avgTemp.slice(-days);

    // ── Stacked bar chart ────────────────────────────────────
    if (alertsChart) alertsChart.destroy();
    const barCtx = document.getElementById('report-alerts-chart').getContext('2d');
    alertsChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Critical',
            data: critical,
            backgroundColor: 'rgba(192,57,43,0.75)',
            borderRadius: 3,
          },
          {
            label: 'Warning',
            data: warning,
            backgroundColor: 'rgba(229,161,0,0.75)',
            borderRadius: 3,
          },
          {
            label: 'Info',
            data: info,
            backgroundColor: 'rgba(59,130,246,0.65)',
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          x: { ...CHART_DEFAULTS.scales.x, stacked: true },
          y: { ...CHART_DEFAULTS.scales.y, stacked: true,
               title: { display: true, text: 'Alerts', color: '#A89F8C', font: { size: 11 } } },
        },
      },
    });

    // ── Temperature line chart ───────────────────────────────
    if (tempChart) tempChart.destroy();
    const tempCtx = document.getElementById('report-temp-chart').getContext('2d');
    tempChart = new Chart(tempCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Herd Temp (°C)',
            data: avgTemp,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124,181,24,0.1)',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#7CB518',
            fill: true,
          },
          {
            label: 'Safe Upper (39.5°C)',
            data: Array(labels.length).fill(39.5),
            borderColor: 'rgba(229,161,0,0.5)',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            min: 38.0,
            title: { display: true, text: '°C', color: '#A89F8C', font: { size: 11 } },
          },
        },
      },
    });

    chartsReady = true;
  }

  // ── Render Table ──────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = APP_DATA.history.tableRows.map(row => `
      <tr>
        <td>${row.date}</td>
        <td><strong style="color:var(--text-primary)">${row.animalId}</strong></td>
        <td>${row.parameter}</td>
        <td><strong style="color:var(--text-primary)">${row.reading}</strong></td>
        <td>
          <span class="severity-chip chip-${row.severity.toLowerCase()}">
            ${row.severity}
          </span>
        </td>
        <td>${row.confidence}</td>
        <td>
          <span class="status-chip ${row.status.toLowerCase()}">
            ${row.status}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // ── CSV Export ────────────────────────────────────────────
  function exportCSV() {
    const rows   = APP_DATA.history.tableRows;
    const header = ['Date', 'Animal ID', 'Parameter', 'Reading', 'Severity', 'Confidence', 'Status'];
    const csvRows = [
      header.join(','),
      ...rows.map(r => [
        r.date, r.animalId, r.parameter, r.reading,
        r.severity, r.confidence, r.status
      ].map(v => `"${v}"`).join(','))
    ];

    const csv  = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'kisantrack_report_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Date Range Selector ───────────────────────────────────
  function initControls() {
    const dateRangeSel = document.getElementById('date-range');
    dateRangeSel.addEventListener('change', () => {
      renderCharts(parseInt(dateRangeSel.value));
    });

    document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  }

  // ── On Tab Activate ───────────────────────────────────────
  function onActivate() {
    if (!chartsReady) {
      const days = parseInt(document.getElementById('date-range').value) || 14;
      renderCharts(days);
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    renderTable();
    initControls();
  }

  return { init, onActivate };
})();
