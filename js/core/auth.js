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

  /**
   * Automatically initializes the correct module for the current page
   */
  function initPageModules() {
    const path = window.location.pathname;
    
    if (path.includes('dashboard.html')) {
      if (window.DashboardModule) window.DashboardModule.init();
    } 
    else if (path.includes('herd.html')) {
      if (window.HerdModule) window.HerdModule.init();
      if (window.VitalsModule) window.VitalsModule.init();
    }
    else if (path.includes('alerts.html')) {
      if (window.AlertsModule) window.AlertsModule.init();
      if (window.ReportsModule) window.ReportsModule.init();
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
  }

  // --- 2. Shared Listeners ---
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
    };

    // Also map mobile nav
    const mobileNavMap = {
      'dashboard.html': 'mnav-dashboard',
      'herd.html':      'mnav-animals',
      'alerts.html':    'mnav-alerts',
      'camera.html':    'mnav-camera',
      'profile.html':   'mnav-profile',
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
