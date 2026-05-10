/**
 * KisanTrack — inventory.js
 * Logic for Inventory & Feed Management
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. INITIALIZE DATA & UI
    initInventory();
    initConsumptionChart();

    // 2. EVENT LISTENERS
    const addItemBtn = document.getElementById('btn-add-item');
    const inventoryModal = document.getElementById('modal-inventory');
    const closeModalBtn = document.getElementById('modal-close-btn');

    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            openModal('Add New Item / नया आइटम जोड़ें');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
});

/**
 * Fetch and Render Inventory Data
 */
async function initInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    // Simulated data (In production, fetch from Firestore)
    const inventoryItems = [
        { id: 'F01', name: 'Alfalfa Hay', nameHi: 'अल्फल्फा घास', category: 'Feed', current: 1200, total: 2000, unit: 'kg', lastRefill: '2026-05-01', status: 'in-stock' },
        { id: 'F02', name: 'Grain Mix', nameHi: 'अनाज का मिश्रण', category: 'Feed', current: 350, total: 1500, unit: 'kg', lastRefill: '2026-04-28', status: 'low' },
        { id: 'M01', name: 'Vitamin B12', nameHi: 'विटामिन बी12', category: 'Medicine', current: 45, total: 50, unit: 'vials', lastRefill: '2026-05-05', status: 'in-stock' },
        { id: 'M02', name: 'Antibiotics', nameHi: 'एंटीबायोटिक्स', category: 'Medicine', current: 2, total: 20, unit: 'packs', lastRefill: '2026-04-15', status: 'critical' },
        { id: 'T01', name: 'Ear Tags', nameHi: 'कान के टैग', category: 'Supplies', current: 85, total: 100, unit: 'units', lastRefill: '2026-05-08', status: 'in-stock' }
    ];

    grid.innerHTML = inventoryItems.map(item => createInventoryCard(item)).join('');
    
    // Update KPI stats
    document.getElementById('stat-total-items').textContent = inventoryItems.length;
    document.getElementById('stat-low-stock').textContent = inventoryItems.filter(i => i.status === 'low' || i.status === 'critical').length;
}

/**
 * Create HTML for an Inventory Card
 */
function createInventoryCard(item) {
    const pct = (item.current / item.total) * 100;
    const statusClass = item.status === 'critical' ? 'critical-stock' : (item.status === 'low' ? 'low-stock' : '');
    const chipClass = item.status === 'critical' ? 'chip-out' : (item.status === 'low' ? 'chip-low' : 'chip-in-stock');
    const statusLabel = item.status === 'critical' ? 'Critical' : (item.status === 'low' ? 'Low Stock' : 'In Stock');

    return `
        <div class="inventory-card ${statusClass}">
            <div class="inventory-card-header">
                <div class="inventory-icon">
                    <i class="fa-solid ${getIcon(item.category)}"></i>
                </div>
                <span class="status-chip ${chipClass}">${statusLabel}</span>
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
            
            <div class="inventory-card-footer">
                <div class="last-refill">Last Refill: ${item.lastRefill}</div>
                <button class="btn btn-secondary btn-sm" onclick="editItem('${item.id}')">Update</button>
            </div>
        </div>
    `;
}

function getIcon(category) {
    switch(category) {
        case 'Feed': return 'fa-wheat-awn';
        case 'Medicine': return 'fa-pills';
        default: return 'fa-box-open';
    }
}

/**
 * Initialize Consumption Chart
 */
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
                pointRadius: 4,
                pointBackgroundColor: '#7CB518'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#706860' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#706860' }
                }
            }
        }
    });
}

/**
 * Modal Controls
 */
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
    if (modal) {
        modal.classList.remove('open');
    }
}

window.editItem = function(id) {
    openModal('Update Stock Level / स्टॉक स्तर अपडेट करें');
    // In production: Load item data into form
}
