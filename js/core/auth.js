// ============================================
// KisanTrack — auth.js
// Purpose: Core Authentication & Redirection Logic
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-17
// ============================================

(function() {
  'use strict';

  // --- 1. Global Redirection & State ---
  auth.onAuthStateChanged(async (user) => {
    try {
      const path = window.location.pathname;
      const isLoginPage = path.includes('login.html') || path.endsWith('login.html');
      const isIndexPage = path.includes('index.html') || path.endsWith('index.html') || path.endsWith('/');

      if (user) {
        // a. Ensure Farmer Profile exists in Firestore
        try {
          const farmerRef = db.collection('farmers').doc(user.uid);
          const doc = await farmerRef.get();
          
          if (!doc.exists) {
            // New user — create profile using displayName if available, else email prefix
            const fallbackName = user.displayName || user.email.split('@')[0];
            await farmerRef.set({
              fullName: fallbackName,
              email: user.email,
              farmName: 'My Farm',
              registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            });
            // Update UI immediately with the name we just created
            updateUserUI(fallbackName);
          } else {
            await farmerRef.update({
              lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Update UI from the existing Firestore profile (most reliable source)
            const profileData = doc.data();
            const name = profileData.fullName || user.displayName || user.email.split('@')[0];
            updateUserUI(name);
          }
        } catch (profileErr) {
          console.error('Auth: Profile sync failed', profileErr);
          // Fallback: use whatever we can get from the auth object
          const fallbackName = user.displayName || user.email.split('@')[0] || 'Farmer';
          updateUserUI(fallbackName);
        }

        // b. Redirection
        if (isLoginPage || isIndexPage) {
          window.location.href = 'dashboard.html';
          return;
        }

        // c. Initialize Store (firestore-store.js MUST be loaded before auth.js)
        if (window.FirestoreStore) {
          window.FirestoreStore.init(user.uid);
        } else {
          console.error('Auth: FirestoreStore not found. Check script load order — firestore-store.js must come before auth.js');
        }

        // d. Initialize Page Modules
        initPageModules();

        // e. Listen for farmer data to arrive and re-update UI (real-time name sync)
        document.addEventListener('kisanTrack:farmerLoaded', (e) => {
          const name = e.detail && e.detail.fullName;
          if (name) updateUserUI(name);
        });

      } else {
        // Not logged in
        if (!isLoginPage && !isIndexPage) {
          window.location.href = 'login.html';
        }
      }
    } catch (err) {
      console.error('Auth: Initialization error', err);
    } finally {
      // Inject Global Loader if missing
      if (!document.getElementById('global-loader')) {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
          <div class="loader-spinner"></div>
          <div class="loader-text">Initializing KisanTrack...</div>
        `;
        document.body.prepend(loader);
      }

      // Reveal Page with Animation
      setTimeout(() => {
        const loader = document.getElementById('global-loader');
        const main = document.getElementById('main-content');
        
        if (loader) loader.classList.add('fade-out');
        if (main) main.classList.add('page-reveal');
        
        document.documentElement.style.visibility = 'visible';
      }, 400);
    }
  });

  // --- Centralised User UI Update ---
  // Called whenever we have a reliable name from Auth or Firestore
  function updateUserUI(fullName) {
    if (!fullName) return;
    const firstName = fullName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();

    const nameHi  = document.getElementById('auth-first-name-hi');
    const nameEn  = document.getElementById('auth-first-name');
    const avatar  = document.getElementById('auth-avatar');
    const greeting = document.getElementById('banner-greeting');

    if (nameHi) nameHi.textContent = firstName;
    if (nameEn) nameEn.textContent = firstName;
    if (avatar) avatar.textContent = initial;

    // Update dashboard greeting if present
    if (greeting) {
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
      greeting.innerHTML = `<i class="fa-solid fa-gauge-high" style="color:var(--accent-green);margin-right:10px;"></i>${timeGreeting}, ${firstName} 🌾`;
    }
  }

  // --- 2. Global Dropdown Logic ---
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown-menu');
    const btn = document.getElementById('topbar-profile-dropdown-btn');
    
    if (btn && btn.contains(e.target)) {
      e.preventDefault();
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !isExpanded);
      dropdown.classList.toggle('show');
    } else if (dropdown && dropdown.classList.contains('show')) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // --- 3. Page Module Initialization ---
  function initPageModules() {
    const path = window.location.pathname;
    
    if (path.includes('dashboard.html')) {
      if (window.DashboardModule) window.DashboardModule.init();
    } 
    else if (path.includes('herd.html')) {
      if (window.HerdModule) window.HerdModule.init();
    }
    else if (path.includes('vitals.html')) {
      if (window.VitalsModule) window.VitalsModule.init();
    }
    else if (path.includes('alerts.html')) {
      if (window.AlertsModule) window.AlertsModule.init();
      if (window.ReportsModule) window.ReportsModule.init();
    }
    else if (path.includes('analytics.html')) {
      if (window.AnalyticsModule) window.AnalyticsModule.init();
    }
    else if (path.includes('camera.html')) {
      if (window.CameraModule) window.CameraModule.init();
    }
    else if (path.includes('uploads.html')) {
      if (window.UploadsModule) window.UploadsModule.init();
    }
    else if (path.includes('profile.html')) {
      if (window.ProfileModule) window.ProfileModule.init();
    }
    else if (path.includes('inventory.html')) {
      if (window.InventoryModule) window.InventoryModule.init();
    }
    else if (path.includes('veterinary.html')) {
      if (window.VeterinaryModule) window.VeterinaryModule.init();
    }
  }

  // --- 4. Shared Listeners ---
  document.addEventListener('DOMContentLoaded', () => {
    // Sign out functionality
    const btnSignOut = document.getElementById('btn-sign-out');
    const btnSidebarSignOut = document.getElementById('btn-sidebar-signout');

    const handleSignOut = (e) => {
      if (e) e.preventDefault();
      
      if (window.FirestoreStore) {
        window.FirestoreStore.unsubscribeAll();
      }

      localStorage.removeItem('selectedAnimalId');
      
      auth.signOut().then(() => {
        window.location.href = 'index.html';
      }).catch((err) => {
        console.error('Auth: Sign out failed', err);
        if (window.showToast) window.showToast('Sign out failed.', 'error');
      });
    };

    if (btnSignOut) btnSignOut.addEventListener('click', handleSignOut);
    if (btnSidebarSignOut) btnSidebarSignOut.addEventListener('click', handleSignOut);

    // Hamburger Menu Logic
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger && sidebar && overlay) {
      hamburger.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        overlay.classList.toggle('active', isOpen);
        hamburger.setAttribute('aria-expanded', isOpen);
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    }

    // Sidebar Active State Sync
    syncActiveNav();
  });

  function syncActiveNav() {
    const path = window.location.pathname;
    const navMap = {
      'dashboard.html': 'nav-dashboard',
      'herd.html':      'nav-animals',
      'alerts.html':    'nav-alerts',
      'camera.html':    'nav-camera',
      'uploads.html':   'nav-upload',
      'profile.html':   'nav-profile',
      'inventory.html': 'nav-inventory',
      'veterinary.html': 'nav-veterinary',
      'analytics.html': 'nav-reports',
      'vitals.html':    'nav-vitals',
    };

    // Standardised mobile nav map (same 5 items on all pages)
    const mobileNavMap = {
      'dashboard.html': 'mnav-dashboard',
      'analytics.html': 'mnav-analytics',
      'alerts.html':    'mnav-alerts',
      'camera.html':    'mnav-camera',
      'profile.html':   'mnav-profile',
    };

    Object.keys(navMap).forEach(file => {
      if (path.includes(file)) {
        const dEl = document.getElementById(navMap[file]);
        if (dEl) dEl.classList.add('active');
      }
    });

    Object.keys(mobileNavMap).forEach(file => {
      if (path.includes(file)) {
        const mEl = document.getElementById(mobileNavMap[file]);
        if (mEl) mEl.classList.add('active');
      }
    });
  }

})();
