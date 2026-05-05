/**
 * ============================================================
 * KisanTrack — Profile Module (profile.js)
 * Farmer profile display, inline editing, and save/toast
 * ============================================================
 */

const ProfileModule = (function () {
  'use strict';

  // ── Edit State ────────────────────────────────────────────
  let isEditing = false;
  // Snapshot of values before editing (for cancel)
  let editSnapshot = {};

  // Editable fields: [fieldKey, inputType]
  const EDITABLE_FIELDS = [
    'fullName', 'age', 'phone', 'village', 'district', 'state',
    'farmName', 'farmSize', 'yearsOfFarming', 'primaryAnimalType', 'sensorSystemId',
  ];

  // Use shared toast from utils.js
  const showToast = (msg) => window.showToast && window.showToast(msg);

  // ── Render profile section ─────────────────────────────────
  function render() {
    const f = APP_DATA.farmer;
    const totalAnimals  = APP_DATA.animals.length;
    const activeAlerts  = APP_DATA.alerts.filter(a => !a.resolved).length;

    document.getElementById('profile-section-root').innerHTML = `

      <!-- ── Avatar block ──────────────────────────────────── -->
      <div class="profile-avatar-block">
        <div class="profile-avatar" id="profile-avatar">${f.initials}</div>
        <h2 class="profile-full-name" id="profile-display-name">${f.fullName}</h2>
        <p class="profile-farm-label">${f.farmName}</p>
        <span class="badge badge-healthy profile-active-badge">
          <i class="fa-solid fa-circle-check"></i>
          Active Farmer / सक्रिय किसान
        </span>
        <div class="profile-avatar-actions">
          <button class="btn btn-secondary" id="edit-profile-btn">
            <i class="fa-solid fa-pen-to-square"></i>
            Edit Profile / प्रोफ़ाइल संपादित करें
          </button>
          <div class="profile-edit-actions" id="profile-edit-actions" style="display:none;">
            <button class="btn btn-primary" id="save-profile-btn">
              <i class="fa-solid fa-floppy-disk"></i> Save Changes / सहेजें
            </button>
            <button class="btn btn-secondary" id="cancel-profile-btn">
              <i class="fa-solid fa-xmark"></i> Cancel / रद्द करें
            </button>
          </div>
        </div>
      </div>

      <!-- ── Info Cards grid ───────────────────────────────── -->
      <div class="profile-cards-grid">

        <!-- Card 1: Personal Info -->
        <div class="profile-info-card">
          <h3 class="profile-card-title">
            <i class="fa-solid fa-user"></i>
            Personal Info / व्यक्तिगत जानकारी
          </h3>
          ${profileField('fa-signature',      'Full Name / पूरा नाम',      'fullName',         f.fullName,         'text')}
          ${profileField('fa-cake-candles',   'Age / आयु',                  'age',              f.age,              'number')}
          ${profileField('fa-phone',          'Phone Number / फ़ोन नंबर',   'phone',            f.phone,            'tel')}
          ${profileField('fa-house',          'Village / गाँव',             'village',         f.village,          'text')}
          ${profileField('fa-map-location-dot','District / जिला',           'district',         f.district,         'text')}
          ${profileField('fa-flag',           'State / राज्य',              'state',            f.state,            'text')}
        </div>

        <!-- Card 2: Farm Details -->
        <div class="profile-info-card">
          <h3 class="profile-card-title">
            <i class="fa-solid fa-tractor"></i>
            Farm Details / खेत की जानकारी
          </h3>
          ${profileField('fa-seedling',       'Farm Name / खेत का नाम',     'farmName',         f.farmName,         'text')}
          ${profileField('fa-vector-square',  'Farm Size / खेत का आकार',    'farmSize',         f.farmSize,         'text')}
          ${profileField('fa-cow',            'Total Animals / कुल पशु',    null,               totalAnimals,       null,  true)}
          ${profileField('fa-calendar-days',  'Years Farming / खेती के वर्ष','yearsOfFarming',   f.yearsOfFarming,   'number')}
          ${profileField('fa-paw',            'Primary Animal / मुख्य पशु', 'primaryAnimalType',f.primaryAnimalType,'text')}
          ${profileField('fa-microchip',      'Sensor System ID',            'sensorSystemId',   f.sensorSystemId,   'text')}
        </div>

        <!-- Card 3: Account Info (read-only) -->
        <div class="profile-info-card profile-account-card">
          <h3 class="profile-card-title">
            <i class="fa-solid fa-shield-halved"></i>
            Account Info / खाता जानकारी
          </h3>
          ${profileField('fa-id-badge',       'Farmer ID',                  null,               f.farmerId,         null, true)}
          ${profileField('fa-calendar-plus',  'Registration Date / पंजीकरण तिथि', null,         f.registrationDate, null, true)}
          ${profileField('fa-right-to-bracket','Last Login / अंतिम लॉगिन',  null,               f.lastLogin,        null, true)}
          ${profileField('fa-code-branch',    'System Version / सिस्टम संस्करण', null,          f.systemVersion,    null, true)}
        </div>

      </div>

      <!-- ── Quick Stats Row ──────────────────────────────── -->
      <div class="profile-stats-row">
        <div class="profile-stat-chip">
          <i class="fa-solid fa-cow" style="color:var(--accent-green);"></i>
          <strong id="pstat-animals">${totalAnimals}</strong>
          <span>Animals Registered / पशु पंजीकृत</span>
        </div>
        <div class="profile-stat-chip">
          <i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-amber);"></i>
          <strong id="pstat-alerts" style="color:var(--accent-amber);">${activeAlerts}</strong>
          <span>Active Alerts / सक्रिय अलर्ट</span>
        </div>
        <div class="profile-stat-chip">
          <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i>
          <strong style="color:var(--accent-green);">94%</strong>
          <span>System Uptime / सिस्टम अपटाइम</span>
        </div>
      </div>
    `;

    attachEditHandlers();
  }

  // ── Field renderer ────────────────────────────────────────
  function profileField(icon, label, fieldKey, value, inputType, readOnly = false) {
    const isEditableFld = fieldKey && !readOnly;
    const displayValue  = value !== null && value !== undefined ? value : '—';

    return `
      <div class="profile-field" data-field="${fieldKey || ''}">
        <div class="profile-field-label">
          <i class="fa-solid ${icon}" aria-hidden="true"></i>
          <span>${label}</span>
        </div>
        <div class="profile-field-value">
          <span class="pfield-display ${readOnly ? 'pfield-readonly' : ''}"
                id="pfd-${fieldKey || label.replace(/\W/g,'')}">${displayValue}</span>
          ${isEditableFld ? `
            <input
              class="form-input pfield-input"
              id="pfi-${fieldKey}"
              type="${inputType || 'text'}"
              value="${displayValue}"
              style="display:none;"
              aria-label="${label}"
            />
          ` : ''}
          ${readOnly ? '<span class="pfield-lock"><i class="fa-solid fa-lock"></i></span>' : ''}
        </div>
      </div>
    `;
  }

  // ── Attach edit/save/cancel handlers ──────────────────────
  function attachEditHandlers() {
    const editBtn    = document.getElementById('edit-profile-btn');
    const saveBtn    = document.getElementById('save-profile-btn');
    const cancelBtn  = document.getElementById('cancel-profile-btn');
    const editActions= document.getElementById('profile-edit-actions');

    editBtn.addEventListener('click', () => {
      if (isEditing) return;
      isEditing = true;

      // Snapshot current values
      editSnapshot = {};
      EDITABLE_FIELDS.forEach(key => {
        editSnapshot[key] = APP_DATA.farmer[key];
      });

      // Show inputs, hide spans
      EDITABLE_FIELDS.forEach(key => {
        const span  = document.getElementById(`pfd-${key}`);
        const input = document.getElementById(`pfi-${key}`);
        if (span)  span.style.display  = 'none';
        if (input) input.style.display = 'block';
      });

      editBtn.style.display     = 'none';
      editActions.style.display = 'flex';

      // Focus first editable
      const firstInput = document.getElementById('pfi-fullName');
      if (firstInput) firstInput.focus();
    });

    saveBtn.addEventListener('click', () => {
      // Read values from inputs → update APP_DATA.farmer
      EDITABLE_FIELDS.forEach(key => {
        const input = document.getElementById(`pfi-${key}`);
        if (!input) return;
        const raw = input.value.trim();
        // Type coerce number fields
        APP_DATA.farmer[key] = (input.type === 'number') ? (parseFloat(raw) || raw) : raw;
      });

      // Update initials from new name
      const nameParts = APP_DATA.farmer.fullName.trim().split(' ');
      APP_DATA.farmer.initials = (nameParts[0][0] + (nameParts[1] ? nameParts[1][0] : '')).toUpperCase();

      exitEditMode();
      render(); // full re-render with new data
      showToast('✓ Profile Updated / प्रोफ़ाइल अपडेट हो गई');
    });

    cancelBtn.addEventListener('click', () => {
      // Restore snapshot
      EDITABLE_FIELDS.forEach(key => {
        APP_DATA.farmer[key] = editSnapshot[key];
      });
      exitEditMode();
      render();
    });
  }

  function exitEditMode() {
    isEditing = false;
    // Swap inputs back to spans (re-render does this, but guard just in case)
    EDITABLE_FIELDS.forEach(key => {
      const span  = document.getElementById(`pfd-${key}`);
      const input = document.getElementById(`pfi-${key}`);
      if (span)  span.style.display  = '';
      if (input) input.style.display = 'none';
    });
    const editBtn    = document.getElementById('edit-profile-btn');
    const editActions= document.getElementById('profile-edit-actions');
    if (editBtn)    editBtn.style.display     = '';
    if (editActions) editActions.style.display = 'none';
  }

  // ── Public ────────────────────────────────────────────────
  function init() {
    render();
  }

  return { init, render };
})();
