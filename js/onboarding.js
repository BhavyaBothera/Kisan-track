/**
 * KisanTrack — Onboarding Module
 * Handles "Complete Profile" flow for new users.
 */

const OnboardingModule = (function () {
  'use strict';

  const modal = document.getElementById('complete-profile-modal');
  const form = document.getElementById('complete-profile-form');
  const btnSubmit = document.getElementById('btn-complete-profile');

  async function checkProfile() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      const doc = await db.collection('farmers').doc(uid).get();
      if (!doc.exists) {
        // Force profile completion
        openModal();
      }
    } catch (err) {
      console.error('Onboarding: Error checking profile:', err);
    }
  }

  function openModal() {
    if (!modal) return;
    
    // Pre-fill farm name if available from localStorage (saved during signup)
    const savedFarm = localStorage.getItem('kisanTrack_farmName');
    const farmInput = document.getElementById('cp-farm-name');
    if (farmInput && savedFarm) farmInput.value = savedFarm;

    modal.classList.add('open');
    // Disable closing by clicking outside or escape for mandatory onboarding
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Cleanup
    localStorage.removeItem('kisanTrack_farmName');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const uid = auth.currentUser.uid;
    const farmName = document.getElementById('cp-farm-name').value.trim();
    const village = document.getElementById('cp-village').value.trim();
    const district = document.getElementById('cp-district').value.trim();
    const state = document.getElementById('cp-state').value.trim();
    const farmSize = parseFloat(document.getElementById('cp-farm-size').value) || 0;

    if (!farmName || !village || !district || !state || !farmSize) {
      window.showToast('Please fill all fields / कृपया सभी जानकारी भरें', 'error');
      return;
    }

    setLoadingState('btn-complete-profile', true);

    try {
      await db.collection('farmers').doc(uid).set({
        fullName: auth.currentUser.displayName || 'Farmer',
        email: auth.currentUser.email,
        farmName,
        village,
        district,
        state,
        farmSizeAcres: farmSize,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        yearsOfFarming: 0,
        primaryAnimal: 'Cow',
        sensorSystemId: 'KT-' + Math.random().toString(36).substr(2, 6).toUpperCase()
      });

      window.showToast('Profile completed! Welcome to KisanTrack. / प्रोफ़ाइल पूरी हुई!');
      closeModal();
      
      // Notify other modules that state might have changed
      document.dispatchEvent(new CustomEvent('kisanTrack:stateUpdated'));
    } catch (err) {
      console.error('Onboarding: Save failed:', err);
      window.showToast('Error saving profile. Try again.', 'error');
    } finally {
      setLoadingState('btn-complete-profile', false);
    }
  }

  function init() {
    if (form) form.addEventListener('submit', handleSubmit);
    
    // Check profile whenever auth is ready
    auth.onAuthStateChanged(user => {
      if (user) {
        // Small delay to ensure Firestore is ready
        setTimeout(checkProfile, 1000);
      }
    });
  }

  return { init };
})();
