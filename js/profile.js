/**
 * ============================================================
 * KisanTrack — Profile Module (profile.js)
 * Farmer profile display, inline editing, and Firestore save
 * ============================================================
 */
const ProfileModule = (function () {
  'use strict';

  let isEditing = false;
  let farmerData = null;
  let editSnapshot = {};

  const EDITABLE_FIELDS = [
    'fullName', 'farmName', 'village', 'district', 'state',
    'farmSizeAcres', 'yearsOfFarming', 'primaryAnimal', 'sensorSystemId'
  ];

  const showToast = (msg) => window.showToast && window.showToast(msg);

  let unsubscribeFarmer = null;

  function subscribeFarmerData() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    if (unsubscribeFarmer) unsubscribeFarmer();

    unsubscribeFarmer = db.collection('farmers').doc(uid).onSnapshot((doc) => {
      if (doc.exists) {
        farmerData = doc.data();
        render();
      } else {
        console.warn('ProfileModule: Farmer profile not found yet.');
        // Don't clear farmerData yet, might be being created
      }
    }, (err) => {
      console.error('ProfileModule: Listener error:', err);
    });
  }

  function render() {
    if (!farmerData) {
      document.getElementById('profile-section-root').innerHTML = '<div class="profile-loading">Loading Profile...</div>';
      return;
    }

    const state = window.FirestoreStore ? window.FirestoreStore.getState() : { animals: [], alerts: [] };
    const totalAnimals = state.animals.length;
    const activeAlerts = state.alerts.filter(a => !a.resolved).length;
    
    const f = farmerData;
    const initials = f.fullName ? (f.fullName.split(' ')[0][0] + (f.fullName.split(' ')[1] ? f.fullName.split(' ')[1][0] : '')).toUpperCase() : 'U';

    document.getElementById('profile-section-root').innerHTML = `
      <div class="profile-avatar-block">
        <div class="profile-avatar">${initials}</div>
        <h2 class="profile-full-name">${f.fullName || 'Farmer'}</h2>
        <p class="profile-farm-label">${f.farmName || 'My Farm'}</p>
        <span class="badge badge-healthy profile-active-badge">
          <i class="fa-solid fa-circle-check"></i>
          Active Farmer / सक्रिय किसान
        </span>
        <div class="profile-avatar-actions">
          <button class="btn btn-secondary" id="edit-profile-btn" ${isEditing ? 'style="display:none;"' : ''}>
            <i class="fa-solid fa-pen-to-square"></i> Edit Profile
          </button>
          <div class="profile-edit-actions" id="profile-edit-actions" style="${isEditing ? 'display:flex;' : 'display:none;'}">
            <button class="btn btn-primary" id="save-profile-btn">
              <i class="fa-solid fa-floppy-disk"></i> Save Changes
            </button>
            <button class="btn btn-secondary" id="cancel-profile-btn">
              <i class="fa-solid fa-xmark"></i> Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="profile-cards-grid">
        <div class="profile-info-card">
          <h3 class="profile-card-title"><i class="fa-solid fa-user"></i> Personal Info</h3>
          ${profileField('fa-signature', 'Full Name', 'fullName', f.fullName)}
          ${profileField('fa-house', 'Village', 'village', f.village)}
          ${profileField('fa-map-location-dot', 'District', 'district', f.district)}
          ${profileField('fa-flag', 'State', 'state', f.state)}
        </div>

        <div class="profile-info-card">
          <h3 class="profile-card-title"><i class="fa-solid fa-tractor"></i> Farm Details</h3>
          ${profileField('fa-seedling', 'Farm Name', 'farmName', f.farmName)}
          ${profileField('fa-vector-square', 'Farm Size (Acres)', 'farmSizeAcres', f.farmSizeAcres, 'number')}
          ${profileField('fa-calendar-days', 'Years Farming', 'yearsOfFarming', f.yearsOfFarming, 'number')}
          ${profileField('fa-paw', 'Primary Animal', 'primaryAnimal', f.primaryAnimal)}
          ${profileField('fa-microchip', 'Sensor System ID', 'sensorSystemId', f.sensorSystemId)}
        </div>

        <div class="profile-info-card profile-account-card">
          <h3 class="profile-card-title"><i class="fa-solid fa-shield-halved"></i> Account Info</h3>
          ${profileField('fa-id-badge', 'Farmer ID', null, auth.currentUser.uid, null, true)}
          ${profileField('fa-envelope', 'Email', null, f.email, null, true)}
          ${profileField('fa-calendar-plus', 'Registered', null, f.registeredAt ? f.registeredAt.toDate().toLocaleDateString() : '—', null, true)}
        </div>
      </div>

      <div class="profile-stats-row">
        <div class="profile-stat-chip"><i class="fa-solid fa-cow"></i> <strong>${totalAnimals}</strong> Animals Registered</div>
        <div class="profile-stat-chip"><i class="fa-solid fa-triangle-exclamation"></i> <strong>${activeAlerts}</strong> Active Alerts</div>
      </div>
    `;

    attachHandlers();
  }

  function profileField(icon, label, key, val, type = 'text', readOnly = false) {
    const displayVal = val || '—';
    return `
      <div class="profile-field">
        <div class="profile-field-label"><i class="fa-solid ${icon}"></i> <span>${label}</span></div>
        <div class="profile-field-value">
          ${isEditing && key && !readOnly ? 
            `<input type="${type}" id="pfi-${key}" class="form-input" value="${val || ''}">` :
            `<span class="pfield-display">${displayVal}</span>`
          }
          ${readOnly ? '<i class="fa-solid fa-lock" style="font-size:0.7rem; opacity:0.5;"></i>' : ''}
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
    const uid = auth.currentUser.uid;
    const updates = {};
    EDITABLE_FIELDS.forEach(key => {
      const el = document.getElementById(`pfi-${key}`);
      if (el) updates[key] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
    });

    try {
      await db.collection('farmers').doc(uid).update(updates);
      farmerData = { ...farmerData, ...updates };
      isEditing = false;
      render();
      showToast('Profile updated successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Error saving profile.', 'error');
    }
  }

  function init() {
    // If auth is already ready, subscribe immediately
    if (auth.currentUser) {
      subscribeFarmerData();
    } else {
      // Otherwise wait for auth state change
      const authUnsub = auth.onAuthStateChanged(user => {
        if (user) {
          subscribeFarmerData();
          authUnsub(); 
        }
      });
    }
    document.addEventListener('kisanTrack:stateUpdated', render);
  }

  return { init };
})();
