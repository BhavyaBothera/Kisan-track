/**
 * ============================================================
 * KisanTrack — Authentication Module
 * Handles Firebase Auth integration, forms, and UI states.
 * ============================================================
 */

// 1. Firebase Auth Variables (Assuming initialized globally in firebase-init.js)

document.addEventListener('DOMContentLoaded', () => {

  // --- UI Elements ---
  const authScreen = document.getElementById('auth-screen');
  const appDashboard = document.getElementById('app-dashboard');

  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const authTabSlider = document.getElementById('auth-tab-slider');
  
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  
  const signupName = document.getElementById('signup-name');
  const signupFarm = document.getElementById('signup-farm');
  const signupEmail = document.getElementById('signup-email');
  const signupPass = document.getElementById('signup-password');
  const signupConfirm = document.getElementById('signup-confirm');
  const signupError = document.getElementById('signup-error');
  const btnSignupSubmit = document.getElementById('btn-signup-submit');

  const btnGoogle = document.getElementById('btn-google-login');
  const btnForgot = document.getElementById('btn-forgot-password');

  // --- Dashboard Header Elements ---
  const authFirstName = document.getElementById('auth-first-name');
  const authFirstNameHi = document.getElementById('auth-first-name-hi');
  const authAvatar = document.getElementById('auth-avatar');
  const profileDropdownBtn = document.getElementById('topbar-profile-dropdown-btn');
  const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
  const btnSignOut = document.getElementById('btn-sign-out');
  const btnGoProfile = document.getElementById('btn-go-profile'); // Connect to your internal nav if needed

  // --- 2. Auth State Listener ---
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is logged in -> Go to dashboard
      // Prevent infinite loop if already on dashboard.html (though auth.js isn't usually there)
      if (window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
      }
    } else {
      // User is NOT logged in -> Stay on login or redirect to index if trying to access dashboard
      if (window.location.pathname.includes('dashboard.html') || 
          window.location.pathname.includes('herd.html') || 
          window.location.pathname.includes('alerts.html')) {
        window.location.href = 'index.html';
      }
    }
  });


  // --- 3. UI Tab Switching Logic ---
  if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
  if (tabSignup) tabSignup.addEventListener('click', () => switchTab('signup'));

  function switchTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      authTabSlider.style.transform = 'translateX(0)';

      loginForm.classList.add('active');
      signupForm.classList.remove('active');
    } else {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      authTabSlider.style.transform = 'translateX(100%)';

      signupForm.classList.add('active');
      loginForm.classList.remove('active');
    }
    clearErrors();
  }

  // Handle URL parameters on load
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab');
  if (initialTab === 'signup') {
    switchTab('signup');
  } else {
    switchTab('login');
  }

  // --- 4. Password Toggle logic ---
  const toggleVisibility = (inputId, iconId) => {
    const input = document.getElementById(inputId);
    const iconBtn = document.getElementById(iconId);
    if (!input || !iconBtn) return;
    const icon = iconBtn.querySelector('i');

    iconBtn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  };

  toggleVisibility('login-password', 'login-eye');
  toggleVisibility('signup-password', 'signup-eye');
  toggleVisibility('signup-confirm', 'signup-confirm-eye');


  // --- 5. Firebase Error Mapping ---
  function getFriendlyErrorMessage(error) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please login.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-credential':
        return 'Invalid credentials. Please make sure email and password are correct.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/weak-password':
        return 'Password is too weak. Must be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  }

  function clearErrors() {
    loginError.textContent = '';
    signupError.textContent = '';
    const inputs = document.querySelectorAll('.auth-field input');
    inputs.forEach(input => input.classList.remove('error-border'));
  }

  function showError(formType, message, inputsToHighlight = []) {
    if (formType === 'login') {
      loginError.textContent = message;
    } else {
      signupError.textContent = message;
    }
    inputsToHighlight.forEach(input => input.classList.add('error-border'));
  }

  function validateEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  function setLoadingState(btnId, isLoading, originalText = '') {
    const btn = document.getElementById(btnId);
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || originalText;
    }
  }


  // --- 6. Signup Logic ---
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = signupName.value.trim();
    const farm = signupFarm.value.trim();
    const email = signupEmail.value.trim();
    const pass = signupPass.value;
    const confirm = signupConfirm.value;

    let hasError = false;

    if (!name || !farm || !email || !pass || !confirm) {
      showError('signup', 'All fields are required.', []);
      hasError = true;
    } else if (!validateEmail(email)) {
      showError('signup', 'Please enter a valid email.', [signupEmail]);
      hasError = true;
    } else if (pass.length < 6) {
      showError('signup', 'Password must be at least 6 characters.', [signupPass]);
      hasError = true;
    } else if (pass !== confirm) {
      showError('signup', 'Passwords do not match.', [signupPass, signupConfirm]);
      hasError = true;
    }

    if (hasError) return;

    setLoadingState('btn-signup-submit', true);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
      const user = userCredential.user;

      // Update Firebase Profile
      await user.updateProfile({
        displayName: name
      });

      // Save farm name
      localStorage.setItem('kisanTrack_farmName', farm);

      // (onAuthStateChanged handles the routing from here)

    } catch (error) {
      showError('signup', getFriendlyErrorMessage(error));
    } finally {
      setLoadingState('btn-signup-submit', false);
    }
  });
  }


  // --- 7. Login Logic ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = loginEmail.value.trim();
    const pass = loginPass.value;

    let hasError = false;
    
    if (!email || !pass) {
      showError('login', 'Please fill in both email and password.');
      hasError = true;
    } else if (!validateEmail(email)) {
      showError('login', 'Please enter a valid email.', [loginEmail]);
      hasError = true;
    }
    
    if (hasError) return;

    setLoadingState('btn-login-submit', true);

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // (onAuthStateChanged handles the routing)
    } catch (error) {
      showError('login', getFriendlyErrorMessage(error));
    } finally {
      setLoadingState('btn-login-submit', false);
    }
  });
  }


  // --- 8. Google Login Logic ---
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
    try {
      await auth.signInWithPopup(googleProvider);
      // Success handled by state listener
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showError(loginForm.classList.contains('active') ? 'login' : 'signup', getFriendlyErrorMessage(error));
      }
    });
  }


  // --- 9. Forgot Password Logic ---
  if (btnForgot) {
    btnForgot.addEventListener('click', async () => {
    clearErrors();
    const email = loginEmail.value.trim();
    if (!email || !validateEmail(email)) {
      showError('login', 'Please enter a valid email address first.', [loginEmail]);
      return;
    }

    try {
      await auth.sendPasswordResetEmail(email);
      showToast('✓ Reset link sent to your email / रीसेट लिंक आपके ईमेल पर भेजा गया');
    } catch (error) {
      showError('login', getFriendlyErrorMessage(error));
    }
  });
  }


  // --- 10. Topbar and Sign Out logic ---

  // Handle dropdown toggle
  if (profileDropdownBtn && profileDropdownMenu) {
    profileDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      if (profileDropdownMenu.classList.contains('show')) {
        profileDropdownMenu.classList.remove('show');
      }
    });

    profileDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent closing immediately before action runs
    });
  }

  // Handle Sign Out
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      if (profileDropdownMenu) profileDropdownMenu.classList.remove('show');
      try {
        await auth.signOut();
        // Clear local state to prevent leaks between different users on same device
        localStorage.removeItem('kt_selected_animal_id');
        localStorage.removeItem('kisanTrack_farmName'); 

        showToast('You have been signed out / आप साइन आउट हो गए');
        if (window.isLandingPage) {
          switchTab('login'); // ensure they land back on login tab
        } else {
          window.location.href = 'index.html';
        }
      } catch (error) {
        console.error('Sign Out Error', error);
        showToast('Error signing out. Try again.', 'error');
      }
    });
  }

  // Tie Go Profile directly to existing mobile-nav/sidebar navigation logic
  if (btnGoProfile) {
    btnGoProfile.addEventListener('click', () => {
      if (profileDropdownMenu) profileDropdownMenu.classList.remove('show');
      // Simulate click on the actual profile tab if nav profile tab exists
      const navProfile = document.getElementById('nav-profile');
      const mnavProfile = document.getElementById('mnav-profile');
      if (navProfile) navProfile.click();
      else if (mnavProfile) mnavProfile.click();
    });
  }


  // Re-use Global ShowToast function if exists, else define minimal one here
  // Note: dashboard already has `#app-toast` and global `showToast` in `alerts.js`, 
  // but if auth.js loads before or separately we can use it, standard app.js loading order means it handles it
  function showToast(msg, type='success') {
    // Rely on global showToast from alerts.js if exists
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
    } else {
      // Fallback
      console.log('TOAST:', msg);
    }
  }

});
