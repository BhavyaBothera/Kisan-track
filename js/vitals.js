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
  let liveChart         = null;
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
      liveReadings.labels.push(formatTime(new Date(Date.now() - i * 3000)));
      liveReadings.temp.push(+fluctuate(animal.baseVitals.temp, 0.15).toFixed(1));
      liveReadings.hr.push(Math.round(fluctuate(animal.baseVitals.hr, 2)));
      liveReadings.activity.push(Math.round(fluctuate(animal.baseVitals.activity, 5)));
    }

    if (liveChart) updateLiveChart();
  }

  // ── Create Live Chart ─────────────────────────────────────
  function createLiveChart() {
    const ctx = document.getElementById('live-chart').getContext('2d');
    if (liveChart) liveChart.destroy();

    liveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: liveReadings.labels,
        datasets: [
          {
            label: 'Temp (°C)',
            data: liveReadings.temp,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124,181,24,0.08)',
            tension: 0.45,
            pointRadius: 3,
            pointBackgroundColor: '#7CB518',
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Heart Rate (bpm)',
            data: liveReadings.hr,
            borderColor: '#E5A100',
            backgroundColor: 'rgba(229,161,0,0.07)',
            tension: 0.45,
            pointRadius: 3,
            pointBackgroundColor: '#E5A100',
            fill: true,
            yAxisID: 'y1',
          },
          {
            label: 'Activity (%)',
            data: liveReadings.activity,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.06)',
            tension: 0.45,
            pointRadius: 3,
            pointBackgroundColor: '#3B82F6',
            fill: true,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        interaction: { intersect: false, mode: 'index' },
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
            ticks: { color: '#706860', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
            grid: { color: 'rgba(61,61,40,0.35)' },
          },
          y: {
            position: 'left',
            title: { display: true, text: '°C', color: '#7CB518', font: { size: 11 } },
            ticks: { color: '#7CB518', font: { size: 10 } },
            grid: { color: 'rgba(61,61,40,0.35)' },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'bpm', color: '#E5A100', font: { size: 11 } },
            ticks: { color: '#E5A100', font: { size: 10 } },
            grid: { display: false },
          },
          y2: {
            display: false,
          },
        },
      },
    });
  }

  // ── Update Live Chart data ────────────────────────────────
  function updateLiveChart() {
    if (!liveChart) return;
    liveChart.data.labels = [...liveReadings.labels];
    liveChart.data.datasets[0].data = [...liveReadings.temp];
    liveChart.data.datasets[1].data = [...liveReadings.hr];
    liveChart.data.datasets[2].data = [...liveReadings.activity];
    liveChart.update('none'); // no animation for live updates
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

    updateLiveChart();
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
    liveInterval = setInterval(pushReading, 3000);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    populateSelector();
    initLiveData();
    createLiveChart();
    updateGauges();
    updateAISummary();
    startLiveInterval();
  }

  return { init, onActivate, refreshSelector };
})();
