/**
 * ============================================================
 * KisanTrack — Add Animal Module (add-animal.js)
 *
 * Handles:
 *  - Opening / closing the "Add Animal" modal
 *  - Form validation with red-highlight on empty fields
 *  - Building a full animal record (vitals, history, AI summary)
 *  - Pushing the new animal into APP_DATA.animals (global store)
 *  - Re-rendering: KPI cards, herd grid, profile list, vitals
 *    dropdown — without a page reload
 *  - Showing a success toast notification
 * ============================================================
 */

const AddAnimalModule = (function () {
  'use strict';

  // ── Species meta map ──────────────────────────────────────
  const SPECIES_META = {
    Cow:     { emoji: '🐄', speciesKey: 'cows',      baseTemp: 38.6, baseHR: 68, baseActivity: 55 },
    Buffalo: { emoji: '🐃', speciesKey: 'buffaloes', baseTemp: 38.9, baseHR: 70, baseActivity: 50 },
    Goat:    { emoji: '🐐', speciesKey: 'goats',     baseTemp: 39.1, baseHR: 76, baseActivity: 65 },
  };

  // ── DOM refs (populated in init) ─────────────────────────
  let modal, form, closeBtn, cancelBtn, openBtn;

  // ── Modal open / close ────────────────────────────────────
  function openModal() {
    form.reset();
    clearAllErrors();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus first field for accessibility
    setTimeout(() => document.getElementById('new-animal-id').focus(), 100);
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Validation helpers ────────────────────────────────────
  function setError(inputEl, errorId, show) {
    const errEl = document.getElementById(errorId);
    if (show) {
      inputEl.classList.add('input-error');
      errEl.classList.add('visible');
    } else {
      inputEl.classList.remove('input-error');
      errEl.classList.remove('visible');
    }
  }

  function clearAllErrors() {
    form.querySelectorAll('.form-input').forEach(el => {
      el.classList.remove('input-error');
    });
    form.querySelectorAll('.form-error').forEach(el => {
      el.classList.remove('visible');
    });
  }

  // Clear error on user interaction
  function attachLiveValidation() {
    form.querySelectorAll('.form-input').forEach(el => {
      el.addEventListener('input',  () => { el.classList.remove('input-error'); });
      el.addEventListener('change', () => { el.classList.remove('input-error'); });
    });
  }

  function validateForm() {
    const id      = document.getElementById('new-animal-id');
    const species = document.getElementById('new-species');
    const breed   = document.getElementById('new-breed');
    const tagId   = document.getElementById('new-tag-id');
    const age     = document.getElementById('new-age');
    const weight  = document.getElementById('new-weight');
    const status  = document.getElementById('new-status');

    let valid = true;

    // Animal ID — required + unique
    const idVal = id.value.trim().toUpperCase();
    const isDuplicate = APP_DATA.animals.some(a => a.id === idVal);
    if (!idVal) {
      setError(id, 'err-animal-id', true);
      document.getElementById('err-animal-id').textContent = 'Please enter a unique Animal ID.';
      valid = false;
    } else if (isDuplicate) {
      setError(id, 'err-animal-id', true);
      document.getElementById('err-animal-id').textContent = 'This ID already exists. Use a different one.';
      valid = false;
    } else {
      setError(id, 'err-animal-id', false);
    }

    // Species
    if (!species.value) {
      setError(species, 'err-species', true);
      valid = false;
    } else {
      setError(species, 'err-species', false);
    }

    // Breed
    if (!breed.value.trim()) {
      setError(breed, 'err-breed', true);
      valid = false;
    } else {
      setError(breed, 'err-breed', false);
    }

    // Tag ID
    if (!tagId.value.trim()) {
      setError(tagId, 'err-tag-id', true);
      valid = false;
    } else {
      setError(tagId, 'err-tag-id', false);
    }

    // Age
    const ageVal = parseInt(age.value);
    if (isNaN(ageVal) || ageVal < 0 || ageVal > 30) {
      setError(age, 'err-age', true);
      valid = false;
    } else {
      setError(age, 'err-age', false);
    }

    // Weight
    const weightVal = parseInt(weight.value);
    if (isNaN(weightVal) || weightVal < 1) {
      setError(weight, 'err-weight', true);
      valid = false;
    } else {
      setError(weight, 'err-weight', false);
    }

    // Status
    if (!status.value) {
      setError(status, 'err-status', true);
      valid = false;
    } else {
      setError(status, 'err-status', false);
    }

    return valid;
  }

  // ── Build animal record from form ─────────────────────────
  function buildAnimalRecord() {
    const idVal      = document.getElementById('new-animal-id').value.trim().toUpperCase();
    const speciesVal = document.getElementById('new-species').value;
    const breedVal   = document.getElementById('new-breed').value.trim();
    const tagIdVal   = document.getElementById('new-tag-id').value.trim();
    const ageVal     = parseInt(document.getElementById('new-age').value);
    const weightVal  = parseInt(document.getElementById('new-weight').value);
    const statusVal  = document.getElementById('new-status').value;

    const meta = SPECIES_META[speciesVal] || SPECIES_META.Cow;

    // Derive activity label from baseActivity
    const activityLabel = meta.baseActivity >= 70 ? 'High'
                        : meta.baseActivity >= 40 ? 'Normal'
                        : 'Low';

    // Generate 7-day history with small fluctuations
    const history7d = generateHistory(meta.baseTemp, meta.baseHR, meta.baseActivity);

    // Generate a plausible AI summary
    const aiSummary = generateAISummary(idVal, speciesVal, meta.baseTemp, meta.baseHR, statusVal);

    return {
      id:         idVal,
      emoji:      meta.emoji,
      species:    speciesVal,
      speciesKey: meta.speciesKey,
      breed:      breedVal,
      age:        ageVal,
      weight:     weightVal,
      tagId:      tagIdVal,
      status:     statusVal,
      vitals: {
        temp:     parseFloat(meta.baseTemp.toFixed(1)),
        hr:       meta.baseHR,
        activity: activityLabel,
      },
      baseVitals: {
        temp:     meta.baseTemp,
        hr:       meta.baseHR,
        activity: meta.baseActivity,
      },
      history7d,
      aiSummary,
      confidence: parseFloat((85 + Math.random() * 12).toFixed(1)),
    };
  }

  function generateHistory(baseTemp, baseHR, baseActivity) {
    const labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];
    const temp     = labels.map(() => parseFloat((baseTemp + (Math.random() - 0.5) * 0.4).toFixed(1)));
    const hr       = labels.map(() => Math.round(baseHR + (Math.random() - 0.5) * 4));
    const activity = labels.map(() => Math.round(baseActivity + (Math.random() - 0.5) * 8));
    return { labels, temp, hr, activity };
  }

  function generateAISummary(id, species, temp, hr, status) {
    const note = status === 'Healthy'
      ? `${species} #${id} has been registered and initial readings are within normal ranges. Vitals look stable — temperature at ${temp.toFixed(1)}°C and heart rate at ${hr} bpm. Continue routine monitoring.`
      : status === 'Warning'
      ? `${species} #${id} has been registered with a Warning status. Please monitor closely over the next 24 hours. Baseline temperature is ${temp.toFixed(1)}°C and heart rate is ${hr} bpm.`
      : `${species} #${id} has been registered with a Critical status. Immediate veterinary assessment is recommended. All vital readings should be verified with an on-site check.`;
    return note;
  }

  // ── Re-render all dependent UI ────────────────────────────
  function refreshAll() {
    // 1. Dashboard KPI cards + herd grid
    if (typeof DashboardModule !== 'undefined') {
      DashboardModule.init();
    }

    // 2. Animal Profiles grid
    if (typeof AnimalsModule !== 'undefined') {
      AnimalsModule.init();
    }

    // 3. Vitals dropdown
    if (typeof VitalsModule !== 'undefined') {
      VitalsModule.refreshSelector();
    }
  }

  // Use shared toast from utils.js
  const showToast = (msg) => window.showToast && window.showToast(msg);

  // ── Form submit ───────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) return;

    // Build + push to global data store
    const newAnimal = buildAnimalRecord();
    APP_DATA.animals.push(newAnimal);

    // Close modal
    closeModal();

    // Refresh UI
    refreshAll();

    // Show toast
    showToast('✓ Animal Added Successfully / पशु सफलतापूर्वक जोड़ा गया');
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    modal     = document.getElementById('add-animal-modal');
    form      = document.getElementById('add-animal-form');
    closeBtn  = document.getElementById('add-animal-close');
    cancelBtn = document.getElementById('cancel-add-animal');
    openBtn   = document.getElementById('open-add-animal-btn');

    // Open
    openBtn.addEventListener('click', openModal);

    // Close
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    // Submit
    form.addEventListener('submit', handleSubmit);

    // Live validation (clear errors on input)
    attachLiveValidation();
  }

  return { init };
})();
