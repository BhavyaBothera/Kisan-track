// ============================================
// KisanTrack — auth.js (Pages)
// Purpose: Login / Signup logic for auth page
// Page: login.html
// Dependencies: Firebase Auth, Utils
// Last Updated: 2026-05-09
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --- UI Elements ---
  const container = document.getElementById('auth-container');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  
  const signupName = document.getElementById('signup-name');
  const signupEmail = document.getElementById('signup-email');
  const signupPass = document.getElementById('signup-password');
  const signupError = document.getElementById('signup-error');

  const btnGoogle = document.getElementById('btn-google-login');

  // --- 1. Dual-Shift Logic ---
  window.toggleShift = (state) => {
    if (!container) return;
    
    if(state === 'signup') {
      container.classList.add('signup-active');
      container.classList.remove('login-active');
      const toSignup = document.getElementById('shifter-to-signup');
      const toLogin = document.getElementById('shifter-to-login');
      if (toSignup) toSignup.style.display = 'none';
      if (toLogin) toLogin.style.display = 'block';
    } else {
      container.classList.add('login-active');
      container.classList.remove('signup-active');
      const toSignup = document.getElementById('shifter-to-signup');
      const toLogin = document.getElementById('shifter-to-login');
      if (toSignup) toSignup.style.display = 'block';
      if (toLogin) toLogin.style.display = 'none';
    }
    clearErrors();
  };

  // Aurora Mouse Follow
  const aurora = document.getElementById('aurora');
  if (aurora) {
    document.addEventListener('mousemove', (e) => {
      aurora.style.left = e.clientX + 'px';
      aurora.style.top = e.clientY + 'px';
    });
  }

  // Handle URL parameters for initial tab
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'signup') window.toggleShift('signup');

  // --- 2. Helpers ---
  function getFriendlyErrorMessage(error) {
    if (!error) return 'An unknown error occurred.';
    switch (error.code) {
      case 'auth/email-already-in-use': return 'Email is already registered.';
      case 'auth/user-not-found': return 'Account not found.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/invalid-credential': return 'Invalid login credentials.';
      case 'auth/weak-password': return 'Password should be at least 6 characters.';
      case 'auth/popup-closed-by-user': return ''; 
      case 'auth/network-request-failed': return 'Network error. Please check your connection.';
      default: return error.message;
    }
  }

  function clearErrors() {
    if (loginError) loginError.textContent = '';
    if (signupError) signupError.textContent = '';
  }

  function showError(form, msg) {
    if (form === 'login' && loginError) loginError.textContent = msg;
    if (form === 'signup' && signupError) signupError.textContent = msg;
    if (msg && window.showToast) window.showToast(msg, 'error');
  }

  // --- 3. Authentication Actions ---

  // Email Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = loginEmail.value.trim();
      const pass = loginPass.value;

      if (!email || !pass) {
        showError('login', 'Please fill in all fields.');
        return;
      }

      window.setLoadingState('btn-login-submit', true);
      try {
        await auth.signInWithEmailAndPassword(email, pass);
        // auth.js (core) handles redirection
      } catch (error) {
        showError('login', getFriendlyErrorMessage(error));
      } finally {
        window.setLoadingState('btn-login-submit', false, 'Authenticate');
      }
    });
  }

  // Email Signup
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const name = signupName.value.trim();
      const email = signupEmail.value.trim();
      const pass = signupPass.value;

      if (!name || !email || !pass) {
        showError('signup', 'Please fill in all fields.');
        return;
      }

      if (pass.length < 6) {
        showError('signup', 'Password must be at least 6 characters.');
        return;
      }

      window.setLoadingState('btn-signup-submit', true);
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        
        // Initialize Firestore profile (also handled in core auth.js as backup)
        await db.collection('farmers').doc(cred.user.uid).set({
          fullName: name,
          email: email,
          farmName: 'My Farm',
          registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });

      } catch (error) {
        showError('signup', getFriendlyErrorMessage(error));
      } finally {
        window.setLoadingState('btn-signup-submit', false, 'Initialize');
      }
    });
  }

  // Google Auth
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      clearErrors();
      try {
        await auth.signInWithPopup(googleProvider);
      } catch (error) {
        console.error('Auth Module: Google Error', error);
        const activeSide = container.classList.contains('signup-active') ? 'signup' : 'login';
        const msg = getFriendlyErrorMessage(error);
        if (msg) showError(activeSide, msg);
      }
    });
  }

});
