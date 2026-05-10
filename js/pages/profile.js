// ============================================
// KisanTrack — profile.js
// Purpose: Farmer Profile Management
// Page: profile.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-09
// ============================================
const ProfileModule = (function () {
  'use strict';

  let isEditing = false;
  let farmerData = null;

  const EDITABLE_FIELDS = [
    'fullName', 'farmName', 'village', 'district', 'state',
    'farmSizeAcres', 'yearsOfFarming', 'primaryAnimal', 'sensorSystemId'
  ];

  function render() {
    const root = document.getElementById('profile-section-root');
    if (!root) return;

    if (!farmerData) {
      root.innerHTML = '<div class="profile-loading">Loading Profile...</div>';
      return;
    }

    const state = window.FirestoreStore ? window.FirestoreStore.getState() : { animals: [], alerts: [] };
    const totalAnimals = state.animals.length;
    const activeAlerts = state.alerts.filter(a => !a.resolved).length;
    
    const f = farmerData;
    const initials = f.fullName ? (f.fullName.split(' ')[0][0] + (f.fullName.split(' ')[1] ? f.fullName.split(' ')[1][0] : '')).toUpperCase() : 'F';

    root.innerHTML = `
      <div class="profile-avatar-block">
        <div class="profile-avatar">${initials}</div>
        <h2 class="profile-full-name">${f.fullName || 'Farmer'}</h2>
        <p class="profile-farm-label">${f.farmName || 'My Farm'}</p>
        <div class="profile-avatar-actions">
          <button class="btn btn-secondary" id="edit-profile-btn" ${isEditing ? 'style="display:none;"' : ''}>
            <i class="fa-solid fa-pen-to-square"></i> Edit Profile
          </button>
          <div class="profile-edit-actions" id="profile-edit-actions" style="${isEditing ? 'display:flex;' : 'display:none;'}">
            <button class="btn btn-primary" id="save-profile-btn">Save</button>
            <button class="btn btn-secondary" id="cancel-profile-btn">Cancel</button>
          </div>
        </div>
      </div>

      <div class="profile-cards-grid">
        <div class="profile-info-card">
          <h3 class="profile-card-title"><i class="fa-solid fa-user"></i> Personal Info</h3>
          ${profileField('fa-signature', 'Full Name', 'fullName', f.fullName)}
          ${profileField('fa-house', 'Village', 'village', f.village)}
          ${profileField('fa-flag', 'State', 'state', f.state)}
        </div>
        <div class="profile-info-card">
          <h3 class="profile-card-title"><i class="fa-solid fa-tractor"></i> Farm Info</h3>
          ${profileField('fa-seedling', 'Farm Name', 'farmName', f.farmName)}
          ${profileField('fa-vector-square', 'Size (Acres)', 'farmSizeAcres', f.farmSizeAcres, 'number')}
        </div>
      </div>

      <div class="profile-stats-row">
        <div class="profile-stat-chip"><i class="fa-solid fa-cow"></i> <strong>${totalAnimals}</strong> Animals</div>
        <div class="profile-stat-chip"><i class="fa-solid fa-bell"></i> <strong>${activeAlerts}</strong> Alerts</div>
      </div>
    `;

    attachHandlers();
  }

  function profileField(icon, label, key, val, type = 'text') {
    return `
      <div class="profile-field">
        <div class="profile-field-label"><i class="fa-solid ${icon}"></i> <span>${label}</span></div>
        <div class="profile-field-value">
          ${isEditing && key ? `<input type="${type}" id="pfi-${key}" class="form-input" value="${val || ''}">` : `<span>${val || '—'}</span>`}
        </div>
      </div>
    `;
  }

  function attachHandlers() {
    const eb = document.getElementById('edit-profile-btn');
    if (eb) eb.onclick = () => { isEditing = true; render(); };
    const cb = document.getElementById('cancel-profile-btn');
    if (cb) cb.onclick = () => { isEditing = false; render(); };
    const sb = document.getElementById('save-profile-btn');
    if (sb) sb.onclick = saveProfile;
  }

  async function saveProfile() {
    if (!auth.currentUser) return;
    const updates = {};
    EDITABLE_FIELDS.forEach(key => {
      const el = document.getElementById(`pfi-${key}`);
      if (el) updates[key] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
    });

    try {
      await db.collection('farmers').doc(auth.currentUser.uid).update(updates);
      farmerData = { ...farmerData, ...updates };
      isEditing = false;
      render();
      if (window.showToast) window.showToast('Profile updated!');
    } catch (err) {
      if (window.showToast) window.showToast('Error saving profile.', 'error');
    }
  }

  function init() {
    if (auth.currentUser) {
      db.collection('farmers').doc(auth.currentUser.uid).onSnapshot(doc => {
        if (doc.exists) { farmerData = doc.data(); render(); }
      });
    }
    document.addEventListener('kisanTrack:stateUpdated', render);
  }

  return { init };
})();
