/**
 * ============================================================
 * KisanTrack — Authentication Module
 * Handles Firebase Auth integration, Dual-Shift UI, and Google Auth.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- UI Elements ---
  const container = document.getElementById('auth-container');
  const toSignup = document.getElementById('shifter-to-signup');
  const toLogin = document.getElementById('shifter-to-login');

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  
  const signupName = document.getElementById('signup-name');
  const signupEmail = document.getElementById('signup-email');
  const signupPass = document.getElementById('signup-password');
  const signupError = document.getElementById('signup-error');
  const btnSignupSubmit = document.getElementById('btn-signup-submit');

  const btnGoogle = document.getElementById('btn-google-login');

  console.log('Auth Module: Initialized');
  console.log('Auth Module: Google Button found?', !!btnGoogle);

  // --- 1. Dual-Shift Logic ---
  window.toggleShift = (state) => {
    console.log('Auth Module: Shifting to', state);
    if(state === 'signup') {
      container.classList.add('signup-active');
      container.classList.remove('login-active');
      if (toSignup) toSignup.style.display = 'none';
      if (toLogin) toLogin.style.display = 'block';
    } else {
      container.classList.add('login-active');
      container.classList.remove('signup-active');
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

  // --- 2. Auth State Listener ---
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
      }
    }
  });

  // Handle URL parameters
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'signup') window.toggleShift('signup');

  // --- 3. Firebase Helpers ---
  function getFriendlyErrorMessage(error) {
    switch (error.code) {
      case 'auth/email-already-in-use': return 'Email already registered.';
      case 'auth/user-not-found': return 'Account not found.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/invalid-credential': return 'Invalid credentials.';
      case 'auth/popup-closed-by-user': return ''; // User closed popup
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
  }

  function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.dataset.old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.old || (btnId === 'btn-login-submit' ? 'Authenticate' : 'Initialize');
    }
  }

  // --- 4. Authentication Actions ---

  // Email Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      setLoading('btn-login-submit', true);
      try {
        await auth.signInWithEmailAndPassword(loginEmail.value, loginPass.value);
      } catch (error) {
        showError('login', getFriendlyErrorMessage(error));
      } finally {
        setLoading('btn-login-submit', false);
      }
    });
  }

  // Email Signup
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      setLoading('btn-signup-submit', true);
      try {
        const cred = await auth.createUserWithEmailAndPassword(signupEmail.value, signupPass.value);
        await cred.user.updateProfile({ displayName: signupName.value });
      } catch (error) {
        showError('signup', getFriendlyErrorMessage(error));
      } finally {
        setLoading('btn-signup-submit', false);
      }
    });
  }

  // Google Auth
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      console.log('Auth Module: Google Popup Opening...');
      try {
        await auth.signInWithPopup(googleProvider);
        console.log('Auth Module: Google Success');
      } catch (error) {
        console.error('Auth Module: Google Error', error);
        const activeSide = container.classList.contains('signup-active') ? 'signup' : 'login';
        const msg = getFriendlyErrorMessage(error);
        if (msg) showError(activeSide, msg);
      }
    });
  }

});
