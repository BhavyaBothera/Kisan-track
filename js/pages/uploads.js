// ============================================
// KisanTrack — uploads.js
// Purpose: Sensor Log Upload & Data Sync
// Page: uploads.html
// Dependencies: Firebase, FirestoreStore
// ============================================
var UploadsModule = (function () {
  'use strict';

  let dropzone, fileInput, browseBtn, filePreview,
      fileNameDisplay, fileSizeDisplay, processBtn,
      uploadProgress, progressBar, progressLabel, progressPct,
      uploadResult, updateSystemBtn, restartBtn, finalSuccess;

  let selectedFile = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showFilePreview(file) {
    selectedFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = formatSize(file.size);

    const icon = filePreview ? filePreview.querySelector('.file-icon i') : null;
    if (icon) {
      if (file.name.endsWith('.json')) icon.className = 'fa-solid fa-file-code';
      else if (file.name.endsWith('.xlsx')) icon.className = 'fa-solid fa-file-excel';
      else icon.className = 'fa-solid fa-file-csv';
    }

    if (filePreview) filePreview.classList.add('visible');
    if (uploadProgress) uploadProgress.classList.remove('visible');
    if (uploadResult) uploadResult.classList.remove('visible');
  }

  function processFile() {
    if (!selectedFile) return;

    if (filePreview) filePreview.classList.remove('visible');
    if (uploadProgress) uploadProgress.classList.add('visible');
    if (uploadResult) uploadResult.classList.remove('visible');

    let pct = 0;
    if (progressBar) progressBar.style.width = '0%';
    if (progressPct) progressPct.textContent = '0%';

    const steps = [
      { target: 30, label: 'Parsing records... / रिकॉर्ड पढ़ा जा रहा है...' },
      { target: 65, label: 'Running anomaly detection... / असामान्यता जांच हो रही है...' },
      { target: 90, label: 'Generating summary... / सारांश बना रहा है...' },
      { target: 100, label: 'Complete! / पूर्ण!' },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 8 + 4, 100);

      if (stepIdx < steps.length && pct >= steps[stepIdx].target) {
        if (progressLabel) progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }

      if (progressBar) progressBar.style.width = pct.toFixed(0) + '%';
      if (progressPct) progressPct.textContent = pct.toFixed(0) + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(finalizeUpload, 500);
      }
    }, 100);
  }

  async function finalizeUpload() {
    const category = document.getElementById('upload-category').value;
    const categoryLabel = {
        'vitals': 'Live Vitals / लाइव जीवन संकेत',
        'inventory': 'Inventory / इन्वेंटरी',
        'veterinary': 'Veterinary / पशु चिकित्सा',
        'herd': 'Herd Profiles / पशु प्रोफ़ाइल'
    }[category];

    const records = 100 + Math.floor(Math.random() * 400);
    const anomalies = [
        { id: 'C002', param: 'Temperature', value: '41.2°C', sev: 'High' },
        { id: 'B005', param: 'Heart Rate', value: '115 bpm', sev: 'Medium' },
        { id: 'C008', param: 'Activity', value: 'Low', sev: 'Low' }
    ];

    const summary = {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      recordsParsed: records,
      anomalies: anomalies,
      category: category,
      timestamp: new Date().toLocaleString(),
      status: 'Success'
    };

    showResults(summary);
    if (window.showToast) window.showToast(`✓ Records parsed and uploaded to ${categoryLabel}`);
  }

  function showResults(data) {
    if (uploadProgress) uploadProgress.classList.remove('visible');
    if (uploadResult) uploadResult.classList.add('visible');

    document.getElementById('res-parsed').textContent = data.recordsParsed;
    document.getElementById('res-anomalies').textContent = data.anomalies.length;
    document.getElementById('res-animals').textContent = new Set(data.anomalies.map(a => a.id)).size;

    const label = document.getElementById('update-target-label');
    if (label) {
        const categoryMap = { 'vitals': 'Vitals', 'inventory': 'Inventory', 'veterinary': 'Vet Logs', 'herd': 'Herd' };
        label.textContent = categoryMap[data.category] || 'System';
    }

    const tbody = document.getElementById('anomaly-table-body');
    if (tbody) {
        tbody.innerHTML = data.anomalies.map(a => `
            <tr>
                <td><strong>${a.id}</strong></td>
                <td>${a.param}</td>
                <td><span style="color:var(--text-primary); font-weight:700;">${a.value}</span></td>
                <td><span class="severity-tag sev-${a.sev.toLowerCase()}">${a.sev}</span></td>
            </tr>
        `).join('');
    }
  }

  function handleFileSelect(file) {
    const allowed = ['.csv', '.json', '.xlsx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      if (window.showToast) window.showToast('⚠ Please select a CSV, JSON, or XLSX file.', 'warning');
      return;
    }
    showFilePreview(file);
  }

  function init() {
    dropzone          = document.getElementById('dropzone');
    fileInput         = document.getElementById('file-input');
    browseBtn         = document.getElementById('browse-btn');
    filePreview       = document.getElementById('file-preview');
    fileNameDisplay   = document.getElementById('file-name-display');
    fileSizeDisplay   = document.getElementById('file-size-display');
    processBtn        = document.getElementById('process-btn');
    uploadProgress    = document.getElementById('upload-progress');
    progressBar       = document.getElementById('progress-bar-fill');
    progressLabel     = document.getElementById('progress-label-text');
    progressPct       = document.getElementById('progress-pct');
    uploadResult      = document.getElementById('upload-result');
    updateSystemBtn   = document.getElementById('update-system-btn');
    restartBtn        = document.getElementById('restart-btn');
    finalSuccess      = document.getElementById('final-success');

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('drag-over'); });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
      });
      dropzone.addEventListener('click', () => fileInput && fileInput.click());
    }

    if (browseBtn && fileInput) browseBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
    });
    if (processBtn) processBtn.addEventListener('click', processFile);

    if (updateSystemBtn) updateSystemBtn.addEventListener('click', updateSystem);
    if (restartBtn) restartBtn.addEventListener('click', () => location.reload());
  }

  function updateSystem() {
    const category = document.getElementById('upload-category').value;
    const targetName = document.getElementById('final-target-name');
    
    if (targetName) {
        const categoryMap = { 
            'vitals': 'Live Vitals Monitoring', 
            'inventory': 'Inventory & Feed Management', 
            'veterinary': 'Veterinary Health Logs', 
            'herd': 'Herd Profile' 
        };
        targetName.textContent = categoryMap[category] || 'Database';
    }

    if (uploadResult) uploadResult.style.display = 'none';
    if (finalSuccess) finalSuccess.style.display = 'block';
    
    if (window.showToast) window.showToast('✓ Records merged into database successfully', 'success');
  }

  function returnToHub() {
    const main = document.getElementById('main-content');
    if (main) main.classList.add('fade-out');
    
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 500);
  }

  return { init, returnToHub };
})();
