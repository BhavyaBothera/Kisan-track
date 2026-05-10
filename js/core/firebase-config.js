// ============================================
// KisanTrack — firebase-config.js
// Purpose: Main logic for firebase-config.js
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================
// 1. Firebase Configuration
// NOTE: Firebase client config is safe to expose
// publicly. Security is enforced by Firestore Rules
// and Firebase Auth, not by hiding this config.
// Do NOT commit your Gemini API key here.
const firebaseConfig = {
  apiKey: "AIzaSyASdnlePbXPc4qKNCGqNecOvhpFunMhcTk",
  authDomain: "kisan-track.firebaseapp.com",
  projectId: "kisan-track",
  storageBucket: "kisan-track.firebasestorage.app",
  messagingSenderId: "239457493981",
  appId: "1:239457493981:web:3746aa1e43b1d76cbc0c34",
  measurementId: "G-7VPHV9GSTX"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.auth = firebase.auth();
window.db = firebase.firestore();
if (typeof firebase.storage === 'function') {
  window.storage = firebase.storage();
}
window.googleProvider = new firebase.auth.GoogleAuthProvider();

// Enable Persistence for offline handling
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
