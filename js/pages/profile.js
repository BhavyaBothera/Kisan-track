// ============================================
// KisanTrack — profile.js
// Purpose: Farmer Profile Management (Pixel-Perfect)
// ============================================
var ProfileModule = (function () {
  'use strict';

  var isEditing = false;
  var farmerData = null;

  var CONFIG = {
    personal: [
        { key: 'fullName', label: 'Full Name', icon: 'fa-signature' },
        { key: 'yearsOfFarming', label: 'Experience (Years)', icon: 'fa-calendar-check', type: 'number' },
        { key: 'village', label: 'Village', icon: 'fa-house-user' },
        { key: 'district', label: 'District', icon: 'fa-map-location-dot' },
        { key: 'state', label: 'State', icon: 'fa-flag' }
    ],
    farm: [
        { key: 'farmName', label: 'Farm Name', icon: 'fa-seedling' },
        { key: 'farmSizeAcres', label: 'Total Area (Acres)', icon: 'fa-vector-square', type: 'number' },
        { key: 'primaryAnimal', label: 'Primary Livestock', icon: 'fa-cow' },
        { key: 'sensorSystemId', label: 'Sensor System ID', icon: 'fa-microchip' }
    ]
  };

  function render() {
    var root = document.getElementById('profile-section-root');
    if (!root) return;

    if (!farmerData) {
      root.innerHTML = `
        <div class="profile-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <p style="margin-top:15px;">Loading Farmer Profile... / किसान प्रोफ़ाइल लोड हो रहा है...</p>
        </div>
      `;
      return;
    }

    const f = farmerData;
    const initials = f.fullName ? (f.fullName.split(' ')[0][0] + (f.fullName.split(' ')[1] ? f.fullName.split(' ')[1][0] : '')).toUpperCase() : 'F';

    // 1. Update KPI Values (Standard Classes: .kpi-val)
    const state = (window.FirestoreStore && typeof window.FirestoreStore.getState === 'function') 
        ? window.FirestoreStore.getState() 
        : { animals: [], alerts: [] };
    
    const sAnimals = document.getElementById('stat-total-animals');
    const sAlerts = document.getElementById('stat-active-alerts');
    if (sAnimals) sAnimals.textContent = state.animals.length;
    if (sAlerts) sAlerts.textContent = state.alerts.filter(a => !a.resolved).length;

    // 2. Render Profile Sections
    root.innerHTML = `
      <div class="profile-avatar-row">
        <div class="profile-avatar-circle">${initials}</div>
        <div class="profile-name-block">
            <h2>${f.fullName || 'Farmer Name'}</h2>
            <p><i class="fa-solid fa-location-dot"></i> ${f.village || 'Village'}, ${f.state || 'State'}</p>
        </div>
        <div style="margin-left:auto;">
            <button class="btn btn-secondary" id="edit-profile-btn" style="${isEditing ? 'display:none;' : ''}">
                <i class="fa-solid fa-user-pen"></i> Edit Profile
            </button>
        </div>
      </div>

      <div class="profile-main-grid">
        <!-- Personal Information Card -->
        <div class="profile-info-card">
            <div class="profile-card-header">
                <h3 class="profile-card-title"><i class="fa-solid fa-id-card"></i> Personal Information</h3>
            </div>
            <div class="profile-card-body">
                ${CONFIG.personal.map(field => fieldRow(field, f[field.key])).join('')}
            </div>
        </div>

        <!-- Farm Details Card -->
        <div class="profile-info-card">
            <div class="profile-card-header">
                <h3 class="profile-card-title"><i class="fa-solid fa-tractor"></i> Farm Details</h3>
            </div>
            <div class="profile-card-body">
                ${CONFIG.farm.map(field => fieldRow(field, f[field.key])).join('')}
            </div>
        </div>
      </div>

      ${isEditing ? `
        <div class="profile-actions-bar">
            <button class="btn btn-secondary" id="cancel-profile-btn">Cancel</button>
            <button class="btn btn-primary" id="save-profile-btn">Save All Changes</button>
        </div>
      ` : ''}

      <div class="profile-info-card" style="margin-top:24px; background: rgba(124, 181, 24, 0.05);">
          <div class="profile-card-header" style="border-bottom: 1px solid rgba(124, 181, 24, 0.1);">
              <h3 class="profile-card-title" style="color: var(--accent-green);">
                <i class="fa-solid fa-award"></i> Membership & Status
              </h3>
          </div>
          <div class="profile-card-body" style="padding-top:10px;">
              <p style="color:var(--text-primary); font-size:0.92rem; font-weight: 500;">
                <i class="fa-solid fa-circle-check" style="color:var(--accent-green); margin-right:8px;"></i>
                Your account is verified and active. You are currently on the <strong>Premium Plan</strong>.
              </p>
          </div>
      </div>
    `;

    attachHandlers();
  }

  function fieldRow(field, val) {
    return `
      <div class="profile-field-row">
        <div class="field-label"><i class="fa-solid ${field.icon}"></i> <span>${field.label}</span></div>
        <div class="field-value">
          ${isEditing ? 
            `<input type="${field.type || 'text'}" id="pfi-${field.key}" class="form-input" value="${val || ''}">` : 
            `<span>${val || '—'}</span>`
          }
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
    [...CONFIG.personal, ...CONFIG.farm].forEach(field => {
      const el = document.getElementById(`pfi-${field.key}`);
      if (el) updates[field.key] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
    });

    try {
      await db.collection('farmers').doc(auth.currentUser.uid).update(updates);
      farmerData = { ...farmerData, ...updates };
      isEditing = false;
      render();
      if (window.showToast) window.showToast('✓ Profile saved successfully', 'success');
    } catch (err) {
      console.error('Profile Save Error:', err);
    }
  }

  function init() {
    if (auth.currentUser) {
      db.collection('farmers').doc(auth.currentUser.uid).onSnapshot(doc => {
        if (doc.exists) { farmerData = doc.data(); render(); }
      });
    }
    setTimeout(() => { if (!farmerData && window.location.pathname.includes('profile.html')) init(); }, 1200);
    document.addEventListener('kisanTrack:stateUpdated', render);
  }

  return { init };
})();
