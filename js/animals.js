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

  // ── Helpers ───────────────────────────────────────────────
  function statusClass(status) {
    return status === 'Healthy' ? 'healthy'
         : status === 'Warning' ? 'warning'
         : 'critical';
  }

  function getFilteredAnimals() {
    return APP_DATA.animals.filter(animal => {
      const matchFilter = currentFilter === 'all' || animal.speciesKey === currentFilter;
      const searchTerm  = currentSearch.toLowerCase();
      const matchSearch = !searchTerm
        || animal.id.toLowerCase().includes(searchTerm)
        || animal.breed.toLowerCase().includes(searchTerm)
        || animal.species.toLowerCase().includes(searchTerm)
        || animal.tagId.toLowerCase().includes(searchTerm);
      return matchFilter && matchSearch;
    });
  }

  // ── Render Profiles ───────────────────────────────────────
  function renderProfiles() {
    const grid    = document.getElementById('profiles-grid');
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
      const statusNote = animal.statusNote
        ? `<span style="font-size:0.75rem;color:var(--accent-amber);display:block;margin-top:2px;">⚠ ${animal.statusNote}</span>`
        : '';

      return `
        <div class="profile-card status-${sc.toLowerCase()}">
          <div class="profile-top">
            <div class="profile-emoji">${animal.emoji}</div>
            <div class="profile-meta">
              <div class="profile-id">${animal.species} #${animal.id}</div>
              <div class="profile-breed">${animal.breed}</div>
              <div style="margin-top:6px;">
                <span class="badge badge-${sc.toLowerCase()}">${animal.status}</span>
                ${statusNote}
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
              <div class="detail-value">${animal.vitals.temp}°C</div>
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
      btn.addEventListener('click', () => window.openAnimalModal(btn.dataset.id));
    });
  }

  // ── Filter Buttons ────────────────────────────────────────
  function initFilters() {
    const filterBar = document.getElementById('animal-filter-bar');
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
  }

  return { init };
})();
