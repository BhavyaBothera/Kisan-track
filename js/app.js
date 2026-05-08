(function () {
  'use strict';

  // ── Selectors ─────────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileItems = document.querySelectorAll('.mobile-nav-item');
  const sections = document.querySelectorAll('.tab-section');

  // ── Tab Switching Logic (SPA) ─────────────────────────────
  function switchTab(tabId) {
    if (!tabId) return;

    // 1. Update Sections
    let found = false;
    sections.forEach(sec => {
      if (sec.id === `section-${tabId}`) {
        sec.classList.add('active');
        found = true;
      } else {
        sec.classList.remove('active');
      }
    });

    if (!found) return; // Tab might not exist in this page

    // 2. Update Nav Links
    navLinks.forEach(link => {
      if (link.dataset.tab === tabId) link.classList.add('active');
      else link.classList.remove('active');
    });

    // 3. Update Mobile Nav
    mobileItems.forEach(item => {
      if (item.dataset.tab === tabId) item.classList.add('active');
      else item.classList.remove('active');
    });

    // 4. Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 5. Update URL Hash (Optional, for bookmarking)
    history.replaceState(null, null, `#${tabId}`);
    
    // Close sidebar on mobile
    if (window.innerWidth < 1024) closeSidebar();
  }

  // ── Sidebar Toggle ────────────────────────────────────────
  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    overlay.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  if (overlay) overlay.addEventListener('click', closeSidebar);

  // ── Event Listeners ───────────────────────────────────────
  navLinks.forEach(link => {
    link.addEventListener('click', () => switchTab(link.dataset.tab));
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
    document.querySelectorAll('.btn, .btn-primary, .btn-secondary, .nav-link, .mobile-nav-item').forEach(btn => {
      btn.removeEventListener('click', addRipple);
      btn.addEventListener('click', addRipple);
    });
  }

  // ── Top Bar Handlers ─────────────────────────────────────
  const topbarProfileBtn = document.getElementById('topbar-profile-dropdown-btn');
  const profileMenu = document.getElementById('profile-dropdown-menu');
  const globalSearch = document.getElementById('global-search');

  if (topbarProfileBtn && profileMenu) {
    topbarProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => profileMenu.classList.remove('show'));
  }

  // ── Modal Helper ──────────────────────────────────────────
  window.openAnimalModal = function (animalId) {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : { animals: [] };
    const animal = state.animals.find(a => a.id === animalId || a.animalId === animalId);
    if (!animal) return;

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

    // Info Grid
    if (document.getElementById('modal-breed')) document.getElementById('modal-breed').textContent = animal.breed || '—';
    if (document.getElementById('modal-age')) document.getElementById('modal-age').textContent = animal.age || '—';
    if (document.getElementById('modal-weight')) document.getElementById('modal-weight').textContent = animal.weight || '—';

    // Render 7-day chart
    const history = animal.history7d || generateMockHistory(animal);
    renderModalChart(history);

    document.getElementById('animal-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function generateMockHistory(animal) {
    const labels = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'Now'];
    const baseT = 38.5;
    const baseH = 68;
    return {
      labels,
      temp: labels.map(() => baseT + (Math.random() - 0.5) * 0.4),
      hr: labels.map(() => Math.round(baseH + (Math.random() - 0.5) * 5)),
      activity: labels.map(() => Math.round(50 + Math.random() * 20))
    };
  }

  window.closeAnimalModal = function () {
    const modal = document.getElementById('animal-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    if (window._modalChart) {
      window._modalChart.destroy();
      window._modalChart = null;
    }
  };

  function renderModalChart(history) {
    const canvas = document.getElementById('modal-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
          x: { ticks: { color: '#706860', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#706860', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }

  if (document.getElementById('modal-close')) document.getElementById('modal-close').addEventListener('click', window.closeAnimalModal);

  // ── Sync Last Updated Time ────────────────────────────────
  function startSyncTimer() {
    const el = document.getElementById('last-sync-time');
    if (!el) return;
    let seconds = 0;
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
    // 1. Initial tab from hash or default
    const hash = window.location.hash.replace('#', '');
    switchTab(hash || 'dashboard');

    // 2. Initialize all modules
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

    // Re-attach ripples when DOM changes
    const observer = new MutationObserver(attachRipples);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Auth Listener to trigger Store Init
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      if (window.FirestoreStore) {
        window.FirestoreStore.init(user.uid);
      }
    } else {
      if (window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'login.html';
      }
    }
  });

  // Run init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
