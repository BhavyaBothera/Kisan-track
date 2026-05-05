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

  let modal, form, closeBtn, cancelBtn, openBtn;

  // ── Modal open / close ────────────────────────────────────
  function openModal() {
    form.reset();
    clearAllErrors();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('new-animal-id').focus(), 100);
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Validation helpers ────────────────────────────────────
  function setError(inputEl, errorId, show) {
    const errEl = document.getElementById(errorId);
    if (show) { inputEl.classList.add('input-error'); errEl.classList.add('visible'); }
    else { inputEl.classList.remove('input-error'); errEl.classList.remove('visible'); }
  }

  function clearAllErrors() {
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('input-error'));
    form.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
  }

  async function validateForm() {
    const id      = document.getElementById('new-animal-id');
    const species = document.getElementById('new-species');
    const breed   = document.getElementById('new-breed');
    const tagId   = document.getElementById('new-tag-id');
    
    let valid = true;
    const idVal = id.value.trim().toUpperCase();
    const state = window.FirestoreStore.getState();
    const isDuplicate = state.animals.some(a => a.animalId === idVal);

    if (!idVal) {
      setError(id, 'err-animal-id', true);
      document.getElementById('err-animal-id').textContent = 'Please enter a unique Animal ID.';
      valid = false;
    } else if (isDuplicate) {
      setError(id, 'err-animal-id', true);
      document.getElementById('err-animal-id').textContent = 'This ID already exists in your herd.';
      valid = false;
    } else {
      setError(id, 'err-animal-id', false);
    }

    ['new-species', 'new-breed', 'new-tag-id', 'new-age', 'new-weight', 'new-status'].forEach(fid => {
      const el = document.getElementById(fid);
      if (!el.value.trim()) { setError(el, 'err-' + fid.replace('new-', ''), true); valid = false; }
      else { setError(el, 'err-' + fid.replace('new-', ''), false); }
    });

    return valid;
  }

  // ── Build & Submit ────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Adding...';

    if (!(await validateForm())) {
      processBtn.disabled = false;
      processBtn.textContent = 'Add Animal / पशु जोड़ें';
      return;
    }

    const animalData = {
      farmerId: auth.currentUser.uid,
      animalId: document.getElementById('new-animal-id').value.trim().toUpperCase(),
      species: document.getElementById('new-species').value,
      breed: document.getElementById('new-breed').value.trim(),
      tagId: document.getElementById('new-tag-id').value.trim(),
      age: parseInt(document.getElementById('new-age').value),
      weight: parseInt(document.getElementById('new-weight').value),
      status: document.getElementById('new-status').value,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      vitals: {
        lastTemp: 38.5,
        lastHeartRate: 70,
        lastActivity: 'Normal'
      }
    };

    try {
      await db.collection('animals').add(animalData);
      closeModal();
      showToast('✓ Animal added successfully to cloud.');
    } catch (err) {
      console.error('Error adding animal:', err);
      showToast('Error adding animal to cloud.', 'error');
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Add Animal / पशु जोड़ें';
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    modal     = document.getElementById('add-animal-modal');
    form      = document.getElementById('add-animal-form');
    closeBtn  = document.getElementById('add-animal-close');
    cancelBtn = document.getElementById('cancel-add-animal');
    openBtn   = document.getElementById('open-add-animal-btn');
    const processBtn = document.getElementById('process-btn'); // Local ref

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    form.addEventListener('submit', handleSubmit);

    form.querySelectorAll('.form-input').forEach(el => {
      el.addEventListener('input', () => el.classList.remove('input-error'));
    });
  }

  return { init };
})();
