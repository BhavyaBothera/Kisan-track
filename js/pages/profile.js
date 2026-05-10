/**
 * KisanTrack — profile.js
 * Comprehensive Profile Management System
 * Features: Tab switching, multi-section edits, Firestore sync
 */
var ProfileModule = (function () {
  'use strict';

  let isEditing = false;
  let farmerData = null;

  const CONFIG = {
    personal: ['fullName', 'yearsOfFarming', 'village', 'district', 'state'],
    farm: ['farmName', 'farmSizeAcres', 'primaryAnimal', 'sensorSystemId']
  };

  function render() {
    if (!farmerData) return;

    const f = farmerData;
    const initials = f.fullName ? (f.fullName.split(' ')[0][0] + (f.fullName.split(' ')[1] ? f.fullName.split(' ')[1][0] : '')).toUpperCase() : 'F';

    // 1. Update Hero
    const heroName = document.getElementById('hero-name');
    if (heroName) heroName.textContent = f.fullName || 'Farmer Name';
    const heroAvatar = document.getElementById('profile-avatar-display');
    if (heroAvatar) heroAvatar.textContent = initials;

    // 2. Render Personal Tab Fields
    const personalRoot = document.getElementById('personal-fields-root');
    if (personalRoot) {
      personalRoot.innerHTML = CONFIG.personal.map(key => 
        fieldRow(capitalize(key), key, f[key], key === 'yearsOfFarming' ? 'number' : 'text')
      ).join('');
    }

    // 3. Render Farm Tab Fields
    const farmRoot = document.getElementById('farm-fields-root');
    if (farmRoot) {
      farmRoot.innerHTML = CONFIG.farm.map(key => 
        fieldRow(capitalize(key), key, f[key], key === 'farmSizeAcres' ? 'number' : 'text')
      ).join('');
    }

    // 4. Update Stats
    const state = (window.FirestoreStore && typeof window.FirestoreStore.getState === 'function') ? window.FirestoreStore.getState() : { animals: [], alerts: [] };
    document.getElementById('stat-total-animals').textContent = state.animals.length;
    document.getElementById('stat-active-alerts').textContent = state.alerts.filter(a => !a.resolved).length;

    // 5. Toggle Edit UI
    const controls = document.getElementById('edit-controls');
    if (controls) controls.style.display = isEditing ? 'flex' : 'none';
  }

  function fieldRow(label, key, val, type) {
    const displayLabel = label.replace(/([A-Z])/g, ' $1').trim();
    return `
      <div class="profile-field-row">
        <span class="field-label">${displayLabel}</span>
        ${isEditing ? 
          `<input type="${type}" id="pfi-${key}" class="field-input" value="${val || ''}">` : 
          `<span class="field-value">${val || '—'}</span>`
        }
      </div>
    `;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
      btn.onclick = () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(p => {
          p.classList.remove('active');
          if (p.id === `pane-${target}`) p.classList.add('active');
        });
      };
    });
  }

  async function saveAll() {
    if (!auth.currentUser) return;
    
    const updates = {};
    [...CONFIG.personal, ...CONFIG.farm].forEach(key => {
      const el = document.getElementById(`pfi-${key}`);
      if (el) updates[key] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
    });

    try {
      await db.collection('farmers').doc(auth.currentUser.uid).update(updates);
      farmerData = { ...farmerData, ...updates };
      isEditing = false;
      render();
      if (window.showToast) window.showToast('✓ Profile updated successfully');
    } catch (err) {
      console.error('Profile Save Error:', err);
    }
  }

  function init() {
    setupTabs();
    
    // Auth Listener Connection
    if (auth.currentUser) {
      db.collection('farmers').doc(auth.currentUser.uid).onSnapshot(doc => {
        if (doc.exists) {
          farmerData = doc.data();
          render();
        }
      });
    }

    // Handlers
    document.getElementById('global-edit-btn').onclick = () => { isEditing = true; render(); };
    document.getElementById('cancel-all-btn').onclick = () => { isEditing = false; render(); };
    document.getElementById('save-all-btn').onclick = saveAll;

    // Auto-init fallback
    setTimeout(() => { if (!farmerData) init(); }, 1000);
  }

  return { init };
})();
