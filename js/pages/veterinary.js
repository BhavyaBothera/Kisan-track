// ============================================
// KisanTrack — veterinary.js
// Purpose: Veterinary Log & Vaccine Schedule
// Page: veterinary.html
// Dependencies: Firebase, FirestoreStore
// Last Updated: 2026-05-17
// ============================================
var VeterinaryModule = (function () {
    'use strict';

    const COLLECTION = 'vet_logs';

    let medicalLogs = [];
    let animals     = [];
    let currentAnimalFilter = 'all';
    let currentTypeFilter   = 'all';

    // ── Helpers ───────────────────────────────────────────────
    function uid() { return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null; }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            // Handle both Firestore Timestamps and ISO strings
            const d = (typeof dateStr.toDate === 'function') ? dateStr.toDate() : new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return String(dateStr); }
    }

    function getIcon(type) {
        switch (type) {
            case 'Vaccination': return 'fa-syringe';
            case 'Emergency':   return 'fa-kit-medical';
            case 'Checkup':     return 'fa-stethoscope';
            default:            return 'fa-notes-medical';
        }
    }

    // ── Init ─────────────────────────────────────────────────
    async function init() {
        bindUIEvents();
        renderTimeline([]);    // clear "Loading logs..." immediately
        renderSchedule([]);    // clear empty schedule immediately

        // Wait for auth/state before fetching
        document.addEventListener('kisanTrack:stateUpdated', onStateReady, { once: true });
    }

    function onStateReady() {
        // Pull animals list from FirestoreStore (already loaded)
        const state = window.FirestoreStore ? window.FirestoreStore.getState() : null;
        if (state && state.animals.length > 0) {
            animals = state.animals.map(a => ({ id: a.id, animalId: a.animalId, name: a.name || a.animalId }));
        }
        populateFilters();
        loadLogs();
    }

    // ── Firestore: Load logs ──────────────────────────────────
    async function loadLogs() {
        if (!uid()) return;

        // Show loading state
        const timeline = document.getElementById('vet-timeline');
        if (timeline) {
            timeline.innerHTML = `
                <div style="text-align:center;padding:40px;color:var(--text-dim);">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.5rem;margin-bottom:12px;display:block;"></i>
                    Loading records...
                </div>`;
        }

        try {
            const snap = await db.collection(COLLECTION)
                .where('farmerId', '==', uid())
                .orderBy('date', 'desc')
                .get();

            if (snap.empty) {
                // Seed 3 sample entries on first visit so page isn't blank
                await seedSampleLogs();
            } else {
                medicalLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        } catch (e) {
            console.warn('VeterinaryModule: load error (index building?):', e.message);
            // Try without orderBy as fallback
            try {
                const snap2 = await db.collection(COLLECTION).where('farmerId', '==', uid()).get();
                medicalLogs = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e2) {
                medicalLogs = [];
            }
        }

        renderTimeline();
        renderSchedule();
        updateKPIs();
    }

    async function seedSampleLogs() {
        const today  = new Date().toISOString().split('T')[0];
        const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

        const samples = [
            { date: daysAgo(7),  type: 'Vaccination', diagnosis: 'FMD Prevention',    treatment: 'Foot and Mouth Disease Vaccine (2ml)', vet: 'Dr. Ramesh', cost: 450,  animalId: animals[0]?.animalId || 'C001' },
            { date: daysAgo(12), type: 'Checkup',     diagnosis: 'Routine health scan', treatment: 'Vitamins administered, general health OK', vet: 'Dr. Sharma', cost: 300, animalId: animals[1]?.animalId || 'B001' },
            { date: daysAgo(20), type: 'Treatment',   diagnosis: 'Limping left leg',  treatment: 'Anti-inflammatory injection, rest prescribed', vet: 'Dr. Ramesh', cost: 1200, animalId: animals[2]?.animalId || 'G001' },
        ];

        const batch = db.batch();
        medicalLogs = [];
        samples.forEach(s => {
            const ref = db.collection(COLLECTION).doc();
            const doc = { ...s, farmerId: uid() };
            batch.set(ref, doc);
            medicalLogs.push({ id: ref.id, ...doc });
        });
        await batch.commit().catch(e => console.warn('seed failed:', e.message));
    }

    // ── Firestore: Save log ───────────────────────────────────
    async function saveLog(logData) {
        const ref = await db.collection(COLLECTION).add({ ...logData, farmerId: uid() });
        return ref.id;
    }

    // ── UI: Populate filters ──────────────────────────────────
    function populateFilters() {
        const animalSel = document.getElementById('filter-animal');
        const formSel   = document.getElementById('form-animal-id');

        const opts = animals.map(a => `<option value="${a.animalId}">${a.animalId}${a.name && a.name !== a.animalId ? ' — ' + a.name : ''}</option>`).join('');
        if (animalSel) animalSel.innerHTML = '<option value="all">All Animals</option>' + opts;
        if (formSel)   formSel.innerHTML   = '<option value="">Select Animal / पशु चुनें</option>' + opts;
    }

    // ── UI: Render timeline ───────────────────────────────────
    function renderTimeline(src) {
        const container = document.getElementById('vet-timeline');
        if (!container) return;

        const logs = src !== undefined ? src : medicalLogs;
        const filtered = logs.filter(log => {
            const matchAnimal = currentAnimalFilter === 'all' || log.animalId === currentAnimalFilter;
            const matchType   = currentTypeFilter   === 'all' || log.type === currentTypeFilter;
            return matchAnimal && matchType;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:48px;color:var(--text-dim);">
                    <div style="font-size:2.5rem;margin-bottom:12px;">🏥</div>
                    <p>${logs.length === 0
                        ? 'No medical records yet. Click <strong>Log Visit</strong> to add one.'
                        : 'No records match the selected filters.'
                    }</p>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(log => `
            <div class="timeline-item ${log.type}">
                <div class="timeline-dot">
                    <i class="fa-solid ${getIcon(log.type)}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-date">${formatDate(log.date)}</span>
                        <span class="timeline-badge badge-${(log.type || '').toLowerCase()}">${log.type || 'Visit'}</span>
                    </div>
                    <div class="timeline-title">${log.diagnosis || '—'}</div>
                    <div class="timeline-animal">Animal: <strong>${log.animalId || '—'}</strong></div>
                    <div class="timeline-desc">${log.treatment || ''}</div>
                    <div class="timeline-footer">
                        <span><i class="fa-solid fa-user-doctor"></i> ${log.vet || 'N/A'}</span>
                        <span><i class="fa-solid fa-indian-rupee-sign"></i> ${log.cost || 0}</span>
                    </div>
                </div>
            </div>`).join('');
    }

    // ── UI: Vaccine schedule ──────────────────────────────────
    function renderSchedule(src) {
        const container = document.getElementById('vaccine-schedule');
        if (!container) return;

        // Derive upcoming vaccinations from logs (next 60 days) or show defaults
        const logs = src !== undefined ? src : medicalLogs;
        const today = new Date();
        const upcoming = [];

        // Check for vaccinations logged with a future date (scheduled visits)
        logs.forEach(log => {
            if (log.type === 'Vaccination' && log.nextDueDate) {
                const due = new Date(log.nextDueDate);
                const daysUntil = Math.ceil((due - today) / 86400000);
                if (daysUntil >= 0 && daysUntil <= 60) {
                    upcoming.push({ daysUntil, due, title: log.diagnosis || 'Vaccination', animal: log.animalId });
                }
            }
        });

        // If no scheduled future logs, show sensible defaults
        if (upcoming.length === 0) {
            const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
            const defaults = [
                { due: addDays(8),  title: 'Anthrax Booster',   animal: 'Herd-Wide' },
                { due: addDays(15), title: 'FMD Vaccination',   animal: animals[0]?.animalId || 'C001' },
                { due: addDays(28), title: 'Deworming',         animal: 'All Goats / Sheep' },
            ];
            defaults.forEach(d => upcoming.push({ ...d, daysUntil: Math.ceil((d.due - today) / 86400000) }));
        }

        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

        container.innerHTML = upcoming.map(s => {
            const urgency = s.daysUntil <= 3 ? 'var(--accent-red)' : s.daysUntil <= 10 ? 'var(--accent-amber)' : 'var(--accent-green)';
            return `
                <div class="schedule-item">
                    <div class="schedule-date" style="color:${urgency};">
                        <span class="sch-day">${s.due.getDate()}</span>
                        <span class="sch-month">${s.due.toLocaleDateString([], { month: 'short' })}</span>
                    </div>
                    <div class="schedule-info">
                        <div class="sch-title">${s.title}</div>
                        <div class="sch-animal">${s.animal}</div>
                    </div>
                    <div class="sch-badge" style="font-size:0.65rem;padding:2px 7px;border-radius:10px;background:${urgency}18;color:${urgency};white-space:nowrap;">
                        ${s.daysUntil === 0 ? 'Today' : s.daysUntil === 1 ? 'Tomorrow' : 'In ' + s.daysUntil + 'd'}
                    </div>
                </div>`;
        }).join('');
    }

    // ── UI: KPIs ─────────────────────────────────────────────
    function updateKPIs() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        set('stat-total-visits',  medicalLogs.length);
        set('stat-total-vaccines', medicalLogs.filter(l => l.type === 'Vaccination').length);

        // Count upcoming = logs with a future nextDueDate field
        const today = new Date();
        const upcomingCount = medicalLogs.filter(l => {
            if (!l.nextDueDate) return false;
            return new Date(l.nextDueDate) >= today;
        }).length;
        set('stat-upcoming', upcomingCount || 0);
    }

    // ── UI: Bind events ───────────────────────────────────────
    function bindUIEvents() {
        const animalFilter = document.getElementById('filter-animal');
        const typeFilter   = document.getElementById('filter-type');
        if (animalFilter) animalFilter.addEventListener('change', e => { currentAnimalFilter = e.target.value; renderTimeline(); });
        if (typeFilter)   typeFilter.addEventListener('change',   e => { currentTypeFilter   = e.target.value; renderTimeline(); });

        const addLogBtn    = document.getElementById('btn-add-log');
        const closeModalBtn= document.getElementById('modal-close-btn');
        const form         = document.getElementById('vet-log-form');
        if (addLogBtn)     addLogBtn.addEventListener('click', () => openModal('Log Veterinary Visit / विजिट दर्ज करें'));
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (form)          form.addEventListener('submit', handleFormSubmit);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const logData = {
            date:      new Date().toISOString().split('T')[0],
            animalId:  document.getElementById('form-animal-id')?.value   || '',
            type:      document.getElementById('form-event-type')?.value  || 'Checkup',
            diagnosis: document.getElementById('form-diagnosis')?.value   || '',
            treatment: document.getElementById('form-treatment')?.value   || '',
            vet:       document.getElementById('form-vet-name')?.value    || 'N/A',
            cost:      parseInt(document.getElementById('form-cost')?.value) || 0,
        };

        try {
            const id = await saveLog(logData);
            medicalLogs.unshift({ id, ...logData });
            renderTimeline();
            updateKPIs();
            closeModal();
            if (window.showToast) window.showToast('✓ Medical record saved successfully!');
        } catch (err) {
            console.error('handleFormSubmit:', err);
            if (window.showToast) window.showToast('Failed to save. Please try again.', 'error');
        }
    }

    function openModal(title) {
        const modal = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        if (modal) modal.classList.add('open');
        if (titleEl) titleEl.textContent = title;
    }

    function closeModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.classList.remove('open');
        const form = document.getElementById('vet-log-form');
        if (form) form.reset();
    }

    return { init, closeModal };
})();
