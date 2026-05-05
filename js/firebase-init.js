/**
 * ============================================================
 * KisanTrack — Firebase Initialization
 * ============================================================
 */

// 1. Firebase Configuration
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
const db = firebase.firestore();
const storage = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Enable Persistence for offline handling
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
