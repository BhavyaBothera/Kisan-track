/**
 * ============================================================
 * KisanTrack — Authentication Module
 * Handles Firebase Auth integration, forms, and UI states.
 * ============================================================
 */

// 1. Firebase Configuration (PLACEHOLDER)
const firebaseConfig = {
  apiKey: "AIzaSyAiJVcnM9rTFzFRnhZk9Txb7k-gotnBCAg",
  authDomain: "et-201.firebaseapp.com",
  projectId: "et-201",
  storageBucket: "et-201.firebasestorage.app",
  messagingSenderId: "936111262185",
  appId: "1:936111262185:web:44eb32fcc0ce086aba2378",
  measurementId: "G-NBT02CPT26"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {

  // --- UI Elements ---
  const landingScreen = document.getElementById('landing-screen');
  const authScreen = document.getElementById('auth-screen');
  const appDashboard = document.getElementById('app-dashboard');

  const btnLandingLogin = document.getElementById('btn-landing-login');
  const btnLandingSignup = document.getElementById('btn-landing-signup');
  const btnHeroGetStarted = document.getElementById('btn-hero-getstarted');
  const btnFinalSignup = document.getElementById('btn-final-signup');

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
  const btnGoProfile = document.getElementById('btn-go-profile');

  // --- 2. Auth State Listener ---
  auth.onAuthStateChanged((user) => {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isDashboardPage = path.includes('dashboard.html');
    const isLandingPage = path.includes('index.html') || path === '/' || path.endsWith('/');

    if (user) {
      // User is logged in
      if (isLandingPage || isLoginPage) {
        window.location.href = 'dashboard.html';
        return;
      }

      // Setup user details if on dashboard
      if (isDashboardPage) {
        const displayName = user.displayName || user.email.split('@')[0];
        const firstName = displayName.split(' ')[0];
        const initial = displayName.charAt(0).toUpperCase();

        if (authFirstName) authFirstName.textContent = firstName;
        if (authFirstNameHi) authFirstNameHi.textContent = firstName;
        if (authAvatar) authAvatar.textContent = initial;

        showToast(`Welcome back, ${firstName}! / नमस्ते!`);
      }
    } else {
      // User is NOT logged in
      if (isDashboardPage) {
        window.location.href = 'index.html';
        return;
      }
      
      // Reset forms if on login page
      if (isLoginPage) {
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();
        clearErrors();
      }
    }
  });


  // --- 3. UI Tab Switching Logic ---
  function switchTab(tab) {
    if (!tabLogin || !tabSignup || !authTabSlider || !loginForm || !signupForm) return;
    
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

  if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
  if (tabSignup) tabSignup.addEventListener('click', () => switchTab('signup'));

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

  // Utility functions now served by window (utils.js)
  const clearErrors = () => window.clearErrors && window.clearErrors();
  const showError = (type, msg, fields) => window.showError && window.showError(type, msg, fields);
  const validateEmail = (email) => window.validateEmail && window.validateEmail(email);
  const setLoadingState = (id, loading, text) => window.setLoadingState && window.setLoadingState(id, loading, text);


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
          const type = (loginForm && loginForm.classList.contains('active')) ? 'login' : 'signup';
          showError(type, getFriendlyErrorMessage(error));
        }
      }
    });
  }


  // --- 9. Forgot Password Logic ---
  if (btnForgot) {
    btnForgot.addEventListener('click', async () => {
      clearErrors();
      const email = loginEmail ? loginEmail.value.trim() : '';
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
        showToast('You have been signed out / आप साइन आउट हो गए');
        // Redirection handled by onAuthStateChanged
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
  // Use global showToast from utils
  // Use global showToast from utils
  function showToast(msg, type = 'success') {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      console.log('TOAST:', msg);
    }
  }

});
