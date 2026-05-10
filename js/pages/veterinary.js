var VeterinaryModule = (function () {
    'use strict';

    let medicalLogs = [];
    let animals = [];
    let currentAnimalFilter = 'all';
    let currentTypeFilter = 'all';

    /**
     * Initialize Data & Listeners
     */
    async function init() {
        // Mock Data
        animals = [
            { id: 'C001', name: 'Ganga' },
            { id: 'C002', name: 'Jamuna' },
            { id: 'B001', name: 'Shera' },
            { id: 'G001', name: 'Lali' }
        ];

        medicalLogs = [
            { 
                id: 1, 
                date: '2026-05-08', 
                animalId: 'C001', 
                type: 'Vaccination', 
                diagnosis: 'FMD Prevention', 
                treatment: 'Foot and Mouth Disease Vaccine (2ml)', 
                vet: 'Dr. Ramesh', 
                cost: 450 
            },
            { 
                id: 2, 
                date: '2026-05-05', 
                animalId: 'B001', 
                type: 'Checkup', 
                diagnosis: 'Routine health scan', 
                treatment: 'Vitamins administered, general health OK', 
                vet: 'Dr. Sharma', 
                cost: 300 
            },
            { 
                id: 3, 
                date: '2026-05-01', 
                animalId: 'G001', 
                type: 'Emergency', 
                diagnosis: 'Limping left leg', 
                treatment: 'Anti-inflammatory injection, rest prescribed', 
                vet: 'Dr. Ramesh', 
                cost: 1200 
            }
        ];

        populateFilters();
        renderTimeline();
        renderSchedule();

        // Listeners
        const animalFilter = document.getElementById('filter-animal');
        const typeFilter = document.getElementById('filter-type');
        
        if (animalFilter) {
            animalFilter.addEventListener('change', (e) => {
                currentAnimalFilter = e.target.value;
                renderTimeline();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                currentTypeFilter = e.target.value;
                renderTimeline();
            });
        }

        const addLogBtn = document.getElementById('btn-add-log');
        const closeModalBtn = document.getElementById('modal-close-btn');
        const form = document.getElementById('vet-log-form');

        if (addLogBtn) addLogBtn.addEventListener('click', () => openModal('Log Veterinary Visit'));
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (form) form.addEventListener('submit', handleFormSubmit);
    }

    function populateFilters() {
        const animalSelect = document.getElementById('filter-animal');
        const formAnimalSelect = document.getElementById('form-animal-id');
        if (!animalSelect || !formAnimalSelect) return;

        const options = animals.map(a => `<option value="${a.id}">${a.id} - ${a.name}</option>`).join('');
        animalSelect.innerHTML = '<option value="all">All Animals</option>' + options;
        formAnimalSelect.innerHTML = '<option value="">Select Animal</option>' + options;
    }

    function renderTimeline() {
        const container = document.getElementById('vet-timeline');
        if (!container) return;

        const filtered = medicalLogs.filter(log => {
            const matchesAnimal = currentAnimalFilter === 'all' || log.animalId === currentAnimalFilter;
            const matchesType = currentTypeFilter === 'all' || log.type === currentTypeFilter;
            return matchesAnimal && matchesType;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No medical records found for selected filters.</div>';
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
                        <span class="timeline-badge badge-${log.type.toLowerCase()}">${log.type}</span>
                    </div>
                    <div class="timeline-title">${log.diagnosis}</div>
                    <div class="timeline-animal">Animal: ${log.animalId}</div>
                    <div class="timeline-desc">${log.treatment}</div>
                    <div class="timeline-footer">
                        <span><i class="fa-solid fa-user-md"></i> ${log.vet}</span>
                        <span><i class="fa-solid fa-indian-rupee-sign"></i> ${log.cost}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderSchedule() {
        const container = document.getElementById('vaccine-schedule');
        if (!container) return;

        const schedule = [
            { day: '15', month: 'May', title: 'Anthrax Booster', animal: 'Herd-Wide' },
            { day: '22', month: 'May', title: 'Rabies Shot', animal: 'B002, B004' },
            { day: '05', month: 'Jun', title: 'Deworming', animal: 'All Goats' }
        ];

        container.innerHTML = schedule.map(s => `
            <div class="schedule-item">
                <div class="schedule-date">
                    <span class="sch-day">${s.day}</span>
                    <span class="sch-month">${s.month}</span>
                </div>
                <div class="schedule-info">
                    <div class="sch-title">${s.title}</div>
                    <div class="sch-animal">${s.animal}</div>
                </div>
                <div class="sch-status status-due"></div>
            </div>
        `).join('');
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const newLog = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            animalId: document.getElementById('form-animal-id').value,
            type: document.getElementById('form-event-type').value,
            diagnosis: document.getElementById('form-diagnosis').value,
            treatment: document.getElementById('form-treatment').value,
            vet: document.getElementById('form-vet-name').value || 'N/A',
            cost: parseInt(document.getElementById('form-cost').value) || 0
        };

        medicalLogs.unshift(newLog);
        renderTimeline();
        updateKPIs();
        closeModal();
        if (window.showToast) window.showToast('Medical record saved successfully!', 'success');
    }

    function updateKPIs() {
        const visitsEl = document.getElementById('stat-total-visits');
        if (visitsEl) visitsEl.textContent = medicalLogs.length;
    }

    function openModal(title) {
        const modal = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        if (modal && modalTitle) {
            modalTitle.textContent = title;
            modal.classList.add('open');
        }
    }

    function closeModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.classList.remove('open');
    }

    function getIcon(type) {
        switch(type) {
            case 'Vaccination': return 'fa-syringe';
            case 'Emergency': return 'fa-kit-medical';
            case 'Checkup': return 'fa-stethoscope';
            default: return 'fa-notes-medical';
        }
    }

    function formatDate(dateStr) {
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return new Date(dateStr).toLocaleDateString('en-IN', options);
    }

    return { init, closeModal };
})();
