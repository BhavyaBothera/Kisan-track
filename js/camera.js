/**
 * ============================================================
 * KisanTrack — Camera Monitor Module (camera.js)
 * ESP32-CAM simulation, Gemini API, canvas bounding boxes,
 * capture history filmstrip, alert integration
 * ============================================================
 */
const CameraModule = (function () {
  'use strict';

  // --- State ---
  let apiKey = localStorage.getItem('kt_gemini_key') || 'AIzaSyCYvUbOb13ctYLzpSUhWaPfJV6TCENMxzs';

  let cameraOn       = true;
  let autoAnalysis   = true;
  let captureIntSecs = 120;
  let countdown      = 120;
  let countdownTimer = null;
  let isAnalyzing    = false;
  let lastCaptureTs  = null;

  let feedCanvas, detCanvas;

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtCountdown = (s) => s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s}s`;
  
  function timeAgo(date) {
    if (!date) return '—';
    const s = Math.round((Date.now() - date.getTime()) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`;
  }

  // ── Scene Generation & Drawing ───────────────────────────
  function genScene() {
    const count = 3 + Math.floor(Math.random() * 3);
    const pool  = ['Cow','Cow','Buffalo','Goat'];
    const sc    = {};
    const out   = [];
    const used  = [];

    for (let i = 0; i < count; i++) {
      let x, y, t = 0;
      do {
        x = 0.05 + Math.random() * 0.70;
        y = 0.28 + Math.random() * 0.36;
        t++;
      } while (t < 20 && used.some(u => Math.abs(u.x - x) < 0.15 && Math.abs(u.y - y) < 0.10));
      used.push({ x, y });

      const sp = pool[Math.floor(Math.random() * pool.length)];
      sc[sp] = (sc[sp] || 0) + 1;
      const r = Math.random();
      const st = r < 0.15 ? 'flagged' : r < 0.3 ? 'observation' : 'healthy';

      out.push({
        x, y,
        w: sp === 'Goat' ? 0.07 : 0.14,
        h: sp === 'Goat' ? 0.11 : 0.18,
        species: sp, status: st, flipped: Math.random() > 0.5,
        label: `${sp} #${sc[sp]}`, id: i + 1,
      });
    }
    return out;
  }

  function drawAnimal(ctx, a, W, H) {
    const x = a.x * W, y = a.y * H, w = a.w * W, h = a.h * H;
    const isBuff = a.species === 'Buffalo', isGoat = a.species === 'Goat';
    const bc = isBuff ? '#2C200E' : isGoat ? '#48382A' : '#564630';
    
    ctx.save();
    if (a.flipped) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.translate(-x - w, -y); }
    ctx.fillStyle = bc;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h * 0.65, 4) : ctx.rect(x, y, w, h * 0.65);
    ctx.fill();
    ctx.fillRect(x + w * 0.75, y + h * 0.06, w * 0.1, h * 0.28); // neck
    ctx.restore();
  }

  function drawBoxes(ctx, animals, W, H) {
    animals.forEach(a => {
      const x = Math.round(a.x * W) - 6;
      const y = Math.round((a.y - a.h * 0.14) * H) - 20;
      const w = Math.round(a.w * W) + 12;
      const h = Math.round(a.h * H * 1.48) + 20;
      const col = a.status === 'flagged' ? '#C0392B' : a.status === 'observation' ? '#E5A100' : '#7CB518';

      ctx.fillStyle = col + '22'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x + 6, y + 6, 4, 0, Math.PI * 2); ctx.fill();

      const lW = a.label.length * 6.8 + 8;
      ctx.fillRect(x, y - 18, lW, 18);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
      ctx.fillText(a.label, x + 4, y - 5);
    });
  }

  function drawScene(canvas, animals, withBoxes) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // Background: Barn Interior
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#12120A');
    grad.addColorStop(0.6, '#1A1A10');
    grad.addColorStop(1, '#0D0D05');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Floor texture
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i, H*0.6); ctx.lineTo(i-100, H); ctx.stroke(); }

    // Animals
    animals.forEach(a => drawAnimal(ctx, a, W, H));

    if (withBoxes) drawBoxes(ctx, animals, W, H);

    // AI Scanner Effect (if analyzing)
    if (isAnalyzing && !withBoxes) {
      const scanY = (Date.now() % 2000 / 2000) * H;
      ctx.fillStyle = 'rgba(124, 181, 24, 0.1)';
      ctx.fillRect(0, scanY - 2, W, 4);
      ctx.shadowBlur = 15; ctx.shadowColor = '#7CB518';
      ctx.strokeStyle = 'rgba(124, 181, 24, 0.6)';
      ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(W, scanY); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#7CB518'; ctx.font = 'bold 11px monospace';
    ctx.fillText(`CAM-01  ${new Date().toLocaleTimeString()}  KISANTRACK_VISION_AI`, 10, H - 10);
  }

  // ── Capture & Upload ─────────────────────────────────────
  async function doCapture() {
    if (!cameraOn || isAnalyzing) return;
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const animals = genScene();
    
    drawScene(feedCanvas, animals, false);
    drawScene(detCanvas, animals, true);
    
    const flash = $('cam-flash');
    if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 300); }

    isAnalyzing = true;
    showLoading();

    try {
      // 1. Upload to Storage (Simulated blob from canvas)
      const blob = await new Promise(res => feedCanvas.toBlob(res, 'image/jpeg', 0.8));
      const fileName = `captures/${uid}/${Date.now()}.jpg`;
      const storageRef = storage.ref().child(fileName);
      const uploadSnap = await storageRef.put(blob);
      const downloadURL = await uploadSnap.ref.getDownloadURL();

      // 2. Analysis Logic (Real Gemini if key exists, else simulated)
      let analysisResult;
      if (apiKey && autoAnalysis) {
          analysisResult = await analyzeGemini(feedCanvas);
      } else {
          analysisResult = runSimulatedAnalysis(animals);
      }
      
      const captureDoc = {
        farmerId: uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        imageUrl: downloadURL,
        storagePath: fileName,
        animalCount: analysisResult.animalCount,
        herdScore: analysisResult.herdScore,
        observations: analysisResult.observations,
        summary: analysisResult.summary,
        isDemo: true
      };

      // 3. Write to Firestore
      const docRef = await db.collection('cameraCaptures').add(captureDoc);
      
      // 4. Create Alert if flagged
      if (analysisResult.herdScore < 7) {
        await db.collection('alerts').add({
          farmerId: uid,
          animalId: 'Visual-Check',
          parameter: 'Camera Analysis',
          readingValue: `Score ${analysisResult.herdScore}/10`,
          alertType: 'Mobility Flag',
          severity: analysisResult.herdScore < 5 ? 'Critical' : 'Warning',
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          resolved: false,
          source: 'Camera'
        });
        showToast('⚠ AI detected potential health issue in herd.', 'warning');
      }

      lastCaptureTs = new Date();
      updateCountdownDisplay();
      fetchHistory();
      showResult(captureDoc);

    } catch (err) {
      console.error('Capture/Upload Error:', err);
      showError(err.message);
    } finally {
      isAnalyzing = false;
      countdown = captureIntSecs;
    }
  }

  // ── Gemini API ────────────────────────────────────────────
  async function analyzeGemini(canvas) {
    try {
      const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: 'image/jpeg', data: b64 } },
              { text: 'Analyze this cattle surveillance image. Respond in JSON: {"animalCount":N, "herdScore":N, "observations":["..."], "summary":"..."}' }
            ]}]
          })
        }
      );
      if (!res.ok) throw new Error('Gemini API Error');
      const data = await res.json();
      const text = data.candidates[0].content.parts[0].text;
      return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    } catch (err) {
      console.warn('Gemini failed, falling back to simulation:', err);
      throw err;
    }
  }

  function runSimulatedAnalysis(animals) {
    const flagged = animals.filter(a => a.status === 'flagged');
    const score = flagged.length > 0 ? 6.5 : 9.2;
    return {
      animalCount: animals.length,
      herdScore: score,
      observations: [
        `Detected ${animals.length} animals.`,
        flagged.length > 0 ? `⚠ ${flagged.length} animal(s) flagged for mobility issues.` : 'All animals appear healthy.'
      ],
      summary: flagged.length > 0 ? 'Warning: Some animals showing signs of distress.' : 'Herd health is excellent.'
    };
  }

  // ── History Filmstrip ─────────────────────────────────────
  async function fetchHistory() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const strip = $('filmstrip');
    if (!strip) return;

    try {
      const snapshot = await db.collection('cameraCaptures')
        .where('farmerId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(8)
        .get();

      strip.innerHTML = snapshot.docs.map(doc => {
        const d = doc.data();
        const time = d.timestamp ? d.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
        return `
          <div class="filmstrip-item" onclick="CameraModule.viewFromHistory('${doc.id}')">
            <div class="fs-thumb-wrap">
              <img src="${d.imageUrl}" class="fs-thumb">
              ${d.herdScore < 7 ? '<div class="fs-alert-dot">⚠</div>' : ''}
            </div>
            <div class="fs-meta">
              <span class="fs-time">${time}</span>
              <span class="fs-score">${d.herdScore}/10</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }

  window.CameraModule = window.CameraModule || {};
  window.CameraModule.viewFromHistory = async (id) => {
     const doc = await db.collection('cameraCaptures').doc(id).get();
     if (doc.exists) showResult(doc.data());
  };

  // ── UI Displays ───────────────────────────────────────────
  function showLoading() {
    $('analysis-results').innerHTML = '<div class="analysis-loading"><div class="analysis-spinner"></div><p>Uploading & Analyzing...</p></div>';
  }

  function showError(msg) {
    $('analysis-results').innerHTML = `<div class="analysis-error"><i class="fa-solid fa-circle-exclamation"></i><p>Error: ${msg}</p></div>`;
  }

  function showResult(r) {
    const el = $('analysis-results');
    if (!el) return;
    const col = r.herdScore >= 8 ? 'var(--accent-green)' : 'var(--accent-amber)';
    const isSim = r.isDemo || !apiKey;

    el.innerHTML = `
      <div class="result-body">
        <div class="result-stats-row">
          <div class="res-stat"><div class="res-stat-num">${r.animalCount}</div><div class="res-stat-lbl">Detected</div></div>
          <div class="res-stat"><div class="res-stat-num" style="color:${col}">${r.herdScore}<small>/10</small></div><div class="res-stat-lbl">Herd Score</div></div>
        </div>
        <div class="score-bar-row">
           <div class="score-bar-bg"><div class="score-bar-fill" style="width:${r.herdScore * 10}%; background:${col}"></div></div>
        </div>
        <div class="summary-section">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;"><i class="fa-solid fa-robot"></i> Analysis Summary</h4>
            <span class="badge ${isSim ? 'badge-sim' : 'badge-gemini'}">${isSim ? 'Simulated' : 'Gemini AI'}</span>
          </div>
          <p>${r.summary}</p>
          <ul class="obs-list">${r.observations.map(o => `<li>${o}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  // ── Settings ──────────────────────────────────────────────
  function initSettings() {
    const camTog = $('cam-toggle');
    if (camTog) camTog.onchange = () => {
      cameraOn = camTog.checked;
      $('cam-status-label').textContent = cameraOn ? 'ON' : 'OFF';
      $('cam-status-label').style.color = cameraOn ? 'var(--accent-green)' : 'var(--text-dim)';
    };

    const intInp = $('capture-interval-input');
    if (intInp) intInp.onchange = () => {
      const val = parseInt(intInp.value);
      if (val >= 10) {
        captureIntSecs = val;
        countdown = val;
        showToast(`Interval set to ${val}s`);
      }
    };

    const saveKeyBtn = $('save-gemini-key-btn');
    if (saveKeyBtn) saveKeyBtn.onclick = () => {
      const val = $('gemini-api-key-input').value.trim();
      if (val) {
        apiKey = val;
        localStorage.setItem('kt_gemini_key', val);
        showToast('API Key saved.');
        updateKeyStatus();
      }
    };
  }

  function updateKeyStatus() {
    const el = $('api-key-status');
    const prompt = $('no-key-prompt');
    if (apiKey) {
      if (el) {
        el.className = 'api-key-status connected';
        el.innerHTML = '<i class="fa-solid fa-circle-check"></i> API Connected';
      }
      if (prompt) prompt.style.display = 'none';
    } else {
      if (prompt) prompt.style.display = 'flex';
    }
  }

  // ── Initialization ────────────────────────────────────────
  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (!cameraOn || isAnalyzing) return;
      countdown = Math.max(0, countdown - 1);
      updateCountdownDisplay();
      if (countdown === 0) doCapture();
      
      // Keep feed alive with scanner if analyzing
      if (isAnalyzing) {
         drawScene(feedCanvas, [], false); // We'd need current animals ideally
      }
    }, 1000);
  }

  function updateCountdownDisplay() {
    if ($('cam-countdown')) $('cam-countdown').textContent = fmtCountdown(countdown);
    if ($('last-capture-time')) $('last-capture-time').textContent = timeAgo(lastCaptureTs);
  }

  function init() {
    feedCanvas = $('camera-feed-canvas');
    detCanvas  = $('detection-canvas');
    
    if ($('capture-now-btn')) $('capture-now-btn').onclick = doCapture;
    
    // Auto-analysis toggle
    const aaTog = $('auto-analysis-toggle');
    if (aaTog) aaTog.onchange = () => { autoAnalysis = aaTog.checked; };

    initSettings();
    updateKeyStatus();
    
    if (auth.currentUser) {
      fetchHistory();
      startCountdown();
      setTimeout(doCapture, 1500);
    } else {
      const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
          fetchHistory();
          startCountdown();
          setTimeout(doCapture, 1500);
          unsubscribe();
        }
      });
    }
  }

  return { init };
})();
