/**
 * ============================================================
 * KisanTrack — Animals Module (animals.js)
 * Searchable, filterable animal profile grid
 * ============================================================
 */

const AnimalsModule = (function () {
  'use strict';

  let currentFilter = 'all';
  let currentSearch = '';

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function statusClass(status) {
    return status === 'Healthy' ? 'healthy'
         : status === 'Warning' ? 'warning'
         : 'critical';
  }

  function getFilteredAnimals() {
    const state = getState();
    if (!state) return [];

    return state.animals.filter(animal => {
      const matchFilter = currentFilter === 'all' || animal.speciesKey === currentFilter;
      const searchTerm  = currentSearch.toLowerCase();
      const matchSearch = !searchTerm
        || animal.animalId.toLowerCase().includes(searchTerm)
        || animal.breed.toLowerCase().includes(searchTerm)
        || animal.species.toLowerCase().includes(searchTerm)
        || animal.tagId.toLowerCase().includes(searchTerm);
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
      return `
        <div class="profile-card status-${sc.toLowerCase()}">
          <div class="profile-top">
            <div class="profile-emoji">${animal.emoji}</div>
            <div class="profile-meta">
              <div class="profile-id">${animal.species} #${animal.animalId}</div>
              <div class="profile-breed">${animal.breed}</div>
              <div style="margin-top:6px;">
                <span class="badge badge-${sc.toLowerCase()}">${animal.status}</span>
              </div>
            </div>
          </div>

          <div class="profile-details">
            <div class="profile-detail-item">
              <div class="detail-label">Age / उम्र</div>
              <div class="detail-value">${animal.age} yrs</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Weight / वजन</div>
              <div class="detail-value">${animal.weight} kg</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Tag ID / टैग</div>
              <div class="detail-value" style="font-size:0.8rem;">${animal.tagId}</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Temp / तापमान</div>
              <div class="detail-value">38.5°C</div>
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
