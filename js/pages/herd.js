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

  // ── Public API ────────────────────────────────────────────
  function init() {
    renderProfiles();
    initFilters();
    initSearch();

    document.addEventListener('kisanTrack:stateUpdated', () => {
      renderProfiles();
    });
  }

  return { init };
})();
