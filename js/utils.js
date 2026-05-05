// utils.js – Shared utility functions for KisanTrack
// All functions are attached to the global `window` object for easy access across modules.

(function () {
  'use strict';

  /**
   * Show a toast notification.
   * @param {string} msg - Message to display.
   * @param {string} [type='success'] - Toast type (e.g., 'success' or 'error').
   */
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('app-toast');
    const msgEl = document.getElementById('toast-msg');
    if (!toast || !msgEl) return;
    
    msgEl.textContent = msg;
    const icon = toast.querySelector('.toast-icon');
    
    // Reset styles
    toast.style.borderColor = '';
    if (icon) {
      icon.style.color = '';
      icon.className = 'fa-solid toast-icon';
      
      if (type === 'error') {
        icon.classList.add('fa-circle-xmark');
        icon.style.color = 'var(--accent-red)';
        toast.style.borderColor = 'var(--accent-red)';
      } else if (type === 'warning') {
        icon.classList.add('fa-triangle-exclamation');
        icon.style.color = 'var(--accent-amber)';
        toast.style.borderColor = 'var(--accent-amber)';
      } else {
        icon.classList.add('fa-circle-check');
      }
    }

    if (window.toastTimer) clearTimeout(window.toastTimer);
    toast.classList.remove('hide');
    toast.classList.add('show');
    window.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        toast.classList.remove('hide');
        // Clean up styles after hide
        toast.style.borderColor = '';
        if (icon) icon.style.color = '';
      }, 400);
    }, 3500);
  }

  /**
   * Show an error message for login or signup forms.
   * @param {string} formType - 'login' or 'signup'.
   * @param {string} message - Error text.
   * @param {HTMLElement[]} [inputsToHighlight=[]] - Inputs that should receive error styling.
   */
  function showError(formType, message, inputsToHighlight = []) {
    const errorEl = document.getElementById(`${formType}-error`);
    if (errorEl) errorEl.textContent = message;
    inputsToHighlight.forEach(input => input.classList.add('error-border'));
  }

  /** Clear error messages from both forms. */
  function clearErrors() {
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    if (loginError) loginError.textContent = '';
    if (signupError) signupError.textContent = '';
    document.querySelectorAll('.auth-field input').forEach(input => input.classList.remove('error-border'));
  }

  /** Validate email with a simple regex. */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Toggle button loading state. */
  function setLoadingState(btnId, isLoading, originalText = '') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || originalText;
    }
  }

  // Export to global scope
  window.showToast = showToast;
  window.showError = showError;
  window.clearErrors = clearErrors;
  window.validateEmail = validateEmail;
  window.setLoadingState = setLoadingState;
})();
