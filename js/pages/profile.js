// ============================================
// KisanTrack — profile.js
// Purpose: Farmer Profile Management
// Page: profile.html
// Dependencies: Firebase, FirestoreStore
// ============================================
var ProfileModule = (function () {
  'use strict';

  var isEditing = false;
  var farmerData = null;

  var EDITABLE_FIELDS = [
    'fullName', 'farmName', 'village', 'district', 'state',
    'farmSizeAcres', 'yearsOfFarming', 'primaryAnimal', 'sensorSystemId'
  ];

  function render() {
    var root = document.getElementById('profile-section-root');
    if (!root) return;

    if (!farmerData) {
      root.innerHTML = `
        <div class="profile-loading" style="padding: 100px; text-align: center; color: var(--text-dim);">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 15px; color: var(--accent-green);"></i>
          <p>Loading your profile... / आपका प्रोफ़ाइल लोड हो रहा है...</p>
        </div>
      `;
      return;
    }

    try {
        const state = (window.FirestoreStore && typeof window.FirestoreStore.getState === 'function') 
            ? window.FirestoreStore.getState() 
            : { animals: [], alerts: [] };
            
        const totalAnimals = state.animals ? state.animals.length : 0;
        const activeAlerts = state.alerts ? state.alerts.filter(a => !a.resolved).length : 0;
        
        const f = farmerData;
        const initials = f.fullName ? (f.fullName.split(' ')[0][0] + (f.fullName.split(' ')[1] ? f.fullName.split(' ')[1][0] : '')).toUpperCase() : 'F';

        root.innerHTML = `
          <div class="profile-avatar-block">
            <div class="profile-avatar">${initials}</div>
            <h2 class="profile-full-name">${f.fullName || 'Farmer Name'}</h2>
            <p class="profile-farm-label"><i class="fa-solid fa-location-dot"></i> ${f.farmName || 'My Farm'} • ${f.village || 'Village'}</p>
            <div class="profile-avatar-actions">
              <button class="btn btn-secondary" id="edit-profile-btn" ${isEditing ? 'style="display:none;"' : ''}>
                <i class="fa-solid fa-pen-to-square"></i> Edit Profile
              </button>
              <div class="profile-edit-actions" id="profile-edit-actions" style="${isEditing ? 'display:flex;' : 'display:none;'}">
                <button class="btn btn-primary" id="save-profile-btn">Save Changes</button>
                <button class="btn btn-secondary" id="cancel-profile-btn">Cancel</button>
              </div>
            </div>
          </div>

          <div class="profile-cards-grid">
            <!-- Personal Section -->
            <div class="profile-info-card">
              <h3 class="profile-card-title"><i class="fa-solid fa-user-circle"></i> Personal Information / <span class="hi">व्यक्तिगत जानकारी</span></h3>
              ${profileField('fa-signature', 'Full Name', 'fullName', f.fullName)}
              ${profileField('fa-calendar-check', 'Experience (Years)', 'yearsOfFarming', f.yearsOfFarming, 'number')}
              ${profileField('fa-house-user', 'Village', 'village', f.village)}
              ${profileField('fa-map-location-dot', 'District', 'district', f.district)}
              ${profileField('fa-flag', 'State', 'state', f.state)}
            </div>

            <!-- Farm Section -->
            <div class="profile-info-card">
              <h3 class="profile-card-title"><i class="fa-solid fa-tractor"></i> Farm Details / <span class="hi">खेत का विवरण</span></h3>
              ${profileField('fa-seedling', 'Farm Name', 'farmName', f.farmName)}
              ${profileField('fa-vector-square', 'Total Area (Acres)', 'farmSizeAcres', f.farmSizeAcres, 'number')}
              ${profileField('fa-cow', 'Primary Livestock', 'primaryAnimal', f.primaryAnimal)}
              ${profileField('fa-microchip', 'Sensor System ID', 'sensorSystemId', f.sensorSystemId)}
            </div>
          </div>

          <div class="profile-stats-row">
            <div class="profile-stat-chip"><i class="fa-solid fa-paw"></i> <strong>${totalAnimals}</strong> Animals Registered</div>
            <div class="profile-stat-chip"><i class="fa-solid fa-shield-virus"></i> <strong>${activeAlerts}</strong> Active Alerts</div>
            <div class="profile-stat-chip"><i class="fa-solid fa-award"></i> Premium Member</div>
          </div>

          <div class="analytics-card" style="margin-top:24px; padding: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);">
            <h3 class="profile-card-title" style="margin-bottom:20px;"><i class="fa-solid fa-clock-rotate-left"></i> Recent Activity / हाल की गतिविधि</h3>
            <div class="activity-timeline">
                <div class="timeline-item" style="display:flex; gap:15px; margin-bottom:15px;">
                    <div style="color:var(--accent-green);"><i class="fa-solid fa-circle-check"></i></div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Updated inventory records - <span style="color:var(--text-dim);">2 hours ago</span></div>
                </div>
                <div class="timeline-item" style="display:flex; gap:15px; margin-bottom:15px;">
                    <div style="color:var(--accent-blue);"><i class="fa-solid fa-syringe"></i></div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Logged vaccination for Animal C002 - <span style="color:var(--text-dim);">1 day ago</span></div>
                </div>
                <div class="timeline-item" style="display:flex; gap:15px;">
                    <div style="color:var(--accent-amber);"><i class="fa-solid fa-user-plus"></i></div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">Added new calf to herd profile - <span style="color:var(--text-dim);">3 days ago</span></div>
                </div>
            </div>
          </div>
        `;
        attachHandlers();
    } catch (err) {
        console.error('Profile Render Error:', err);
        root.innerHTML = '<div class="error-msg">Error displaying profile. Please refresh.</div>';
    }
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
      if (window.showToast) window.showToast('✓ Profile updated successfully!');
    } catch (err) {
      console.error('Profile: Save error:', err);
      if (window.showToast) window.showToast('Error saving profile.', 'error');
    }
  }

  function init() {
    console.log('ProfileModule: Initializing...');
    
    // Ensure root is ready
    const root = document.getElementById('profile-section-root');
    if (root && !farmerData) {
        root.innerHTML = `
          <div class="profile-loading" style="padding: 100px; text-align: center; color: var(--text-dim);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 15px; color: var(--accent-green);"></i>
            <p>Loading your profile... / आपका प्रोफ़ाइल लोड हो रहा है...</p>
          </div>
        `;
    }

    if (auth.currentUser) {
      db.collection('farmers').doc(auth.currentUser.uid).onSnapshot(doc => {
        if (doc.exists) { 
          farmerData = doc.data(); 
          render(); 
        } else {
          const defaultData = {
            fullName: auth.currentUser.displayName || 'New Farmer',
            farmName: 'My Farm',
            village: 'Village Name',
            district: '',
            state: '',
            farmSizeAcres: 0,
            yearsOfFarming: 0,
            primaryAnimal: 'Cattle',
            sensorSystemId: 'KS-' + Math.floor(Math.random()*10000)
          };
          db.collection('farmers').doc(auth.currentUser.uid).set(defaultData);
        }
      }, err => {
          console.error('Profile Snapshot Error:', err);
          if (root) root.innerHTML = '<div class="error-msg">Permission denied or connection error.</div>';
      });
    } else {
        console.warn('ProfileModule: No current user during init.');
    }
  }

  // Auto-init safety check
  // If this script loads AFTER auth.js has already initialized the page,
  // we need to trigger init() manually.
  setTimeout(() => {
    if (!farmerData && window.location.pathname.includes('profile.html')) {
        console.log('ProfileModule: Auto-init triggered');
        init();
    }
  }, 1000);

  document.addEventListener('kisanTrack:stateUpdated', render);

  return { init };
})();
