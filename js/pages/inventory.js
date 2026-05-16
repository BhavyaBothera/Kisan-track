// ============================================
// KisanTrack — inventory.js
// Purpose: Inventory & Feed Management
// Page: inventory.html
// Dependencies: Firebase, FirestoreStore, Chart.js
// Last Updated: 2026-05-17
// ============================================
var InventoryModule = (function () {
    'use strict';

    const COLLECTION = 'inventory';
    const ACTIVITY_COLLECTION = 'inventoryActivity';
    const MAX_ACTIVITY = 10;

    // Default seed items shown when a farmer has no inventory yet
    const SEED_ITEMS = [
        { name: 'Alfalfa Hay', nameHi: 'अल्फल्फा घास', category: 'Feed', current: 1200, total: 2000, unit: 'kg', costPerUnit: 12, lastRefill: today() },
        { name: 'Grain Mix',   nameHi: 'अनाज का मिश्रण', category: 'Feed', current: 350,  total: 1500, unit: 'kg', costPerUnit: 18, lastRefill: today() },
        { name: 'Vitamin B12', nameHi: 'विटामिन बी12',   category: 'Medicine', current: 45, total: 50, unit: 'vials', costPerUnit: 90, lastRefill: today(), expiry: nextDate(45) },
        { name: 'Antibiotics', nameHi: 'एंटीबायोटिक्स', category: 'Medicine', current: 5,  total: 20, unit: 'packs', costPerUnit: 250, lastRefill: today(), expiry: nextDate(60) },
        { name: 'Ear Tags',    nameHi: 'कान के टैग',    category: 'Supplies', current: 85, total: 100, unit: 'units', costPerUnit: 8, lastRefill: today() },
    ];

    let inventoryItems = [];
    let activityLog    = [];
    let currentFilter  = 'all';
    let searchQuery    = '';
    let consumChart    = null;

    // ── Helpers ───────────────────────────────────────────────
    function today() { return new Date().toISOString().split('T')[0]; }
    function nextDate(days) {
        const d = new Date(); d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }
    function uid() { return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null; }
    function calcStatus(current, total) {
        const pct = (current / total) * 100;
        return pct < 10 ? 'critical' : pct < 25 ? 'low' : 'in-stock';
    }

    // ── Init ─────────────────────────────────────────────────
    async function init() {
        bindUIEvents();
        renderTransactions([]);   // show "no activity" immediately
        renderInventoryGrid([]);  // show empty grid immediately
        updateKPIs([]);           // show 0/0 immediately instead of --

        // Wait for auth then load data
        document.addEventListener('kisanTrack:stateUpdated', loadAll, { once: true });
    }

    async function loadAll() {
        if (!uid()) return;
        try {
            await Promise.all([loadInventory(), loadActivity()]);
        } catch (e) {
            console.error('InventoryModule: load error', e);
        }
    }

    // ── Firestore: Load inventory ────────────────────────────
    async function loadInventory() {
        const snap = await db.collection(COLLECTION)
            .where('farmerId', '==', uid())
            .get();

        if (snap.empty) {
            // Seed default items on first visit
            await seedDefaultItems();
        } else {
            inventoryItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        renderInventoryGrid();
        updateKPIs();
        renderConsumptionChart();
    }

    async function seedDefaultItems() {
        const batch = db.batch();
        inventoryItems = [];
        SEED_ITEMS.forEach(item => {
            const ref = db.collection(COLLECTION).doc();
            const doc = { ...item, farmerId: uid(), status: calcStatus(item.current, item.total) };
            batch.set(ref, doc);
            inventoryItems.push({ id: ref.id, ...doc });
        });
        await batch.commit();
    }

    // ── Firestore: Load activity log ─────────────────────────
    async function loadActivity() {
        try {
            const snap = await db.collection(ACTIVITY_COLLECTION)
                .where('farmerId', '==', uid())
                .orderBy('timestamp', 'desc')
                .limit(MAX_ACTIVITY)
                .get();
            activityLog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderTransactions();
        } catch (e) {
            // Index may still be building — show empty state, not an error
            console.warn('InventoryModule: activity log unavailable:', e.message);
            renderTransactions([]);
        }
    }

    // ── Firestore: Save item ──────────────────────────────────
    async function saveItem(item) {
        const { id, ...data } = item;
        data.farmerId = uid();
        data.status   = calcStatus(data.current, data.total);
        if (id && !id.startsWith('__new')) {
            await db.collection(COLLECTION).doc(id).set(data, { merge: true });
        } else {
            const ref = await db.collection(COLLECTION).add(data);
            item.id = ref.id;
        }
    }

    // ── Firestore: Log activity ───────────────────────────────
    async function logActivity(item, diff) {
        try {
            const entry = {
                farmerId: uid(),
                itemName: item.name,
                diff,
                unit: item.unit,
                type: diff > 0 ? 'up' : 'down',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection(ACTIVITY_COLLECTION).add(entry);
            // Prepend optimistically to local log
            activityLog.unshift({ ...entry, timestamp: { toDate: () => new Date() } });
            if (activityLog.length > MAX_ACTIVITY) activityLog.pop();
            renderTransactions();
        } catch (e) {
            console.warn('InventoryModule: could not log activity', e.message);
        }
    }

    // ── UI: Bind events ──────────────────────────────────────
    function bindUIEvents() {
        // Filter bar
        document.querySelectorAll('#inventory-filter-bar .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#inventory-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderInventoryGrid();
            });
        });
        // Set active on 'all' by default
        const allBtn = document.querySelector('#inventory-filter-bar .filter-btn[data-filter="all"]');
        if (allBtn) allBtn.classList.add('active');

        // Search
        const search = document.getElementById('inventory-search');
        if (search) {
            let timer;
            search.addEventListener('input', e => {
                clearTimeout(timer);
                timer = setTimeout(() => { searchQuery = e.target.value.toLowerCase(); renderInventoryGrid(); }, 200);
            });
        }

        // Modal open / close
        document.addEventListener('click', e => {
            if (e.target.closest('#btn-add-item'))    { resetForm(); openModal('Add New Item / नया आइटम जोड़ें'); }
            if (e.target.closest('#modal-close-btn')) closeModal();
        });

        // Form submit
        const form = document.getElementById('inventory-form');
        if (form) form.addEventListener('submit', handleFormSubmit);
    }

    // ── UI: Render grid ──────────────────────────────────────
    function renderInventoryGrid(items) {
        const grid = document.getElementById('inventory-grid');
        if (!grid) return;

        const src = items !== undefined ? items : inventoryItems;
        const filtered = src.filter(item => {
            const matchFilter = currentFilter === 'all' || item.category === currentFilter;
            const matchSearch = !searchQuery
                || (item.name   || '').toLowerCase().includes(searchQuery)
                || (item.nameHi || '').includes(searchQuery)
                || (item.id     || '').toLowerCase().includes(searchQuery);
            return matchFilter && matchSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;padding:48px;text-align:center;color:var(--text-dim);">
                    <div style="font-size:2.5rem;margin-bottom:12px;">📦</div>
                    <p>${src.length === 0 ? 'No inventory items yet. Click <strong>Add Item</strong> to begin.' : 'No items match this filter.'}</p>
                </div>`;
            return;
        }

        grid.innerHTML = filtered.map(item => createCard(item)).join('');
    }

    function createCard(item) {
        const pct = Math.round(Math.min(100, (item.current / item.total) * 100));
        const statusClass = item.status === 'critical' ? 'critical-stock' : item.status === 'low' ? 'low-stock' : '';
        const chipClass   = item.status === 'critical' ? 'chip-out'       : item.status === 'low' ? 'chip-low'  : 'chip-in-stock';
        const statusLabel = item.status === 'critical' ? 'Critical'        : item.status === 'low' ? 'Low Stock' : 'In Stock';

        let expiryTag = '';
        if (item.expiry) {
            const daysLeft = Math.ceil((new Date(item.expiry) - new Date()) / 86400000);
            if (daysLeft < 15) expiryTag = `<span class="expiry-tag expiry-danger">Expiring in ${daysLeft}d</span>`;
            else if (daysLeft < 45) expiryTag = `<span class="expiry-tag expiry-warning">Expires: ${item.expiry}</span>`;
        }

        return `
            <div class="inventory-card ${statusClass}">
                <div class="inventory-card-header">
                    <div class="inventory-icon"><i class="fa-solid ${getIcon(item.category)}"></i></div>
                    <div style="text-align:right;">
                        <span class="status-chip ${chipClass}">${statusLabel}</span><br>${expiryTag}
                    </div>
                </div>
                <div class="inventory-category">${item.category}</div>
                <div class="inventory-name">${item.name}</div>
                <div class="inventory-name-hi">${item.nameHi || ''}</div>
                <div class="stock-meter-wrap">
                    <div class="stock-label">
                        <span class="stock-current">${item.current} ${item.unit}</span>
                        <span class="stock-total">of ${item.total}</span>
                    </div>
                    <div class="stock-progress-bg">
                        <div class="stock-progress-fill" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="quick-actions">
                    <button class="action-btn minus" onclick="InventoryModule.quickUpdate('${item.id}',-10)">-10</button>
                    <button class="action-btn minus" onclick="InventoryModule.quickUpdate('${item.id}',-1)">-1</button>
                    <button class="action-btn plus"  onclick="InventoryModule.quickUpdate('${item.id}',1)">+1</button>
                    <button class="action-btn plus"  onclick="InventoryModule.quickUpdate('${item.id}',50)">+50</button>
                </div>
                <div class="inventory-card-footer" style="margin-top:16px;">
                    <div class="last-refill">Last Refill: ${item.lastRefill || '—'}</div>
                    <button class="btn btn-secondary btn-sm" onclick="InventoryModule.editItem('${item.id}')">Edit</button>
                </div>
            </div>`;
    }

    // ── UI: KPIs ─────────────────────────────────────────────
    function updateKPIs(items) {
        const src = items !== undefined ? items : inventoryItems;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        set('stat-total-items', src.length);
        set('stat-low-stock',   src.filter(i => i.status === 'low' || i.status === 'critical').length);

        // Monthly cost = sum(current * costPerUnit) for all items
        const monthlyCost = src.reduce((sum, i) => {
            const cpu = parseFloat(i.costPerUnit) || 0;
            return sum + (i.current * cpu);
        }, 0);
        const costEl = document.getElementById('stat-monthly-cost');
        if (costEl) {
            costEl.textContent = monthlyCost > 0
                ? '\u20b9 ' + Math.round(monthlyCost).toLocaleString('en-IN')
                : '\u20b9 --';
        }
    }

    // ── UI: Activity log ─────────────────────────────────────
    function renderTransactions(items) {
        const log = document.getElementById('transaction-log');
        if (!log) return;

        const src = items !== undefined ? items : activityLog;
        if (src.length === 0) {
            log.innerHTML = `
                <div style="text-align:center;padding:24px;color:var(--text-dim);font-size:0.85rem;">
                    <i class="fa-solid fa-clock-rotate-left" style="opacity:0.3;font-size:1.5rem;display:block;margin-bottom:8px;"></i>
                    No recent activity yet.<br>
                    <span style="opacity:0.6;">Updates appear here when stock changes.</span>
                </div>`;
            return;
        }

        log.innerHTML = src.map(t => {
            const ts = t.timestamp && typeof t.timestamp.toDate === 'function'
                ? t.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now';
            return `
                <div class="transaction-item">
                    <div class="trans-icon ${t.type}">
                        <i class="fa-solid fa-arrow-${t.type === 'up' ? 'up' : 'down'}"></i>
                    </div>
                    <div class="trans-info">
                        <div class="trans-title">${t.itemName}</div>
                        <div class="trans-time">${ts}</div>
                    </div>
                    <div class="trans-amt" style="color:var(--accent-${t.type === 'up' ? 'green' : 'red'})">
                        ${t.diff > 0 ? '+' : ''}${t.diff} ${t.unit}
                    </div>
                </div>`;
        }).join('');
    }

    // ── UI: Consumption chart ─────────────────────────────────
    function renderConsumptionChart() {
        const ctx = document.getElementById('consumptionChart');
        if (!ctx) return;
        if (consumChart) consumChart.destroy();

        // Build 7-day labels
        const labels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString([], { weekday: 'short' }));
        }

        // Estimate daily feed consumption: total feed current / 30 days, with natural variance
        const totalFeedKg = inventoryItems
            .filter(i => i.category === 'Feed')
            .reduce((s, i) => s + (i.current || 0), 0);
        const baseDaily = Math.max(50, Math.round(totalFeedKg / 30));
        const data = labels.map(() => Math.round(baseDaily * (0.85 + Math.random() * 0.3)));

        consumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Feed Usage (kg)',
                    data,
                    borderColor: '#7CB518',
                    backgroundColor: 'rgba(124,181,24,0.1)',
                    fill: true, tension: 0.4, borderWidth: 3, pointRadius: 3,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
                }
            }
        });
    }

    // ── Actions: Quick update ─────────────────────────────────
    async function quickUpdate(id, amount) {
        const item = inventoryItems.find(i => i.id === id);
        if (!item) return;
        const oldVal = item.current;
        item.current = Math.min(item.total, Math.max(0, item.current + amount));
        if (item.current === oldVal) return;

        item.status = calcStatus(item.current, item.total);
        renderInventoryGrid();
        updateKPIs();

        try {
            await saveItem(item);
            await logActivity(item, item.current - oldVal);
            if (window.showToast) window.showToast(`${item.name}: ${amount > 0 ? '+' : ''}${amount} ${item.unit}`, amount > 0 ? 'success' : 'warning');
        } catch (e) {
            console.error('quickUpdate: save failed', e);
        }
    }

    // ── Actions: Form submit (add / edit) ─────────────────────
    async function handleFormSubmit(e) {
        e.preventDefault();
        const formId  = document.getElementById('form-item-id').value;
        const name    = document.getElementById('form-item-name').value.trim();
        const nameHi  = document.getElementById('form-item-name-hi').value.trim();
        const category= document.getElementById('form-item-category').value;
        const unit    = document.getElementById('form-item-unit').value.trim();
        const current = parseInt(document.getElementById('form-item-current').value);
        const total   = parseInt(document.getElementById('form-item-total').value);
        const costPerUnit = parseFloat(document.getElementById('form-item-cost')?.value) || 0;

        const status = calcStatus(current, total);

        try {
            if (formId) {
                // Edit
                const item = inventoryItems.find(i => i.id === formId);
                if (item) {
                    const diff = current - item.current;
                    Object.assign(item, { name, nameHi, category, unit, current, total, status, costPerUnit });
                    await saveItem(item);
                    if (diff !== 0) await logActivity(item, diff);
                    if (window.showToast) window.showToast(`Updated ${name}`);
                }
            } else {
                // Add new
                const newItem = {
                    id: '__new', name, nameHi, category, unit, current, total, status,
                    costPerUnit, lastRefill: today(), farmerId: uid()
                };
                await saveItem(newItem);
                inventoryItems.push(newItem);
                await logActivity(newItem, current);
                if (window.showToast) window.showToast(`Added ${name} to inventory!`);
            }

            closeModal();
            renderInventoryGrid();
            updateKPIs();
            renderConsumptionChart();
        } catch (err) {
            console.error('handleFormSubmit:', err);
            if (window.showToast) window.showToast('Failed to save. Please try again.', 'error');
        }
    }

    function resetForm() {
        const form = document.getElementById('inventory-form');
        if (form) form.reset();
        const id = document.getElementById('form-item-id');
        if (id) id.value = '';
    }

    function editItem(id) {
        const item = inventoryItems.find(i => i.id === id);
        if (!item) return;
        document.getElementById('form-item-id').value   = item.id;
        document.getElementById('form-item-name').value = item.name;
        document.getElementById('form-item-name-hi') && (document.getElementById('form-item-name-hi').value = item.nameHi || '');
        document.getElementById('form-item-category').value = item.category;
        document.getElementById('form-item-unit').value    = item.unit;
        document.getElementById('form-item-current').value = item.current;
        document.getElementById('form-item-total').value   = item.total;
        const costEl = document.getElementById('form-item-cost');
        if (costEl) costEl.value = item.costPerUnit || '';
        openModal('Edit Item / आइटम संपादित करें');
    }

    // ── Modal helpers ─────────────────────────────────────────
    function openModal(title) {
        const modal = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        if (modal)   modal.classList.add('open');
        if (titleEl) titleEl.textContent = title;
    }
    function closeModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.classList.remove('open');
    }

    function getIcon(cat) {
        return cat === 'Feed' ? 'fa-wheat-awn' : cat === 'Medicine' ? 'fa-pills' : 'fa-box-open';
    }

    return { init, quickUpdate, editItem, closeModal };
})();
