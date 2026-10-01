// ============================================
// KisanTrack — utils.js
// Purpose: Shared utility functions for KisanTrack
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================

(function () {
  'use strict';

  // Use this before interpolating data from Firestore, user input, or an API into HTML.
  // Prefer textContent when constructing new UI.
  window.escapeHtml = function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  };

  // --- Toast Queue System ---
  let toastQueue = [];
  let toastShowing = false;

  /**
   * Show a toast notification with queuing support.
   * @param {string} msg - Message to display.
   * @param {string} [type='success'] - Toast type ('success', 'error', 'warning').
   */
  function showToast(msg, type = 'success') {
    toastQueue.push({ msg, type });
    if (!toastShowing) {
      processToastQueue();
    }
  }

  function processToastQueue() {
    if (toastQueue.length === 0) {
      toastShowing = false;
      return;
    }

    toastShowing = true;
    const { msg, type } = toastQueue.shift();
    displayToast(msg, type);

    // Wait for the toast to finish (3.5s show + 0.4s hide) before showing next
    setTimeout(processToastQueue, 4000);
  }

  function displayToast(msg, type) {
    const toast = document.getElementById('app-toast');
    const msgEl = document.getElementById('toast-msg');
    if (!toast || !msgEl) return;
    
    msgEl.textContent = msg;
    const icon = toast.querySelector('.toast-icon');
    
    // Reset classes and styles
    toast.className = 'toast'; 
    if (icon) {
      icon.className = 'fa-solid toast-icon';
      icon.style.color = '';
    }
    toast.style.borderColor = '';

    // Apply types
    if (type === 'error') {
      if (icon) {
        icon.classList.add('fa-circle-xmark');
        icon.style.color = 'var(--accent-red)';
      }
      toast.style.borderColor = 'var(--accent-red)';
    } else if (type === 'warning') {
      if (icon) {
        icon.classList.add('fa-triangle-exclamation');
        icon.style.color = 'var(--accent-amber)';
      }
      toast.style.borderColor = 'var(--accent-amber)';
    } else {
      if (icon) icon.classList.add('fa-circle-check');
    }

    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        toast.classList.remove('hide');
      }, 400);
    }, 3500);
  }

  /**
   * Parse Gemini AI response more robustly.
   * @param {string} responseText - Raw text from Gemini.
   */
  function parseGeminiResponse(responseText) {
    if (!responseText) return null;
    try {
      // 1. Strip potential Markdown code blocks
      let clean = responseText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // 2. Extract the first JSON object pattern found
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) return null;
      
      return JSON.parse(match[0]);
    } catch (err) {
      console.error('Utils: Failed to parse Gemini JSON:', err);
      return null;
    }
  }

  /**
   * Compress image for Gemini API (prevents 413 error).
   * @param {string} base64 - Source image base64.
   * @param {number} maxWidth - Max width for compression.
   */
  function compressImage(base64, maxWidth = 800) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.onerror = () => resolve(null);
      img.src = base64;
    });
  }

  /** Validate email with a simple regex. */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Toggle button loading state safely. */
  function setLoadingState(btnId, isLoading, originalText = '') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.innerHTML;
      }
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || originalText;
    }
  }

  /** Format a Firestore Timestamp or JS Date to a friendly string. */
  function formatTimestamp(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  // Best-effort operational telemetry. Never log secrets, document contents, or raw URLs.
  window.recordClientTelemetry = function recordClientTelemetry(eventType, message, severity = 'error') {
    try {
      const user = window.auth?.currentUser;
      if (!user || !window.db) return;
      const safeType = String(eventType || 'client_error').slice(0, 80);
      const safeMessage = String(message || 'Unknown client error').replace(/\s+/g, ' ').slice(0, 500);
      const safeSeverity = ['error', 'warning', 'info'].includes(severity) ? severity : 'error';
      return window.db.collection('clientTelemetry').add({
        farmerId: user.uid,
        eventType: safeType,
        severity: safeSeverity,
        message: safeMessage,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } catch (_) {}
  };


  // --- Phase 8: offline, notifications and audit infrastructure ---
  function installOfflineHandling() {
    const sync = () => {
      let banner = document.getElementById('kisan-offline-banner');
      if (!navigator.onLine) {
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'kisan-offline-banner';
          banner.setAttribute('role', 'status');
          banner.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;padding:10px 16px;border-radius:999px;background:#3b1f1f;color:#ffd7d7;border:1px solid #a94442;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:.82rem;font-weight:600;';
          banner.textContent = 'Offline mode: changes will resume when your connection returns.';
          document.body.appendChild(banner);
        }
      } else if (banner) {
        banner.remove();
        if (window.showToast && sessionStorage.getItem('kisan:offlineSeen') === '1') {
          window.showToast('Connection restored. KisanTrack is online.', 'success');
        }
        sessionStorage.removeItem('kisan:offlineSeen');
      }
      if (!navigator.onLine) sessionStorage.setItem('kisan:offlineSeen', '1');
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }

  async function saveUserPreference(key, value) {
    const user = window.auth?.currentUser;
    if (!user || !window.db) throw new Error('Authentication required.');
    await window.db.collection('userPreferences').doc(user.uid).set({
      farmerId: user.uid,
      [key]: value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function recordAudit(action, metadata = {}) {
    const user = window.auth?.currentUser;
    if (!user || !window.db) return;
    const safeMetadata = {};
    Object.keys(metadata).slice(0, 10).forEach(key => {
      safeMetadata[String(key).slice(0, 40)] = String(metadata[key] ?? '').slice(0, 200);
    });
    return window.db.collection('auditLogs').add({
      farmerId: user.uid,
      action: String(action || 'unknown').slice(0, 80),
      metadata: safeMetadata,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }

  function setupNotificationInfrastructure() {
    document.addEventListener('kisanTrack:stateUpdated', async (event) => {
      const state = event.detail?.state;
      const user = window.auth?.currentUser;
      if (!user || !state || !('Notification' in window)) return;
      try {
        const pref = await window.db.collection('userPreferences').doc(user.uid).get();
        if (pref.exists && pref.data().browserNotifications !== true) return;
        const critical = (state.alerts || []).find(a => !a.resolved && a.severity === 'Critical');
        if (critical && Notification.permission === 'granted') {
          const key = 'kisan:lastNotifiedAlert';
          if (localStorage.getItem(key) !== critical.id) {
            new Notification('KisanTrack: Critical livestock alert', {
              body: 'A critical alert needs your attention for ' + String(critical.animalId || 'an animal') + '.'
            });
            localStorage.setItem(key, critical.id);
          }
        }
      } catch (_) {}
    });
  }

  window.saveUserPreference = saveUserPreference;
  window.recordAudit = recordAudit;
  window.installOfflineHandling = installOfflineHandling;
  window.setupNotificationInfrastructure = setupNotificationInfrastructure;

  // Export to global scope
  window.showToast = showToast;
  window.validateEmail = validateEmail;
  window.setLoadingState = setLoadingState;
  window.parseGeminiResponse = parseGeminiResponse;
  window.compressImage = compressImage;
  window.formatTimestamp = formatTimestamp;
})();
