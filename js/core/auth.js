// ============================================
// KisanTrack — auth.js
// Purpose: Core Authentication & Redirection Logic
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
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
        // a. Ensure Farmer Profile exists
        try {
          const farmerRef = db.collection('farmers').doc(user.uid);
          const doc = await farmerRef.get();
          
          if (!doc.exists) {
            await farmerRef.set({
              fullName: user.displayName || 'Farmer',
              email: user.email,
              farmName: 'My Farm',
              registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            await farmerRef.update({
              lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } catch (profileErr) {
          console.error('Auth: Profile sync failed', profileErr);
          // Proceed anyway to reveal the page
        }

        // b. Redirection
        if (isLoginPage || isIndexPage) {
          window.location.href = 'dashboard.html';
          return;
        }

        // c. Update Global UI
        const nameHi = document.getElementById('auth-first-name-hi');
        const nameEn = document.getElementById('auth-first-name');
        const avatar = document.getElementById('auth-avatar');
        
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Farmer';
        if (nameHi) nameHi.textContent = firstName;
        if (nameEn) nameEn.textContent = firstName;
        if (avatar) avatar.textContent = firstName.charAt(0).toUpperCase();

        // d. Initialize Store
        if (window.FirestoreStore) {
          window.FirestoreStore.init(user.uid);
        }

        // e. Initialize Page Modules
        initPageModules();

      } else {
        // Not logged in
        if (!isLoginPage && !isIndexPage) {
          window.location.href = 'login.html';
        }
      }
    } catch (err) {
      console.error('Auth: Initialization error', err);
    } finally {
      // ALWAYS reveal the page eventually, unless redirecting
      // We wait a tiny bit to allow modules to start rendering
      setTimeout(() => {
        document.documentElement.style.visibility = 'visible';
      }, 100);
    }
  });

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

      // Clear relevant localStorage
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
    };

    // Also map mobile nav
    const mobileNavMap = {
      'dashboard.html': 'mnav-dashboard',
      'herd.html':      'mnav-animals',
      'alerts.html':    'mnav-alerts',
      'camera.html':    'mnav-camera',
      'profile.html':   'mnav-profile',
      'inventory.html': 'mnav-inventory',
      'veterinary.html': 'mnav-veterinary',
    };

    Object.keys(navMap).forEach(file => {
      if (path.includes(file)) {
        const desktopId = navMap[file];
        const mobileId = mobileNavMap[file];
        
        const dEl = document.getElementById(desktopId);
        const mEl = document.getElementById(mobileId);
        
        if (dEl) dEl.classList.add('active');
        if (mEl) mEl.classList.add('active');
      }
    });
  }

})();
