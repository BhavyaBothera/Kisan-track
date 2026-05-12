// ============================================
// KisanTrack — herd.js
// Purpose: Animal Profile & Listing Logic
// Page: herd.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-09
// ============================================
const HerdModule = (function () {
  'use strict';

  let currentFilter = 'all';
  let currentSearch = '';

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function statusClass(status) {
    if (!status) return 'healthy';
    return status.toLowerCase();
  }

  function getFilteredAnimals() {
    const state = getState();
    if (!state || !state.animals) return [];

    return state.animals.filter(animal => {
      const matchFilter = currentFilter === 'all' || animal.speciesKey === currentFilter;
      const searchTerm  = currentSearch.toLowerCase();
      const matchSearch = !searchTerm
        || (animal.animalId && animal.animalId.toLowerCase().includes(searchTerm))
        || (animal.breed && animal.breed.toLowerCase().includes(searchTerm))
        || (animal.species && animal.species.toLowerCase().includes(searchTerm))
        || (animal.tagId && animal.tagId.toLowerCase().includes(searchTerm));
      return matchFilter && matchSearch;
    });
  }

  // ── Render Profiles ───────────────────────────────────────
  function renderProfiles() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;

    const state = getState();
    if (!state || state.isLoading) {
      grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="profile-card skeleton-pulse" style="height:250px; background:rgba(255,255,255,0.05); border:none;"></div>
      `).join('');
      return;
    }

    const animals = getFilteredAnimals();

    if (!animals.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <i class="fa-solid fa-paw"></i>
          <p>No animals match your search.<br>कोई पशु नहीं मिला।</p>
        </div>`;
      return;
    }

    grid.innerHTML = animals.map(animal => {
      const sc = statusClass(animal.status);
      const vitals = state.vitals && state.vitals[animal.id] ? state.vitals[animal.id] : (animal.vitals || {});
      
      return `
        <div class="profile-card status-${sc}">
          <div class="profile-top">
            <div class="profile-emoji">${animal.emoji || '🐄'}</div>
            <div class="profile-meta">
              <div class="profile-id">${animal.species || 'Animal'} #${animal.animalId || '---'}</div>
              <div class="profile-breed">${animal.breed || 'Unknown'}</div>
              <div style="margin-top:6px;">
                <span class="badge badge-${sc}">${animal.status || 'Healthy'}</span>
              </div>
            </div>
          </div>

          <div class="profile-details">
            <div class="profile-detail-item">
              <div class="detail-label">Age / उम्र</div>
              <div class="detail-value">${animal.age || '--'} yrs</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Weight / वजन</div>
              <div class="detail-value">${animal.weight || '--'} kg</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Tag ID / टैग</div>
              <div class="detail-value" style="font-size:0.8rem;">${animal.tagId || '---'}</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Temp / तापमान</div>
              <div class="detail-value">
                ${vitals.bodyTempCelsius || vitals.temp || 38.5}°C
              </div>
            </div>
          </div>

          <button class="btn btn-secondary btn-sm view-detail-btn" data-id="${animal.id}" style="width:100%;justify-content:center;">
            <i class="fa-solid fa-circle-info"></i> View Details / विवरण देखें
          </button>
        </div>
      `;
    }).join('');

    // Attach view detail handlers
    grid.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.openAnimalModal) window.openAnimalModal(btn.dataset.id);
      });
    });
  }

  // ── Filter Buttons ────────────────────────────────────────
  function initFilters() {
    const filterBar = document.getElementById('animal-filter-bar');
    if (!filterBar) return;
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderProfiles();
      });
    });
  }

  // ── Search ────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('animal-search');
    if (!input) return;
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearch = input.value;
        renderProfiles();
      }, 250);
    });
  }

  // ── Add Animal Modal ──────────────────────────────────────
  function initAddAnimal() {
    const modal = document.getElementById('add-animal-modal');
    const openBtn = document.getElementById('open-add-animal-btn');
    const closeBtn = document.getElementById('add-animal-close');
    const cancelBtn = document.getElementById('cancel-add-animal');
    const form = document.getElementById('add-animal-form');

    if (!modal || !openBtn || !form) return;

    const openModal = () => {
      form.reset();
      clearErrors();
      modal.classList.add('open');
    };

    const closeModal = () => {
      modal.classList.remove('open');
    };

    const clearErrors = () => {
      form.querySelectorAll('.form-error').forEach(err => err.classList.remove('visible'));
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const data = {
        animalId: document.getElementById('new-animal-id').value.trim(),
        species: document.getElementById('new-species').value,
        breed: document.getElementById('new-breed').value.trim(),
        tagId: document.getElementById('new-tag-id').value.trim(),
        age: parseInt(document.getElementById('new-age').value),
        weight: parseFloat(document.getElementById('new-weight').value),
        status: document.getElementById('new-status').value
      };

      // Simple Validation
      let hasError = false;
      if (!data.animalId) { document.getElementById('err-animal-id').classList.add('visible'); hasError = true; }
      if (!data.species) { document.getElementById('err-species').classList.add('visible'); hasError = true; }
      if (!data.breed) { document.getElementById('err-breed').classList.add('visible'); hasError = true; }
      if (!data.tagId) { document.getElementById('err-tag-id').classList.add('visible'); hasError = true; }
      if (isNaN(data.age)) { document.getElementById('err-age').classList.add('visible'); hasError = true; }
      if (isNaN(data.weight)) { document.getElementById('err-weight').classList.add('visible'); hasError = true; }
      if (!data.status) { document.getElementById('err-status').classList.add('visible'); hasError = true; }

      if (hasError) return;

      const submitBtn = document.getElementById('submit-add-animal');
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        await window.FirestoreStore.addAnimal(data);
        
        if (window.showToast) window.showToast('Animal added successfully! / पशु सफलतापूर्वक जोड़ा गया!');
        closeModal();
      } catch (err) {
        console.error('Herd: Add animal failed', err);
        if (window.showToast) window.showToast('Error adding animal. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // ── Public API ────────────────────────────────────────────
  function init() {
    console.log('HerdModule: Initializing...');
    
    renderProfiles();
    initFilters();
    initSearch();
    initAddAnimal();

    // Listen for state updates from FirestoreStore
    document.addEventListener('kisanTrack:stateUpdated', () => {
      console.log('HerdModule: State updated, re-rendering...');
      renderProfiles();
    });
  }

  // --- Auto-init Fallback ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('HerdModule: DOMContentLoaded fallback check');
      // If auth.js didn't init us within 2 seconds, we try ourselves
      setTimeout(() => {
        const state = getState();
        if (state && state.initializedUid && !document.querySelector('.profile-card')) {
           init();
        }
      }, 2000);
    });
  }

  return { init };
})();

// Safety call if script is loaded after auth
if (window.HerdModule && !window.HerdModule._initialized) {
   // auth.js usually handles this, but let's be safe
}
