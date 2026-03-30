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

    // Update icon by file type
    const icon = filePreview.querySelector('.file-icon i');
    if (file.name.endsWith('.json')) {
      icon.className = 'fa-solid fa-file-code';
    } else {
      icon.className = 'fa-solid fa-file-csv';
    }

    filePreview.classList.add('visible');
    uploadProgress.classList.remove('visible');
    uploadResult.classList.remove('visible');
  }

  // ── Simulate processing ───────────────────────────────────
  function processFile() {
    if (!selectedFile) return;

    // Show progress
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
      pct = Math.min(pct + Math.random() * 6 + 2, 100);

      // Update label based on milestones
      if (stepIdx < steps.length && pct >= steps[stepIdx].target) {
        progressLabel.textContent = steps[stepIdx].label;
        stepIdx++;
      }

      progressBar.style.width  = pct.toFixed(0) + '%';
      progressPct.textContent  = pct.toFixed(0) + '%';

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(showResults, 400);
      }
    }, 80);
  }

  // ── Show results ──────────────────────────────────────────
  function showResults() {
    uploadProgress.classList.remove('visible');
    uploadResult.classList.add('visible');

    const result = APP_DATA.uploadResult;
    document.getElementById('res-parsed').textContent    = result.recordsParsed;
    document.getElementById('res-anomalies').textContent = result.anomaliesDetected;
    document.getElementById('res-animals').textContent   = result.animalsAffected;

    // Render anomaly table
    const tbody = document.getElementById('anomaly-table-body');
    tbody.innerHTML = result.anomalies.map(a => `
      <tr>
        <td><strong style="color:var(--text-primary)">${a.animalId}</strong></td>
        <td>${a.parameter}</td>
        <td><strong style="color:var(--text-primary)">${a.reading}</strong></td>
        <td>
          <span class="severity-chip chip-${a.severity.toLowerCase()}">${a.severity}</span>
        </td>
      </tr>
    `).join('');
  }

  // ── Drag & Drop ───────────────────────────────────────────
  function initDragDrop() {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  // ── File Input ────────────────────────────────────────────
  function handleFileSelect(file) {
    const allowed = ['.csv', '.json'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {
      alert('⚠ Please select a CSV or JSON file.\nकृपया CSV या JSON फ़ाइल चुनें।');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('⚠ File size must be under 50MB.\nफ़ाइल का आकार 50MB से कम होना चाहिए।');
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
