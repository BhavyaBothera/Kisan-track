/**
 * ============================================================
 * KisanTrack — Upload Module (upload.js)
 * Drag-and-drop file upload, progress bar, results display
 * ============================================================
 */

const UploadModule = (function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────
  let dropzone, fileInput, browseBtn, filePreview,
      fileNameDisplay, fileSizeDisplay, processBtn,
      uploadProgress, progressBar, progressLabel, progressPct,
      uploadResult;

  let selectedFile = null;

  // ── Format file size ──────────────────────────────────────
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Show file preview ─────────────────────────────────────
  function showFilePreview(file) {
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatSize(file.size);

    const icon = filePreview.querySelector('.file-icon i');
    if (file.name.endsWith('.json')) icon.className = 'fa-solid fa-file-code';
    else icon.className = 'fa-solid fa-file-csv';

    filePreview.classList.add('visible');
    uploadProgress.classList.remove('visible');
    uploadResult.classList.remove('visible');
  }

  // ── Simulate processing & Write to Firestore ──────────────
  function processFile() {
    if (!selectedFile) return;

    filePreview.classList.remove('visible');
    uploadProgress.classList.add('visible');
    uploadResult.classList.remove('visible');

    let pct = 0;
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';

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
        progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }

      progressBar.style.width = pct.toFixed(0) + '%';
      progressPct.textContent = pct.toFixed(0) + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(finalizeUpload, 500);
      }
    }, 100);
  }

  async function finalizeUpload() {
    const records = 100 + Math.floor(Math.random() * 400);
    const anomalies = Math.floor(Math.random() * 5);
    const animalsAffected = anomalies > 0 ? 1 + Math.floor(Math.random() * 2) : 0;

    const summary = {
      farmerId: auth.currentUser.uid,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      recordsParsed: records,
      anomaliesDetected: anomalies,
      animalsAffected: animalsAffected,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'Success'
    };

    try {
      await db.collection('sensorLogUploads').add(summary);
      showResults(summary);
      showToast('Log file processed and saved to cloud.');
    } catch (err) {
      console.error('Error saving upload summary:', err);
      showToast('Error saving upload summary.', 'error');
    }
  }

  // ── Show results ──────────────────────────────────────────
  function showResults(data) {
    uploadProgress.classList.remove('visible');
    uploadResult.classList.add('visible');

    document.getElementById('res-parsed').textContent = data.recordsParsed;
    document.getElementById('res-anomalies').textContent = data.anomaliesDetected;
    document.getElementById('res-animals').textContent = data.animalsAffected;

    const tbody = document.getElementById('anomaly-table-body');
    if (data.anomaliesDetected > 0) {
      tbody.innerHTML = `
        <tr>
          <td><strong style="color:var(--text-primary)">COW#102</strong></td>
          <td>Body Temperature</td>
          <td><strong style="color:var(--text-primary)">40.2°C</strong></td>
          <td><span class="severity-chip chip-warning">Warning</span></td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-dim)">No anomalies found in this file.</td></tr>';
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────
  function initDragDrop() {
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('drag-over'); });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    });
    dropzone.addEventListener('click', () => fileInput.click());
  }

  // ── File Input ────────────────────────────────────────────
  function handleFileSelect(file) {
    const allowed = ['.csv', '.json'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      showToast('⚠ Please select a CSV or JSON file.', 'warning');
      return;
    }
    showFilePreview(file);
  }

  // ── Init ──────────────────────────────────────────────────
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

    initDragDrop();

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
    });
    processBtn.addEventListener('click', processFile);
  }

  return { init };
})();
