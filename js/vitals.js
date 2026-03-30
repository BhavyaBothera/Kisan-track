/**
 * ============================================================
 * KisanTrack — Vitals Module (vitals.js)
 * Animal selector, circular gauges, live Chart.js,
 * AI health summary, confidence bar
 * ============================================================
 */

const VitalsModule = (function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let selectedAnimalId  = null;
  let chartTemp         = null;
  let chartHR           = null;
  let chartActivity     = null;
  let liveInterval      = null;
  let liveReadings      = {
    labels: [],
    temp: [],
    hr: [],
    activity: [],
  };
  const MAX_READINGS    = 20;

  // ── Gauge circumference (r=40 circle in 100x100 viewBox) ─
  const CIRCUMFERENCE   = 2 * Math.PI * 40; // ≈ 251.33

  // ── Populate selector ─────────────────────────────────────
  function populateSelector() {
    const select = document.getElementById('vitals-animal-select');
    select.innerHTML = APP_DATA.animals.map(a => `
      <option value="${a.id}">${a.emoji} ${a.species} #${a.id} (${a.breed}) — ${a.status}</option>
    `).join('');

    select.addEventListener('change', () => {
      selectedAnimalId = select.value;
      initLiveData();
      updateGauges();
      updateAISummary();
    });

    // Default to first animal
    selectedAnimalId = APP_DATA.animals[0].id;
    select.value = selectedAnimalId;
  }

  // ── Gauge Update ──────────────────────────────────────────
  function updateGauge(fillEl, valueEl, value, min, max) {
    const pct    = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const offset = CIRCUMFERENCE * (1 - pct);
    fillEl.style.strokeDashoffset = offset;

    // Color based on whether in range
    const inRange = value >= min && value <= max;
    fillEl.classList.remove('green', 'amber', 'red', 'blue');
    if (fillEl.id === 'gauge-act-fill') {
      fillEl.classList.add('blue');
    } else {
      fillEl.classList.add(inRange ? 'green' : (value > max ? 'red' : 'amber'));
    }
    valueEl.textContent = typeof value === 'number' ? value.toFixed(1) : value;
  }

  function updateGauges() {
    const animal = APP_DATA.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    const readings = liveReadings;
    const temp = readings.temp.length ? readings.temp[readings.temp.length - 1] : animal.baseVitals.temp;
    const hr   = readings.hr.length   ? readings.hr[readings.hr.length - 1]     : animal.baseVitals.hr;
    const act  = readings.activity.length ? readings.activity[readings.activity.length - 1] : animal.baseVitals.activity;

    updateGauge(
      document.getElementById('gauge-temp-fill'),
      document.getElementById('gauge-temp-val'),
      temp, 36.5, 41.0
    );
    updateGauge(
      document.getElementById('gauge-hr-fill'),
      document.getElementById('gauge-hr-val'),
      hr, 40, 120
    );
    updateGauge(
      document.getElementById('gauge-act-fill'),
      document.getElementById('gauge-act-val'),
      act, 0, 100
    );
  }

  // ── Initialize live data buffer ───────────────────────────
  function initLiveData() {
    const animal = APP_DATA.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    liveReadings = { labels: [], temp: [], hr: [], activity: [] };

    // Seed 10 initial readings
    for (let i = 10; i >= 1; i--) {
      liveReadings.labels.push(formatTime(new Date(Date.now() - i * 60000)));
      liveReadings.temp.push(+fluctuate(animal.baseVitals.temp, 0.15).toFixed(1));
      liveReadings.hr.push(Math.round(fluctuate(animal.baseVitals.hr, 2)));
      liveReadings.activity.push(Math.round(fluctuate(animal.baseVitals.activity, 5)));
    }

    if (chartTemp) { updateCharts(); }
  }

  // ── Chart factory ─────────────────────────────────────────
  function makeChart(canvasId, label, data, color, unit, minY, maxY, safeMin, safeMax) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const safeColor = color + '22'; // ~13% opacity fill for safe band

    return new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: liveReadings.labels,
        datasets: [
          {
            label,
            data,
            borderColor: color,
            backgroundColor: color + '14',
            tension: 0.42,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            fill: true,
            borderWidth: 2,
          },
          // Safe-range upper reference line
          {
            label: `Safe max (${safeMax} ${unit})`,
            data: Array(MAX_READINGS).fill(safeMax),
            borderColor: color + '55',
            borderDash: [5, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
          },
          // Safe-range lower reference line
          {
            label: `Safe min (${safeMin} ${unit})`,
            data: Array(MAX_READINGS).fill(safeMin),
            borderColor: color + '33',
            borderDash: [3, 4],
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeInOutQuart' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2C2C1A',
            titleColor: '#F0EAD6',
            bodyColor: '#A89F8C',
            borderColor: '#3D3D28',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#706860', font: { size: 9 }, maxRotation: 0, maxTicksLimit: 6 },
            grid: { color: 'rgba(61,61,40,0.3)' },
          },
          y: {
            min: minY,
            max: maxY,
            ticks: { color, font: { size: 9 } },
            grid: { color: 'rgba(61,61,40,0.3)' },
            title: { display: true, text: unit, color, font: { size: 10 } },
          },
        },
      },
    });
  }

  // ── Create all 3 charts ───────────────────────────────────
  function createCharts() {
    if (chartTemp)     { chartTemp.destroy();     chartTemp = null; }
    if (chartHR)       { chartHR.destroy();       chartHR = null; }
    if (chartActivity) { chartActivity.destroy(); chartActivity = null; }

    chartTemp     = makeChart('chart-temp',     'Temperature (°C)', liveReadings.temp,     '#7CB518', '°C',  36.0, 42.0, 38.0, 39.5);
    chartHR       = makeChart('chart-hr',       'Heart Rate (bpm)', liveReadings.hr,       '#E5A100', 'bpm', 40,   130,  60,   80);
    chartActivity = makeChart('chart-activity', 'Activity (%)',     liveReadings.activity, '#3B82F6', '%',   0,    100,  40,   80);
  }

  // ── Update all 3 charts ───────────────────────────────────
  function updateCharts() {
    function syncChart(chart, newData, refMax, refMin) {
      if (!chart) return;
      chart.data.labels = [...liveReadings.labels];
      chart.data.datasets[0].data = [...newData];
      // Keep reference lines at full length
      chart.data.datasets[1].data = Array(liveReadings.labels.length).fill(refMax);
      chart.data.datasets[2].data = Array(liveReadings.labels.length).fill(refMin);
      chart.update('none');
    }
    syncChart(chartTemp,     liveReadings.temp,     39.5, 38.0);
    syncChart(chartHR,       liveReadings.hr,       80,   60);
    syncChart(chartActivity, liveReadings.activity, 80,   40);
  }

  // ── Push new readings ─────────────────────────────────────
  function pushReading() {
    const animal = APP_DATA.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    const now = formatTime(new Date());
    liveReadings.labels.push(now);
    liveReadings.temp.push(+fluctuate(animal.baseVitals.temp, 0.2).toFixed(1));
    liveReadings.hr.push(Math.round(fluctuate(animal.baseVitals.hr, 3)));
    liveReadings.activity.push(Math.min(100, Math.max(0, Math.round(fluctuate(animal.baseVitals.activity, 6)))));

    // Keep max readings
    if (liveReadings.labels.length > MAX_READINGS) {
      liveReadings.labels.shift();
      liveReadings.temp.shift();
      liveReadings.hr.shift();
      liveReadings.activity.shift();
    }

    updateCharts();
    updateGauges();
  }

  // ── AI Summary ────────────────────────────────────────────
  function updateAISummary() {
    const animal = APP_DATA.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    document.getElementById('ai-summary-text').textContent = animal.aiSummary;

    const pct = animal.confidence;
    document.getElementById('confidence-pct').textContent = pct + '%';
    const fill = document.getElementById('confidence-fill');
    fill.style.width = '0%';
    setTimeout(() => { fill.style.width = pct + '%'; }, 50);
  }

  // ── Utilities ─────────────────────────────────────────────
  function fluctuate(base, range) {
    return base + (Math.random() - 0.5) * 2 * range;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  // ── Module Activation (called when tab opens) ─────────────
  function onActivate() {
    if (!liveInterval) {
      startLiveInterval();
    }
    updateGauges();
    updateAISummary();
  }

  // ── Refresh selector (called after new animal added) ──────
  function refreshSelector() {
    const select = document.getElementById('vitals-animal-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = APP_DATA.animals.map(a => `
      <option value="${a.id}">${a.emoji} ${a.species} #${a.id} (${a.breed}) — ${a.status}</option>
    `).join('');
    // Preserve current selection if still valid
    if (APP_DATA.animals.some(a => a.id === currentVal)) {
      select.value = currentVal;
    }
  }

  function startLiveInterval() {
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(pushReading, 60000);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    populateSelector();
    initLiveData();
    createCharts();
    updateGauges();
    updateAISummary();
    startLiveInterval();
  }

  return { init, onActivate, refreshSelector };
})();
