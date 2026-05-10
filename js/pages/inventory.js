const InventoryModule = (function () {
    'use strict';

    let inventoryItems = [];
    let transactions = [];
    let currentFilter = 'all';
    let searchQuery = '';

    /**
     * Initialize Data & Listeners
     */
    async function init() {
        // Load initial mock data
        inventoryItems = [
            { id: 'F01', name: 'Alfalfa Hay', nameHi: 'अल्फल्फा घास', category: 'Feed', current: 1200, total: 2000, unit: 'kg', lastRefill: '2026-05-01', status: 'in-stock' },
            { id: 'F02', name: 'Grain Mix', nameHi: 'अनाज का मिश्रण', category: 'Feed', current: 350, total: 1500, unit: 'kg', lastRefill: '2026-04-28', status: 'low' },
            { id: 'M01', name: 'Vitamin B12', nameHi: 'विटामिन बी12', category: 'Medicine', current: 45, total: 50, unit: 'vials', lastRefill: '2026-05-05', status: 'in-stock', expiry: '2026-06-15' },
            { id: 'M02', name: 'Antibiotics', nameHi: 'एंटीबायोटिक्स', category: 'Medicine', current: 2, total: 20, unit: 'packs', lastRefill: '2026-04-15', status: 'critical', expiry: '2026-05-20' },
            { id: 'T01', name: 'Ear Tags', nameHi: 'कान के टैग', category: 'Supplies', current: 85, total: 100, unit: 'units', lastRefill: '2026-05-08', status: 'in-stock' }
        ];

        renderInventory();
        initConsumptionChart();
        updateKPIs();

        // Search listener
        const searchInput = document.getElementById('inventory-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();
                renderInventory();
            });
        }

        // Filter listeners
        const filterBtns = document.querySelectorAll('#inventory-filter-bar .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderInventory();
            });
        });

        // Form Submission
        const form = document.getElementById('inventory-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        // Modal Listeners
        const addItemBtn = document.getElementById('btn-add-item');
        const closeModalBtn = document.getElementById('modal-close-btn');
        if (addItemBtn) addItemBtn.addEventListener('click', () => {
            resetForm();
            openModal('Add New Item / नया आइटम जोड़ें');
        });
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    }

    /**
     * Handle Form Submission (Add or Update)
     */
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('form-item-id').value;
        const name = document.getElementById('form-item-name').value;
        const nameHi = document.getElementById('form-item-name-hi').value;
        const category = document.getElementById('form-item-category').value;
        const unit = document.getElementById('form-item-unit').value;
        const current = parseInt(document.getElementById('form-item-current').value);
        const total = parseInt(document.getElementById('form-item-total').value);

        const pct = (current / total) * 100;
        const status = pct < 10 ? 'critical' : (pct < 25 ? 'low' : 'in-stock');

        if (id) {
            // Update existing
            const item = inventoryItems.find(i => i.id === id);
            if (item) {
                const diff = current - item.current;
                Object.assign(item, { name, nameHi, category, unit, current, total, status });
                if (diff !== 0) logTransaction(item, diff);
                if (window.showToast) window.showToast(`Updated ${name} successfully!`, 'success');
            }
        } else {
            // Add new
            const newItem = {
                id: 'NEW-' + Date.now(),
                name, nameHi, category, unit, current, total, status,
                lastRefill: new Date().toISOString().split('T')[0]
            };
            inventoryItems.push(newItem);
            logTransaction(newItem, current);
            if (window.showToast) window.showToast(`Added ${name} to inventory!`, 'success');
        }

        closeModal();
        renderInventory();
        updateKPIs();
    }

    function resetForm() {
        const form = document.getElementById('inventory-form');
        if (form) form.reset();
        document.getElementById('form-item-id').value = '';
    }

    function editItem(id) {
        const item = inventoryItems.find(i => i.id === id);
        if (!item) return;

        document.getElementById('form-item-id').value = item.id;
        document.getElementById('form-item-name').value = item.name;
        document.getElementById('form-item-name-hi').value = item.nameHi;
        document.getElementById('form-item-category').value = item.category;
        document.getElementById('form-item-unit').value = item.unit;
        document.getElementById('form-item-current').value = item.current;
        document.getElementById('form-item-total').value = item.total;

        openModal('Edit Item / आइटम संपादित करें');
    }

    /**
     * Render inventory based on filter and search
     */
    function renderInventory() {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;

        const filtered = inventoryItems.filter(item => {
            const matchesFilter = currentFilter === 'all' || item.category === currentFilter;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery) || 
                                 item.nameHi.includes(searchQuery) ||
                                 item.id.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        grid.innerHTML = filtered.map(item => createInventoryCard(item)).join('');
    }

    /**
     * Create HTML for an Inventory Card
     */
    function createInventoryCard(item) {
        const pct = (item.current / item.total) * 100;
        const statusClass = item.status === 'critical' ? 'critical-stock' : (item.status === 'low' ? 'low-stock' : '');
        const chipClass = item.status === 'critical' ? 'chip-out' : (item.status === 'low' ? 'chip-low' : 'chip-in-stock');
        const statusLabel = item.status === 'critical' ? 'Critical' : (item.status === 'low' ? 'Low Stock' : 'In Stock');

        // Expiry logic
        let expiryTag = '';
        if (item.expiry) {
            const daysLeft = Math.ceil((new Date(item.expiry) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft < 15) expiryTag = `<span class="expiry-tag expiry-danger">Expiring in ${daysLeft}d</span>`;
            else if (daysLeft < 45) expiryTag = `<span class="expiry-tag expiry-warning">Expires: ${item.expiry}</span>`;
        }

        return `
            <div class="inventory-card ${statusClass}">
                <div class="inventory-card-header">
                    <div class="inventory-icon">
                        <i class="fa-solid ${getIcon(item.category)}"></i>
                    </div>
                    <div style="text-align: right;">
                        <span class="status-chip ${chipClass}">${statusLabel}</span>
                        <br>${expiryTag}
                    </div>
                </div>
                <div class="inventory-category">${item.category}</div>
                <div class="inventory-name">${item.name}</div>
                <div class="inventory-name-hi">${item.nameHi}</div>
                
                <div class="stock-meter-wrap">
                    <div class="stock-label">
                        <span class="stock-current">${item.current} ${item.unit}</span>
                        <span class="stock-total">of ${item.total}</span>
                    </div>
                    <div class="stock-progress-bg">
                        <div class="stock-progress-fill" style="width: ${pct}%"></div>
                    </div>
                </div>

                <div class="quick-actions">
                    <button class="action-btn minus" onclick="InventoryModule.quickUpdate('${item.id}', -10)">-10</button>
                    <button class="action-btn minus" onclick="InventoryModule.quickUpdate('${item.id}', -1)">-1</button>
                    <button class="action-btn plus" onclick="InventoryModule.quickUpdate('${item.id}', 1)">+1</button>
                    <button class="action-btn plus" onclick="InventoryModule.quickUpdate('${item.id}', 50)">+50</button>
                </div>
                
                <div class="inventory-card-footer" style="margin-top:16px;">
                    <div class="last-refill">Last Refill: ${item.lastRefill}</div>
                    <button class="btn btn-secondary btn-sm" onclick="InventoryModule.editItem('${item.id}')">Edit</button>
                </div>
            </div>
        `;
    }

    /**
     * Quick Stock Update
     */
    function quickUpdate(id, amount) {
        const item = inventoryItems.find(i => i.id === id);
        if (!item) return;

        const oldVal = item.current;
        item.current = Math.min(item.total, Math.max(0, item.current + amount));
        
        if (item.current !== oldVal) {
            // Update status
            const pct = (item.current / item.total) * 100;
            item.status = pct < 10 ? 'critical' : (pct < 25 ? 'low' : 'in-stock');
            
            logTransaction(item, item.current - oldVal);
            renderInventory();
            updateKPIs();
            if (window.showToast) window.showToast(`Updated ${item.name}: ${amount > 0 ? '+' : ''}${amount} ${item.unit}`, amount > 0 ? 'success' : 'warning');
        }
    }

    /**
     * Log Activity
     */
    function logTransaction(item, diff) {
        const trans = {
            id: Date.now(),
            itemName: item.name,
            diff: diff,
            unit: item.unit,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: diff > 0 ? 'up' : 'down'
        };
        transactions.unshift(trans);
        if (transactions.length > 5) transactions.pop();
        renderTransactions();
    }

    function renderTransactions() {
        const log = document.getElementById('transaction-log');
        if (!log) return;

        if (transactions.length === 0) {
            log.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        log.innerHTML = transactions.map(t => `
            <div class="transaction-item">
                <div class="trans-icon ${t.type}">
                    <i class="fa-solid fa-arrow-${t.type === 'up' ? 'up' : 'down'}"></i>
                </div>
                <div class="trans-info">
                    <div class="trans-title">${t.itemName}</div>
                    <div class="trans-time">${t.time}</div>
                </div>
                <div class="trans-amt" style="color: var(--accent-${t.type === 'up' ? 'green' : 'red'})">
                    ${t.diff > 0 ? '+' : ''}${t.diff} ${t.unit}
                </div>
            </div>
        `).join('');
    }

    function updateKPIs() {
        const totalEl = document.getElementById('stat-total-items');
        const lowEl = document.getElementById('stat-low-stock');
        if (totalEl) totalEl.textContent = inventoryItems.length;
        if (lowEl) lowEl.textContent = inventoryItems.filter(i => i.status === 'low' || i.status === 'critical').length;
    }

    function getIcon(category) {
        switch(category) {
            case 'Feed': return 'fa-wheat-awn';
            case 'Medicine': return 'fa-pills';
            default: return 'fa-box-open';
        }
    }

    function initConsumptionChart() {
        const ctx = document.getElementById('consumptionChart');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Feed Usage (kg)',
                    data: [145, 152, 148, 160, 155, 158, 162],
                    borderColor: '#7CB518',
                    backgroundColor: 'rgba(124, 181, 24, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
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

    function editItem(id) {
        openModal('Edit Item / आइटम संपादित करें');
    }

    return { init, quickUpdate, editItem, closeModal };
})();
