/**
 * ============================================================
 * KisanTrack — App Controller (app.js)
 * Navigation, sidebar toggle, ripple effects, initialization
 * ============================================================
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let currentTab = 'dashboard';

  // ── DOM refs ──────────────────────────────────────────────
  const sidebar        = document.getElementById('sidebar');
  const overlay        = document.getElementById('sidebar-overlay');
  const hamburger      = document.getElementById('hamburger');
  const navLinks       = document.querySelectorAll('.nav-link');
  const mobileItems    = document.querySelectorAll('.mobile-nav-item');
  const sections       = document.querySelectorAll('.tab-section');

  // ── Tab Switching ─────────────────────────────────────────
  function switchTab(tabName) {
    if (tabName === currentTab) return;
    currentTab = tabName;

    // Hide all sections
    sections.forEach(s => s.classList.remove('active'));

    // Show target section
    const target = document.getElementById('section-' + tabName);
    if (target) {
      target.classList.add('active');
    }

    // Update sidebar nav active state
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tabName);
    });

    // Update mobile nav active state
    mobileItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Close sidebar on mobile after nav
    if (window.innerWidth < 768) {
      closeSidebar();
    }

    // Trigger tab-specific init
    onTabActivated(tabName);
  }

  function onTabActivated(tabName) {
    switch (tabName) {
      case 'vitals':
        if (typeof VitalsModule !== 'undefined') VitalsModule.onActivate();
        break;
      case 'reports':
        if (typeof ReportsModule !== 'undefined') ReportsModule.onActivate();
        break;
      case 'alerts':
        if (typeof AlertsModule !== 'undefined') AlertsModule.render();
        break;
    }
  }

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
  navLinks.forEach(link => {
    link.addEventListener('click', () => switchTab(link.dataset.tab));
    // Keyboard accessibility
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchTab(link.dataset.tab);
      }
    });
  });

  mobileItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
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
  // Exposed globally so other modules can use it
  window.openAnimalModal = function (animalId) {
    const animal = APP_DATA.animals.find(a => a.id === animalId);
    if (!animal) return;

    document.getElementById('modal-emoji').textContent    = animal.emoji;
    document.getElementById('modal-title').textContent    = `${animal.species} #${animal.id}`;
    document.getElementById('modal-subtitle').textContent = `${animal.breed} · ${animal.age} years · Tag: ${animal.tagId}`;
    document.getElementById('modal-temp').textContent     = animal.vitals.temp + '°C';
    document.getElementById('modal-hr').textContent       = animal.vitals.hr + ' bpm';
    document.getElementById('modal-act').textContent      = animal.vitals.activity;
    document.getElementById('modal-breed').textContent    = animal.breed;
    document.getElementById('modal-age').textContent      = animal.age + ' yrs';
    document.getElementById('modal-weight').textContent   = animal.weight + ' kg';

    // Render 7-day chart
    renderModalChart(animal);

    document.getElementById('animal-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeAnimalModal = function () {
    document.getElementById('animal-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (window._modalChart) {
      window._modalChart.destroy();
      window._modalChart = null;
    }
  };

  function renderModalChart(animal) {
    const ctx = document.getElementById('modal-chart').getContext('2d');
    if (window._modalChart) window._modalChart.destroy();

    window._modalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: animal.history7d.labels,
        datasets: [
          {
            label: 'Temp (°C)',
            data: animal.history7d.temp,
            borderColor: '#7CB518',
            backgroundColor: 'rgba(124,181,24,0.08)',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#7CB518',
            fill: true,
          },
          {
            label: 'Heart Rate (bpm)',
            data: animal.history7d.hr,
            borderColor: '#E5A100',
            backgroundColor: 'rgba(229,161,0,0.06)',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#E5A100',
            fill: true,
          },
          {
            label: 'Activity (%)',
            data: animal.history7d.activity,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.06)',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#3B82F6',
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
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
            ticks: { color: '#706860', font: { size: 11 } },
            grid: { color: 'rgba(61,61,40,0.4)' },
          },
          y: {
            ticks: { color: '#706860', font: { size: 11 } },
            grid: { color: 'rgba(61,61,40,0.4)' },
          },
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
    if (typeof DashboardModule  !== 'undefined') DashboardModule.init();
    if (typeof AnimalsModule    !== 'undefined') AnimalsModule.init();
    if (typeof VitalsModule     !== 'undefined') VitalsModule.init();
    if (typeof AlertsModule     !== 'undefined') AlertsModule.init();
    if (typeof ReportsModule    !== 'undefined') ReportsModule.init();
    if (typeof UploadModule     !== 'undefined') UploadModule.init();
    if (typeof AddAnimalModule  !== 'undefined') AddAnimalModule.init();
    if (typeof ProfileModule    !== 'undefined') ProfileModule.init();
    if (typeof CameraModule     !== 'undefined') CameraModule.init();

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
