// ============================================
// KisanTrack — herd.js
// Purpose: Animal Profiles Page Logic
// Page: herd.html
// Dependencies: FirestoreStore, Chart.js
// Last Updated: 2026-05-17
// ============================================
const HerdModule = (function () {
  'use strict';

  let currentFilter = 'all';
  let currentSearch = '';
  let _modalChart = null;
  let _initialized = false;

  // ── State helper ─────────────────────────────────────────
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Show skeleton immediately
    renderSkeletons();

    // Re-render whenever Firestore pushes new data
    document.addEventListener('kisanTrack:stateUpdated', () => renderProfiles());

    // Try rendering now (data may already be in the store)
    renderProfiles();

    // Init interactive pieces
    initFilters();
    initSearch();
    initAddAnimalModal();
    initDetailModal();

    // Safety timeout — if nothing loaded in 8s, show empty state
    setTimeout(() => {
      const state = getState();
      if (!state || state.isLoading) {
        const grid = document.getElementById('profiles-grid');
        if (grid && grid.querySelector('.skeleton-pulse')) {
          renderEmptyState(grid, 'Unable to load animals. Check your connection.');
        }
      }
    }, 8000);
  }

  // ── Skeleton shimmer while loading ───────────────────────
  function renderSkeletons() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;
    grid.innerHTML = Array(6).fill(0).map(() => `
      <div class="profile-card skeleton-pulse" style="height:220px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);border-radius:12px;"></div>
    `).join('');
  }

  // ── Empty state helper ───────────────────────────────────
  function renderEmptyState(grid, msg) {
    const filterLabel = currentFilter === 'all' ? '' : ` matching this filter`;
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; padding:56px 24px; text-align:center;">
        <div style="font-size:3.5rem; margin-bottom:16px;">🐄</div>
        <h3 style="color:var(--text-muted); margin-bottom:8px;">No animals found${filterLabel}</h3>
        <p style="color:var(--text-dim); font-size:0.9rem; margin-bottom:20px;">
          ${msg || 'Add your first animal to get started / पहला पशु जोड़ें'}
        </p>
        <button class="btn btn-primary" id="empty-state-add-btn" onclick="document.getElementById('open-add-animal-btn').click()">
          <i class="fa-solid fa-plus-circle"></i> Add Animal / पशु जोड़ें
        </button>
      </div>`;
  }

  // ── Filtering Logic ───────────────────────────────────────
  function getFilteredAnimals() {
    const state = getState();
    if (!state || !state.animals) return [];

    return state.animals.filter(animal => {
      const matchFilter = currentFilter === 'all' || animal.speciesKey === currentFilter;
      const term = currentSearch.toLowerCase().trim();
      const matchSearch = !term
        || (animal.animalId && animal.animalId.toLowerCase().includes(term))
        || (animal.breed    && animal.breed.toLowerCase().includes(term))
        || (animal.species  && animal.species.toLowerCase().includes(term))
        || (animal.tagId    && animal.tagId.toLowerCase().includes(term))
        || (animal.owner    && animal.owner.toLowerCase().includes(term));
      return matchFilter && matchSearch;
    });
  }

  // ── Render Profile Cards ──────────────────────────────────
  function renderProfiles() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;

    const state = getState();

    // Still loading — keep skeleton
    if (!state || state.isLoading) return;

    const animals = getFilteredAnimals();

    if (animals.length === 0) {
      renderEmptyState(grid);
      return;
    }

    grid.innerHTML = animals.map(animal => {
      const sc       = (animal.status || 'healthy').toLowerCase();
      const vitals   = state.vitals && state.vitals[animal.id] ? state.vitals[animal.id] : {};
      const temp     = vitals.temp ? `${vitals.temp}°C` : '--';
      const hr       = vitals.hr   ? `${vitals.hr} bpm` : '--';
      const dobLine  = animal.dob  ? `<div class="detail-label">DOB</div><div class="detail-value">${animal.dob}</div>` : '';
      const ownerLine = animal.owner ? `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:6px;">👤 ${animal.owner}</div>` : '';

      return `
        <div class="profile-card status-${sc}" role="button" tabindex="0"
             onclick="HerdModule.openDetailModal('${animal.id}')"
             onkeydown="if(event.key==='Enter') this.click()"
             title="View ${animal.species} #${animal.animalId}">
          <div class="profile-top">
            <div class="profile-emoji">${animal.emoji || '🐄'}</div>
            <div class="profile-meta">
              <div class="profile-id">${animal.species} #${animal.animalId}</div>
              <div class="profile-breed">${animal.breed || 'Unknown'}</div>
              <div style="margin-top:6px;">
                <span class="badge badge-${sc}">${animal.status || 'Healthy'}</span>
              </div>
              ${ownerLine}
            </div>
          </div>

          <div class="profile-details">
            <div class="profile-detail-item">
              <div class="detail-label">Age / उम्र</div>
              <div class="detail-value">${animal.age ? animal.age + ' yrs' : '--'}</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Weight / वजन</div>
              <div class="detail-value">${animal.weight ? animal.weight + ' kg' : '--'}</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Tag / टैग</div>
              <div class="detail-value" style="font-size:0.78rem;">${animal.tagId || '--'}</div>
            </div>
            <div class="profile-detail-item">
              <div class="detail-label">Temp / तापमान</div>
              <div class="detail-value">${temp}</div>
            </div>
          </div>

          <button class="btn btn-secondary btn-sm" style="width:100%;justify-content:center;margin-top:8px;"
                  onclick="event.stopPropagation(); HerdModule.openDetailModal('${animal.id}')">
            <i class="fa-solid fa-circle-info"></i> View Details
          </button>
        </div>`;
    }).join('');
  }

  // ── Filter Buttons ────────────────────────────────────────
  function initFilters() {
    const bar = document.getElementById('animal-filter-bar');
    if (!bar) return;

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderProfiles();
    });
  }

  // ── Search ────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('animal-search');
    if (!input) return;

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        currentSearch = input.value;
        renderProfiles();
      }, 250);
    });
  }

  // ── Detail Modal ──────────────────────────────────────────
  function initDetailModal() {
    const overlay  = document.getElementById('animal-modal');
    const closeBtn = document.getElementById('modal-close');
    if (overlay)  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
    if (closeBtn) closeBtn.addEventListener('click', () => overlay && overlay.classList.remove('open'));
  }

  function openDetailModal(animalId) {
    const state = getState();
    if (!state) return;
    const animal = state.animals.find(a => a.id === animalId);
    if (!animal) return;

    const overlay = document.getElementById('animal-modal');
    if (!overlay) return;

    // Fill modal fields
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '--'; };
    const vitals = (state.vitals && state.vitals[animal.id]) || {};

    set('modal-emoji',   animal.emoji || '🐄');
    set('modal-title',   `${animal.species} #${animal.animalId}`);
    set('modal-subtitle', `${animal.breed} · ${animal.status}${animal.owner ? ' · ' + animal.owner : ''}`);
    set('modal-temp',    vitals.temp ? `${vitals.temp}°C`    : '--');
    set('modal-hr',      vitals.hr   ? `${vitals.hr} bpm`   : '--');
    set('modal-act',     vitals.activity || '--');
    set('modal-breed',   animal.breed  || '--');
    set('modal-age',     animal.age    ? `${animal.age} yrs`    : animal.dob ? calcAge(animal.dob) : '--');
    set('modal-weight',  animal.weight ? `${animal.weight} kg` : '--');

    // Draw 7-day placeholder chart
    const canvas = document.getElementById('modal-chart');
    if (canvas) {
      if (_modalChart) _modalChart.destroy();
      _modalChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
          datasets: [{
            label: 'Health',
            data: [84, 82, 87, 85, 88, 86, 90],
            borderColor: 'var(--accent-green)',
            backgroundColor: 'rgba(124,181,24,0.1)',
            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: '#64748B', font: { size: 9 } } }
          }
        }
      });
    }

    overlay.classList.add('open');
  }

  function calcAge(dob) {
    if (!dob) return '--';
    const diff = Date.now() - new Date(dob).getTime();
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    return years + ' yrs';
  }

  // ── Add Animal Modal ──────────────────────────────────────
  function initAddAnimalModal() {
    // Use delegated listeners on document to avoid timing issues
    document.addEventListener('click', (e) => {
      if (e.target.closest('#open-add-animal-btn')) {
        openAddModal();
        return;
      }
      if (e.target.closest('#add-animal-close') || e.target.closest('#cancel-add-animal')) {
        closeAddModal();
      }
    });

    const form = document.getElementById('add-animal-form');
    if (form) form.addEventListener('submit', handleAddSubmit);

    // Auto-calculate age from DOB when DOB changes
    const dobInput = document.getElementById('new-dob');
    const ageInput = document.getElementById('new-age');
    if (dobInput && ageInput) {
      dobInput.addEventListener('change', () => {
        if (dobInput.value) {
          const diff  = Date.now() - new Date(dobInput.value).getTime();
          const years = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
          ageInput.value = years;
        }
      });
    }
  }

  function openAddModal() {
    const modal = document.getElementById('add-animal-modal');
    const form  = document.getElementById('add-animal-form');
    if (!modal || !form) return;
    form.reset();
    form.querySelectorAll('.form-error').forEach(e => e.classList.remove('visible'));
    form.querySelectorAll('.form-input').forEach(e => e.classList.remove('input-error'));
    modal.classList.add('open');
    setTimeout(() => document.getElementById('new-animal-id')?.focus(), 100);
  }

  function closeAddModal() {
    const modal = document.getElementById('add-animal-modal');
    if (modal) modal.classList.remove('open');
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    const form = e.target;

    // Clear previous errors
    form.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('input-error'));

    const fields = {
      animalId: document.getElementById('new-animal-id')?.value.trim().toUpperCase(),
      species:  document.getElementById('new-species')?.value,
      breed:    document.getElementById('new-breed')?.value.trim(),
      tagId:    document.getElementById('new-tag-id')?.value.trim(),
      age:      parseFloat(document.getElementById('new-age')?.value),
      weight:   parseFloat(document.getElementById('new-weight')?.value),
      status:   document.getElementById('new-status')?.value,
      dob:      document.getElementById('new-dob')?.value  || null,
      owner:    document.getElementById('new-owner')?.value.trim() || null,
    };

    // Validation
    let hasError = false;
    const markError = (inputId, errId) => {
      const inp = document.getElementById(inputId);
      const err = document.getElementById(errId);
      if (inp) inp.classList.add('input-error');
      if (err) err.classList.add('visible');
      hasError = true;
    };

    if (!fields.animalId) markError('new-animal-id', 'err-animal-id');
    if (!fields.species)  markError('new-species', 'err-species');
    if (!fields.breed)    markError('new-breed', 'err-breed');
    if (!fields.tagId)    markError('new-tag-id', 'err-tag-id');
    if (isNaN(fields.age) || fields.age < 0)    markError('new-age', 'err-age');
    if (isNaN(fields.weight) || fields.weight < 1) markError('new-weight', 'err-weight');
    if (!fields.status)   markError('new-status', 'err-status');

    // Duplicate ID check
    const state = getState();
    if (state && fields.animalId && state.animals.some(a => a.animalId === fields.animalId)) {
      const err = document.getElementById('err-animal-id');
      const inp = document.getElementById('new-animal-id');
      if (err) { err.textContent = 'This Animal ID already exists.'; err.classList.add('visible'); }
      if (inp) inp.classList.add('input-error');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = document.getElementById('submit-add-animal');
    const originalHtml = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

      // Add emoji based on species
      const emojiMap = { Cow: '🐄', Buffalo: '🐃', Goat: '🐐', Sheep: '🐑' };
      fields.emoji = emojiMap[fields.species] || '🐄';

      await window.FirestoreStore.addAnimal(fields);

      closeAddModal();
      if (window.showToast) window.showToast(`✓ ${fields.species} #${fields.animalId} added successfully!`);

    } catch (err) {
      console.error('HerdModule: Add animal failed', err);
      if (window.showToast) window.showToast('Failed to add animal. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }

  // ── Public API ────────────────────────────────────────────
  return { init, openDetailModal };

})();

window.HerdModule = HerdModule;
