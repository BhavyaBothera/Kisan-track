// ============================================
// KisanTrack — utils.js
// Purpose: Shared utility functions for KisanTrack
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================

(function () {
  'use strict';

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

  // Export to global scope
  window.showToast = showToast;
  window.validateEmail = validateEmail;
  window.setLoadingState = setLoadingState;
  window.parseGeminiResponse = parseGeminiResponse;
  window.compressImage = compressImage;
  window.formatTimestamp = formatTimestamp;
})();
