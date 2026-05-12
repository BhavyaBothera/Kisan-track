// ============================================
// KisanTrack — herd.js
// Purpose: Animal Profile & Listing Logic
// Page: herd.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-12
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
                ${vitals.temp || 38.5}°C
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

  // ── Add Animal Modal (ROBUST) ──────────────────────────────
  function initAddAnimal() {
    // Delegated click listener for buttons
    document.addEventListener('click', (e) => {
      // 1. Open Button
      const openBtn = e.target.closest('#open-add-animal-btn');
      if (openBtn) {
        e.preventDefault();
        const modal = document.getElementById('add-animal-modal');
        const form = document.getElementById('add-animal-form');
        if (modal && form) {
          form.reset();
          form.querySelectorAll('.form-error').forEach(err => err.classList.remove('visible'));
          modal.classList.add('open');
        }
        return;
      }

      // 2. Close Buttons
      if (e.target.closest('#add-animal-close') || e.target.closest('#cancel-add-animal')) {
        const modal = document.getElementById('add-animal-modal');
        if (modal) modal.classList.remove('open');
      }
    });

    // Form submission listener
    const form = document.getElementById('add-animal-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        f.querySelectorAll('.form-error').forEach(err => err.classList.remove('visible'));

        const data = {
          animalId: document.getElementById('new-animal-id').value.trim(),
          species: document.getElementById('new-species').value,
          breed: document.getElementById('new-breed').value.trim(),
          tagId: document.getElementById('new-tag-id').value.trim(),
          age: parseInt(document.getElementById('new-age').value),
          weight: parseFloat(document.getElementById('new-weight').value),
          status: document.getElementById('new-status').value
        };

        if (!data.animalId) { document.getElementById('err-animal-id').classList.add('visible'); return; }
        if (!data.species) { document.getElementById('err-species').classList.add('visible'); return; }

        const submitBtn = document.getElementById('submit-add-animal');
        const originalHtml = submitBtn.innerHTML;

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
          
          await window.FirestoreStore.addAnimal(data);
          
          if (window.showToast) window.showToast('Animal added successfully! / पशु सफलतापूर्वक जोड़ा गया!');
          document.getElementById('add-animal-modal').classList.remove('open');
        } catch (err) {
          console.error('Herd: Add failed', err);
          if (window.showToast) window.showToast('Error adding animal.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHtml;
        }
      });
    }
  }

  // ── Public API ────────────────────────────────────────────
  function init() {
    if (this._initialized) return;
    this._initialized = true;
    
    console.log('HerdModule: Initializing...');
    renderProfiles();
    initFilters();
    initSearch();
    initAddAnimal();

    document.addEventListener('kisanTrack:stateUpdated', () => {
      renderProfiles();
    });
  }

  return { init, _initialized: false };
})();

// Global assignment
window.HerdModule = HerdModule;

// Bootloader: Handle Race Conditions
(function boot() {
    const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
    if (state && state.initializedUid) {
        window.HerdModule.init();
    } else {
        // Fallback to DOMContentLoaded or custom event
        document.addEventListener('DOMContentLoaded', () => {
            // Check again after a short delay to let auth.js run
            setTimeout(() => {
                if (window.HerdModule && !window.HerdModule._initialized) {
                    const s = window.FirestoreStore ? window.FirestoreStore.getState() : null;
                    if (s && s.initializedUid) window.HerdModule.init();
                }
            }, 500);
        });
    }
})();
