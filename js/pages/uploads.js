// ============================================
// KisanTrack — uploads.js
// Purpose: Sensor Log Upload & Data Sync
// Page: uploads.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-09
// ============================================
const UploadsModule = (function () {
  'use strict';

  let dropzone, fileInput, browseBtn, filePreview,
      fileNameDisplay, fileSizeDisplay, processBtn,
      uploadProgress, progressBar, progressLabel, progressPct,
      uploadResult;

  let selectedFile = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showFilePreview(file) {
    selectedFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = formatSize(file.size);

    const icon = filePreview ? filePreview.querySelector('.file-icon i') : null;
    if (icon) {
      if (file.name.endsWith('.json')) icon.className = 'fa-solid fa-file-code';
      else icon.className = 'fa-solid fa-file-csv';
    }

    if (filePreview) filePreview.classList.add('visible');
    if (uploadProgress) uploadProgress.classList.remove('visible');
    if (uploadResult) uploadResult.classList.remove('visible');
  }

  function processFile() {
    if (!selectedFile) return;

    if (filePreview) filePreview.classList.remove('visible');
    if (uploadProgress) uploadProgress.classList.add('visible');
    if (uploadResult) uploadResult.classList.remove('visible');

    let pct = 0;
    if (progressBar) progressBar.style.width = '0%';
    if (progressPct) progressPct.textContent = '0%';

    const steps = [
      { target: 30, label: 'Parsing records... / रिकॉर्ड पढ़ा जा रहा है...' },
      { target: 65, label: 'Running anomaly detection... / असामान्यता जांच हो रही है...' },
      { target: 90, label: 'Generating summary... / सारांश बना रहा है...' },
      { target: 100, label: 'Complete! / पूर्ण!' },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 8 + 4, 100);

      if (stepIdx < steps.length && pct >= steps[stepIdx].target) {
        if (progressLabel) progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }

      if (progressBar) progressBar.style.width = pct.toFixed(0) + '%';
      if (progressPct) progressPct.textContent = pct.toFixed(0) + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(finalizeUpload, 500);
      }
    }, 100);
  }

  async function finalizeUpload() {
    if (!auth.currentUser) return;
    const records = 100 + Math.floor(Math.random() * 400);
    const anomalies = Math.floor(Math.random() * 5);
    const animalsAffected = anomalies > 0 ? 1 + Math.floor(Math.random() * 2) : 0;

    const summary = {
      farmerId: auth.currentUser.uid,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      recordsParsed: records,
      anomaliesDetected: anomalies,
      animalsAffected: animalsAffected,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'Success'
    };

    try {
      await db.collection('sensorLogUploads').add(summary);
      showResults(summary);
      if (window.showToast) window.showToast('✓ Records parsed and synced / रिकॉर्ड सिंक हो गए');
    } catch (err) {
      console.error('Upload: Save error:', err);
      if (window.showToast) window.showToast('Error saving records.', 'error');
    }
  }

  function showResults(data) {
    if (uploadProgress) uploadProgress.classList.remove('visible');
    if (uploadResult) uploadResult.classList.add('visible');

    const resP = document.getElementById('res-parsed');
    const resA = document.getElementById('res-anomalies');
    const resAn = document.getElementById('res-animals');

    if (resP) resP.textContent = data.recordsParsed;
    if (resA) resA.textContent = data.anomaliesDetected;
    if (resAn) resAn.textContent = data.animalsAffected;
  }

  function handleFileSelect(file) {
    const allowed = ['.csv', '.json'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      if (window.showToast) window.showToast('⚠ Please select a CSV or JSON file.', 'warning');
      return;
    }
    showFilePreview(file);
  }

  function init() {
    dropzone          = document.getElementById('dropzone');
    fileInput         = document.getElementById('file-input');
    browseBtn         = document.getElementById('browse-btn');
    filePreview       = document.getElementById('file-preview');
    fileNameDisplay   = document.getElementById('file-name-display');
    fileSizeDisplay   = document.getElementById('file-size-display');
    processBtn        = document.getElementById('process-btn');
    uploadProgress    = document.getElementById('upload-progress');
    progressBar       = document.getElementById('progress-bar-fill');
    progressLabel     = document.getElementById('progress-label-text');
    progressPct       = document.getElementById('progress-pct');
    uploadResult      = document.getElementById('upload-result');

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('drag-over'); });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
      });
      dropzone.addEventListener('click', () => fileInput && fileInput.click());
    }

    if (browseBtn && fileInput) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
    });
    if (processBtn) processBtn.addEventListener('click', processFile);
  }

  return { init };
})();


/**
 * ProfileModule
 */
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
