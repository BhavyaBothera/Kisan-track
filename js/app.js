/**
 * ============================================================
 * KisanTrack — Main Application Controller & Orchestrator (app.js)
 * 
 * ROLE:
 * - Bootstraps all feature modules (Dashboard, Animals, Vitals, etc.)
 * - Handles top-level navigation and Tab Switching
 * - Manages global UI components like the Sidebar and Animal Detail Modal
 * - Provides centralized utility listeners (Ripple effects, Mutation Observers)
 * ============================================================
 */

(function () {
  'use strict';

  // ── Multi-page Navigation Mapping ─────────────────────────
  const tabToUrl = {
    'dashboard': 'dashboard.html',
    'animals': 'herd.html',
    'vitals': 'herd.html#section-vitals',
    'alerts': 'alerts.html',
    'reports': 'alerts.html#section-reports',
    'camera': 'camera.html',
    'upload': 'uploads.html',
    'profile': 'profile.html'
  };

  // ── Sidebar Toggle ────────────────────────────────────────
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
  }

  hamburger.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  // ── Nav Link Click Handlers ───────────────────────────────
  // navLinks are already <a> tags with hrefs, so they navigate natively.
  // We just close the sidebar on mobile if clicked.
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        closeSidebar();
      }
    });
  });

  mobileItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      if (tabToUrl[tab]) {
        window.location.href = tabToUrl[tab];
      }
    });
  });

  // ── Ripple Effect on Buttons ──────────────────────────────
  function addRipple(e) {
    const btn = e.currentTarget;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    const rect   = btn.getBoundingClientRect();
    const x      = e.clientX - rect.left;
    const y      = e.clientY - rect.top;

    ripple.style.left = x + 'px';
    ripple.style.top  = y + 'px';

    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function attachRipples() {
    document.querySelectorAll('.btn').forEach(btn => {
      // Avoid duplicate listeners
      btn.removeEventListener('click', addRipple);
      btn.addEventListener('click', addRipple);
    });
  }

  // ── Modal Helper ──────────────────────────────────────────
  window.openAnimalModal = function (animalId) {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : { animals: [] };
    const animal = state.animals.find(a => a.id === animalId || a.animalId === animalId);
    if (!animal) return;

    // Map fields - Use real-time vitals from store if available
    const rtVitals = state.vitals ? state.vitals[animal.id] : null;
    const temp = rtVitals ? rtVitals.temp : (animal.vitals ? animal.vitals.lastTemp : '—');
    const hr   = rtVitals ? rtVitals.hr   : (animal.vitals ? animal.vitals.lastHeartRate : '—');
    const act  = rtVitals ? rtVitals.activity : (animal.vitals ? animal.vitals.lastActivity : '—');

    const emojiEl = document.getElementById('modal-emoji');
    if (emojiEl) emojiEl.textContent = animal.emoji || '🐄';
    
    document.getElementById('modal-title').textContent = `${animal.species || 'Animal'} #${animal.animalId || '000'}`;
    
    const sub = document.getElementById('modal-subtitle');
    if (sub) sub.textContent = `${animal.breed || 'Standard'} · ${animal.age || '?'} years · Tag: ${animal.tagId || 'N/A'}`;

    const tEl = document.getElementById('modal-temp');
    if (tEl) tEl.innerHTML = `<i class="fa-solid fa-thermometer-half"></i> ${temp}°C`;
    
    const hEl = document.getElementById('modal-hr');
    if (hEl) hEl.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> ${hr} bpm`;
    
    const aEl = document.getElementById('modal-act');
    if (aEl) aEl.innerHTML = `<i class="fa-solid fa-running"></i> ${act}`;

    // Render 7-day chart (Mocking history if not in Firestore yet)
    const history = animal.history7d || generateMockHistory(animal);
    renderModalChart(history);

    document.getElementById('animal-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function generateMockHistory(animal) {
    const labels = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'Now'];
    const baseT = animal.vitals?.lastTemp || 38.5;
    const baseH = animal.vitals?.lastHeartRate || 68;
    return {
      labels,
      temp: labels.map(() => baseT + (Math.random() - 0.5) * 0.4),
      hr: labels.map(() => Math.round(baseH + (Math.random() - 0.5) * 5)),
      activity: labels.map(() => Math.round(50 + Math.random() * 20))
    };
  }

  window.closeAnimalModal = function () {
    document.getElementById('animal-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window._modalChart) {
      window._modalChart.destroy();
      window._modalChart = null;
    }
  };

  function renderModalChart(history) {
    const ctx = document.getElementById('modal-chart').getContext('2d');
    if (window._modalChart) window._modalChart.destroy();

    window._modalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.labels,
        datasets: [
          {
            label: 'Temp (°C)',
            data: history.temp,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124,181,24,0.08)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Heart Rate (bpm)',
            data: history.hr,
            borderColor: '#E5A100',
            backgroundColor: 'rgba(229,161,0,0.06)',
            tension: 0.4,
            fill: true,
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#A89F8C', font: { size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#706860', font: { size: 10 } }, grid: { color: 'rgba(61,61,40,0.2)' } },
          y: { ticks: { color: '#706860', font: { size: 10 } }, grid: { color: 'rgba(61,61,40,0.2)' } },
        },
      },
    });
  }

  // Modal Close handlers
  document.getElementById('modal-close').addEventListener('click', window.closeAnimalModal);
  document.getElementById('animal-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('animal-modal')) window.closeAnimalModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeAnimalModal();
  });

  // ── Sync Last Updated Time ────────────────────────────────
  function startSyncTimer() {
    let seconds = 120; // 2 min
    const el = document.getElementById('last-sync-time');
    setInterval(() => {
      seconds++;
      if (seconds < 60) el.textContent = seconds + 's ago';
      else {
        const m = Math.floor(seconds / 60);
        el.textContent = m + ' min ago';
      }
    }, 1000);
  }

  // ── Global Init ───────────────────────────────────────────
  function init() {
    // Initialize all modules
    if (typeof DashboardModule  !== 'undefined' && document.getElementById('section-dashboard')) DashboardModule.init();
    if (typeof AnimalsModule    !== 'undefined' && document.getElementById('section-animals')) AnimalsModule.init();
    if (typeof VitalsModule     !== 'undefined' && document.getElementById('section-vitals')) VitalsModule.init();
    if (typeof AlertsModule     !== 'undefined' && document.getElementById('section-alerts')) AlertsModule.init();
    if (typeof ReportsModule    !== 'undefined' && document.getElementById('section-reports')) ReportsModule.init();
    if (typeof UploadModule     !== 'undefined' && document.getElementById('section-upload')) UploadModule.init();
    if (typeof AddAnimalModule  !== 'undefined' && document.getElementById('add-animal-modal')) AddAnimalModule.init();
    if (typeof ProfileModule    !== 'undefined' && document.getElementById('section-profile')) ProfileModule.init();
    if (typeof CameraModule     !== 'undefined' && document.getElementById('section-camera')) CameraModule.init();

    attachRipples();
    startSyncTimer();

    // Re-attach ripples when DOM changes (for dynamically rendered buttons)
    const observer = new MutationObserver(attachRipples);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run after DOM fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
