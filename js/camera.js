/**
 * ============================================================
 * KisanTrack — Camera Monitor Module (camera.js)
 * ESP32-CAM simulation, Gemini API, canvas bounding boxes,
 * capture history filmstrip, alert integration
 * ============================================================
 */
const CameraModule = (function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let apiKey = '';
  try { apiKey = localStorage.getItem('kt_gemini_key') || ''; } catch (e) {}

  let cameraOn       = true;
  let autoAnalysis   = true;
  let captureIntSecs = 120;
  let countdown      = 120;
  let countdownTimer = null;
  let captureHistory = [];
  let currentAnimals = [];
  let isAnalyzing    = false;
  let lastCapture    = null;

  let feedCanvas, detCanvas;

  // ── Helpers ───────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtCountdown(s) {
    return s >= 60 ? `${Math.floor(s / 60)}:${pad(s % 60)}` : `${s}s`;
  }
  function timeAgo(d) {
    if (!d) return '—';
    const s = Math.round((Date.now() - d) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`;
  }

  // ── Scene Generation ──────────────────────────────────────
  function genScene() {
    const count = 3 + Math.floor(Math.random() * 3);
    const pool  = ['Cow','Cow','Cow','Buffalo','Goat'];
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

      const sp = pool[Math.floor(Math.random() * (i < 2 ? 3 : pool.length))];
      sc[sp] = (sc[sp] || 0) + 1;
      const r  = Math.random();
      const st = r < 0.12 ? 'flagged' : r < 0.25 ? 'observation' : 'healthy';

      out.push({
        x, y,
        w: sp === 'Goat' ? 0.07 + Math.random() * 0.03 : 0.12 + Math.random() * 0.05,
        h: sp === 'Goat' ? 0.11 + Math.random() * 0.03 : 0.15 + Math.random() * 0.05,
        species: sp, status: st, flipped: Math.random() > 0.5,
        label: `${sp} #${sc[sp]}`, id: i + 1,
      });
    }
    return out;
  }

  // ── Canvas Drawing ────────────────────────────────────────
  function drawScene(canvas, animals, withBoxes) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // Sky + ground
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    sky.addColorStop(0, '#080C04'); sky.addColorStop(1, '#141808');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.6);
    const gnd = ctx.createLinearGradient(0, H * 0.55, 0, H);
    gnd.addColorStop(0, '#181804'); gnd.addColorStop(1, '#0D0D04');
    ctx.fillStyle = gnd; ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Horizon
    ctx.strokeStyle = '#222210'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H * 0.58); ctx.lineTo(W, H * 0.58); ctx.stroke();

    // Fence
    ctx.fillStyle = '#1C1608';
    for (let i = 0; i < 8; i++) ctx.fillRect((i / 7) * W - 2, H * 0.52, 4, H * 0.11);
    ctx.strokeStyle = '#201E0C'; ctx.lineWidth = 1;
    [0.54, 0.57].forEach(y => {
      ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
    });

    // Animals
    animals.forEach(a => drawAnimal(ctx, a, W, H));

    // Grain
    const imgD = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < imgD.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      imgD.data[i]   = Math.max(0, Math.min(255, imgD.data[i]   + n));
      imgD.data[i+1] = Math.max(0, Math.min(255, imgD.data[i+1] + n));
      imgD.data[i+2] = Math.max(0, Math.min(255, imgD.data[i+2] + n));
    }
    ctx.putImageData(imgD, 0, 0);

    // Vignette
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.28, W/2, H/2, H*0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // HUD overlay
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, H - 28, W, 28);
    const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    ctx.fillStyle = '#7CB518'; ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillText(`CAM-01  ${ts}  KISANTRACK`, 8, H - 10);
    ctx.fillStyle = '#E5A100';
    ctx.fillText(`${animals.length} ANIMAL(S)`, W - 92, H - 10);
    // REC dot
    ctx.fillStyle = '#C0392B';
    ctx.beginPath(); ctx.arc(W - 14, 14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px "Courier New",monospace';
    ctx.fillText('REC', W - 32, 18);
    // Corner markers
    const mk = 12, ms = '#7CB518';
    ctx.strokeStyle = ms; ctx.lineWidth = 1.5;
    [[8, 8], [W-8, 8], [8, H-28], [W-8, H-28]].forEach(([cx, cy], qi) => {
      const sx = qi % 2 === 0 ? 1 : -1, sy = qi < 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * mk); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * mk, cy);
      ctx.stroke();
    });

    // Bounding boxes
    if (withBoxes) drawBoxes(ctx, animals, W, H);
  }

  function drawAnimal(ctx, a, W, H) {
    const x = a.x * W, y = a.y * H, w = a.w * W, h = a.h * H;
    const isBuff = a.species === 'Buffalo', isGoat = a.species === 'Goat';
    const bc = isBuff ? '#2C200E' : isGoat ? '#48382A' : '#564630';
    const hc = isBuff ? '#201808' : isGoat ? '#3A2A1E' : '#463A26';
    const lc = isBuff ? '#1E1608' : isGoat ? '#302418' : '#3A2E1C';

    ctx.save();
    if (a.flipped) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.translate(-x - w, -y); }

    // Legs
    ctx.fillStyle = lc;
    [0.10, 0.26, 0.60, 0.76].forEach(lx => ctx.fillRect(x + w * lx, y + h * 0.58, w * 0.07, h * 0.44));

    // Body
    ctx.fillStyle = bc;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h * 0.65, 4) : ctx.rect(x, y, w, h * 0.65);
    ctx.fill();

    // Buffalo hump
    if (isBuff) {
      ctx.beginPath(); ctx.ellipse(x + w * 0.62, y - h * 0.05, w * 0.14, h * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2C200E'; ctx.fill();
    }

    // Neck + head
    ctx.fillStyle = bc;
    ctx.fillRect(x + w * 0.75, y + h * 0.06, w * 0.1, h * 0.28);
    const hw = w * (isBuff ? 0.21 : 0.18), hh = h * (isGoat ? 0.19 : 0.21);
    ctx.fillStyle = hc;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + w * 0.82, y - hh * 0.38, hw, hh, 3) : ctx.rect(x + w * 0.82, y - hh * 0.38, hw, hh);
    ctx.fill();

    // Horns
    if (!isGoat) {
      ctx.strokeStyle = hc; ctx.lineWidth = 1.5;
      [[0.86, -0.36, 0.74, -0.75, 0.79, -0.18], [0.96, -0.33, 1.06, -0.72, 0.98, -0.14]].forEach(([x1,y1,x2,y2,x3,y3]) => {
        ctx.beginPath();
        ctx.moveTo(x + w * x1, y + h * y1);
        ctx.bezierCurveTo(x + w * x2, y + h * y2, x + w * x3, y + h * y3, x + w * x3, y + h * y3);
        ctx.stroke();
      });
    }

    // Eye + tail
    ctx.fillStyle = '#080604';
    ctx.beginPath(); ctx.arc(x + w * 0.90, y - hh * 0.08, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = lc; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.04, y + h * 0.2);
    ctx.bezierCurveTo(x - w * 0.06, y + h * 0.35, x - w * 0.08, y + h * 0.56, x - w * 0.02, y + h * 0.68);
    ctx.stroke();

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
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Courier New",monospace';
      ctx.fillText(a.label, x + 4, y - 5);
    });
  }

  // ── Capture ───────────────────────────────────────────────
  function doCapture() {
    if (!cameraOn) return;
    currentAnimals = genScene();
    lastCapture    = Date.now();

    drawScene(feedCanvas, currentAnimals, false);
    drawScene(detCanvas,  currentAnimals, true);

    // Flash
    const flash = $('cam-flash');
    if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 280); }

    updateCountdownDisplay();
    renderDetStats(currentAnimals);
    addToFilmstrip(currentAnimals);
    countdown = captureIntSecs;

    if (autoAnalysis) {
      if (apiKey) analyzeGemini();
      else        analyzeSimulated();
    }
  }

  // ── Filmstrip ─────────────────────────────────────────────
  function addToFilmstrip(animals) {
    const thumb = document.createElement('canvas');
    thumb.width = 160; thumb.height = 90;
    drawScene(thumb, animals, true);
    captureHistory.unshift({ canvas: thumb, time: new Date(), animals, flagged: animals.some(a => a.status === 'flagged'), score: animals.some(a => a.status === 'flagged') ? (6 + Math.random() * 1.5).toFixed(0) : (8 + Math.random() * 1.8).toFixed(0) });
    if (captureHistory.length > 8) captureHistory.pop();
    renderFilmstrip();
  }

  function renderFilmstrip() {
    const strip = $('filmstrip');
    if (!strip) return;
    strip.innerHTML = '';
    captureHistory.forEach((e, i) => {
      const t = e.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const sc = parseInt(e.score);
      const div = document.createElement('div');
      div.className = 'filmstrip-item' + (i === 0 ? ' fs-active' : '');
      div.innerHTML = `
        <div class="fs-thumb-wrap">
          <canvas class="fs-thumb" width="160" height="90"></canvas>
          ${e.flagged ? '<div class="fs-alert-dot"><i class="fa-solid fa-triangle-exclamation"></i></div>' : ''}
        </div>
        <div class="fs-meta">
          <span class="fs-time">${t}</span>
          <span class="fs-score ${sc >= 8 ? 'sc-good' : sc >= 6 ? 'sc-warn' : 'sc-bad'}">${e.score}/10 ${sc >= 8 ? '✓' : '⚠'}</span>
        </div>`;
      const tc = div.querySelector('canvas');
      tc.getContext('2d').drawImage(e.canvas, 0, 0, 160, 90);
      div.addEventListener('click', () => {
        drawScene(feedCanvas, e.animals, false);
        drawScene(detCanvas,  e.animals, true);
        renderDetStats(e.animals);
        strip.querySelectorAll('.filmstrip-item').forEach(el => el.classList.remove('fs-active'));
        div.classList.add('fs-active');
      });
      strip.appendChild(div);
    });
  }

  // ── Detection Stats ───────────────────────────────────────
  function renderDetStats(animals) {
    const el = $('detection-stats-row');
    if (!el) return;
    const total = animals.length;
    const healthy = animals.filter(a => a.status === 'healthy').length;
    const obs     = animals.filter(a => a.status === 'observation').length;
    const flagged = animals.filter(a => a.status === 'flagged').length;
    const conf    = 85 + Math.round(Math.random() * 10);
    el.innerHTML = `
      <div class="det-stat"><div class="det-num">${total}</div><div class="det-lbl">Total Detected / कुल</div></div>
      <div class="det-stat"><div class="det-num" style="color:var(--accent-green)">${healthy}</div><div class="det-lbl">Healthy / स्वस्थ</div></div>
      <div class="det-stat"><div class="det-num" style="color:var(--accent-amber)">${obs}</div><div class="det-lbl">Observation / निगरानी</div></div>
      <div class="det-stat"><div class="det-num" style="color:var(--accent-red)">${flagged}</div><div class="det-lbl">Flagged / चिह्नित</div></div>
      <div class="det-stat"><div class="det-num">${conf}%</div><div class="det-lbl">Confidence / विश्वास</div></div>`;
  }

  // ── Countdown ─────────────────────────────────────────────
  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (!cameraOn) return;
      countdown = Math.max(0, countdown - 1);
      updateCountdownDisplay();
      if (countdown === 0) { countdown = captureIntSecs; doCapture(); }
    }, 1000);
  }

  function updateCountdownDisplay() {
    const el = $('cam-countdown');
    if (el) el.textContent = fmtCountdown(countdown);
    const lt = $('last-capture-time');
    if (lt) lt.textContent = timeAgo(lastCapture);
  }

  // ── Gemini API ────────────────────────────────────────────
  async function analyzeGemini() {
    if (!apiKey || isAnalyzing) return;
    isAnalyzing = true;
    showLoading();
    try {
      const b64 = feedCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: 'image/jpeg', data: b64 } },
              { text: 'You are a livestock health expert. Analyze this cattle surveillance image. Respond ONLY in valid JSON:\n{"animal_count":N,"species_detected":[{"species":"Cow","count":N}],"health_observations":["..."],"flagged_animals":[{"description":"...","concern":"..."}],"herd_score":N,"summary":"..."}' }
            ]}],
            generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
          })
        }
      );
      if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.error?.message || `API ${res.status}`); }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON in response');
      const result = JSON.parse(m[0]);
      showResult(result, true);
      maybeCreateAlert(result);
    } catch (err) {
      showError(err.message);
    } finally {
      isAnalyzing = false;
    }
  }

  function analyzeSimulated() {
    if (isAnalyzing) return;
    isAnalyzing = true;
    showLoading();
    setTimeout(() => {
      const a = currentAnimals;
      const flagged = a.filter(x => x.status === 'flagged');
      const hasFlag = flagged.length > 0;
      const score = hasFlag ? parseFloat((5.5 + Math.random() * 2).toFixed(1)) : parseFloat((7.8 + Math.random() * 2).toFixed(1));
      const sc = {};
      a.forEach(x => sc[x.species] = (sc[x.species] || 0) + 1);
      const result = {
        animal_count: a.length,
        species_detected: Object.entries(sc).map(([s, c]) => ({ species: s, count: c })),
        health_observations: [
          'Animals settled in pen area — posture appears normal',
          hasFlag ? 'One animal shows reduced mobility and slightly hunched posture' : 'No visible signs of distress',
          a.filter(x => x.status === 'observation').length ? 'One animal is less active than others — monitor' : 'Activity levels appropriate',
        ],
        flagged_animals: hasFlag ? [{ description: 'Animal with abnormal posture detected', concern: 'Possible early health concern — monitor for 4 hours' }] : [],
        herd_score: score,
        summary: `${a.length} livestock detected. ${hasFlag ? '⚠ One animal flagged — recommend on-site check within 24 hours.' : 'All animals appear visually healthy.'} Herd score: ${score}/10.`,
      };
      showResult(result, false);
      maybeCreateAlert(result);
      isAnalyzing = false;
    }, 1600);
  }

  // ── Result Display ────────────────────────────────────────
  function showLoading() {
    const el = $('analysis-results');
    if (el) el.innerHTML = `<div class="analysis-loading"><div class="analysis-spinner"></div><p>${apiKey ? '🧠 Asking Gemini...' : '⚙ Analyzing...'} / विश्लेषण हो रहा है</p></div>`;
  }
  function showError(msg) {
    const el = $('analysis-results');
    if (el) el.innerHTML = `<div class="analysis-error"><i class="fa-solid fa-triangle-exclamation"></i><p>Error: ${msg}</p><p style="font-size:0.74rem;color:var(--text-dim)">Check API key or network connection.</p></div>`;
  }
  function showResult(r, fromGemini) {
    const el = $('analysis-results');
    if (!el) return;
    const sc = parseFloat(r.herd_score) || 0;
    const col = sc >= 8 ? 'var(--accent-green)' : sc >= 6 ? 'var(--accent-amber)' : 'var(--accent-red)';
    const chips = (r.species_detected || []).map(s => `<span class="species-chip">${s.species === 'Cow' ? '🐄' : s.species === 'Buffalo' ? '🐃' : '🐐'} ${s.count} ${s.species}</span>`).join('');
    const flagHtml = (r.flagged_animals || []).length
      ? r.flagged_animals.map(f => `<div class="flagged-card"><div class="flagged-head"><i class="fa-solid fa-triangle-exclamation"></i> Animal Flagged / पशु चिह्नित</div><p>${f.description}</p><p class="flagged-concern">${f.concern}</p></div>`).join('')
      : `<div class="all-clear"><i class="fa-solid fa-circle-check"></i> All animals appear healthy / सभी स्वस्थ दिखते हैं</div>`;
    const obsHtml = (r.health_observations || []).map(o => `<li>${o}</li>`).join('');
    const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    el.innerHTML = `
      <div class="result-body">
        <div class="result-stats-row">
          <div class="res-stat"><div class="res-stat-icon"><i class="fa-solid fa-cow"></i></div><div class="res-stat-num">${r.animal_count || 0}</div><div class="res-stat-lbl">Animals Detected<span class="hi-label">पशु पहचाने</span></div></div>
          <div class="res-stat"><div class="res-stat-icon"><i class="fa-solid fa-heart-pulse" style="color:${col}"></i></div><div class="res-stat-num" style="color:${col}">${sc.toFixed(1)}<small>/10</small></div><div class="res-stat-lbl">Herd Score<span class="hi-label">झुंड स्कोर</span></div></div>
        </div>
        <div class="score-bar-row">
          <div class="score-bar-bg"><div class="score-bar-fill" style="width:${(sc/10)*100}%;background:${col};"></div></div>
          <span class="score-bar-val" style="color:${col}">${sc.toFixed(1)}/10</span>
        </div>
        <div class="species-chips">${chips || '<span class="species-chip">🐄 — Simulated</span>'}</div>
        <div class="flagged-section">${flagHtml}</div>
        <div class="obs-section"><h4><i class="fa-solid fa-stethoscope"></i> Observations</h4><ul class="obs-list">${obsHtml}</ul></div>
        <div class="summary-section">
          <h4><i class="fa-solid fa-robot"></i> AI Summary ${fromGemini ? '<span class="badge-gemini">Gemini</span>' : '<span class="badge-sim">Simulated</span>'}</h4>
          <p class="summary-para">${r.summary}</p>
        </div>
        <div class="analysis-ts"><i class="fa-regular fa-clock"></i> Analyzed at ${ts}</div>
      </div>`;
  }

  // ── Alert Integration ─────────────────────────────────────
  function maybeCreateAlert(result) {
    if (!(result.flagged_animals || []).length) return;
    const sc = parseFloat(result.herd_score) || 7;
    const sev = sc < 6 ? 'Critical' : 'Warning';
    result.flagged_animals.forEach((f, i) => {
      APP_DATA.alerts.unshift({
        id: `CAM${Date.now()}_${i}`, animalId: 'Visual',
        severity: sev, parameter: '📷 Camera Analysis',
        value: `Score: ${result.herd_score}/10`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        confidence: 87 + Math.round(Math.random() * 8),
        resolved: false,
        note: `${f.description}. ${f.concern}`,
      });
    });
    if (typeof AlertsModule !== 'undefined') AlertsModule.render();
    showCamToast();
  }

  const showCamToast = () => window.showToast && window.showToast('⚠ Camera detected a health concern / कैमरे ने स्वास्थ्य समस्या पकड़ी', 'warning');

  // ── API Key ───────────────────────────────────────────────
  function saveKey() {
    const inp = $('gemini-api-key-input');
    if (!inp) return;
    apiKey = inp.value.trim();
    try { localStorage.setItem('kt_gemini_key', apiKey); } catch (e) {}
    if (apiKey) inp.value = '●'.repeat(20);
    updateKeyStatus();
  }

  function updateKeyStatus() {
    const el = $('api-key-status');
    if (!el) return;
    if (apiKey) {
      el.innerHTML = '<i class="fa-solid fa-circle-check"></i> API Connected / API जुड़ा';
      el.className = 'api-key-status connected';
    } else {
      el.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Not Connected / कनेक्ट नहीं';
      el.className = 'api-key-status disconnected';
    }
    const noKey = $('no-key-prompt');
    const res   = $('analysis-results');
    if (noKey) noKey.style.display = apiKey ? 'none' : 'flex';
    if (res)   res.style.display   = 'block';
  }

  // ── Settings Init ─────────────────────────────────────────
  function initSettings() {
    const camTog = $('cam-toggle');
    if (camTog) camTog.addEventListener('change', () => {
      cameraOn = camTog.checked;
      const lb = $('camera-live-badge');
      if (lb) lb.className = 'cam-live-badge' + (cameraOn ? '' : ' offline');
      const sl = $('cam-status-label');
      if (sl) sl.textContent = cameraOn ? 'ON' : 'OFF';
    });

    const autoTog = $('auto-analysis-toggle');
    if (autoTog) autoTog.addEventListener('change', () => { autoAnalysis = autoTog.checked; });

    const intInp = $('capture-interval-input');
    if (intInp) intInp.addEventListener('change', () => {
      const v = parseInt(intInp.value);
      if (v >= 10 && v <= 3600) { captureIntSecs = v; countdown = Math.min(countdown, v); }
    });

    const locInp = $('cam-location-input');
    if (locInp) locInp.addEventListener('change', () => {
      const d = $('cam-location-display');
      if (d) d.textContent = locInp.value || 'Main Barn';
    });

    const saveKey_ = $('save-gemini-key-btn');
    if (saveKey_) saveKey_.addEventListener('click', saveKey);

    const togVis = $('toggle-key-vis-btn');
    if (togVis) togVis.addEventListener('click', () => {
      const inp = $('gemini-api-key-input');
      if (!inp) return;
      if (inp.type === 'password') { inp.type = 'text'; if (apiKey) inp.value = apiKey; }
      else { inp.type = 'password'; if (apiKey) inp.value = '●'.repeat(20); }
    });

    const capNow = $('capture-now-btn');
    if (capNow) capNow.addEventListener('click', doCapture);

    const viewAll = $('view-all-history-btn');
    if (viewAll) viewAll.addEventListener('click', () => {
      const strip = $('filmstrip');
      if (strip) strip.scrollLeft = strip.scrollWidth;
    });

    // Restore saved key
    if (apiKey) {
      const inp = $('gemini-api-key-input');
      if (inp) inp.value = '●'.repeat(20);
      updateKeyStatus();
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    feedCanvas = $('camera-feed-canvas');
    detCanvas  = $('detection-canvas');

    initSettings();

    // Draw initial idle frame (empty pen)
    if (feedCanvas) {
      const ctx = feedCanvas.getContext('2d');
      ctx.fillStyle = '#0A0A06'; ctx.fillRect(0, 0, feedCanvas.width, feedCanvas.height);
      ctx.fillStyle = '#7CB518'; ctx.font = 'bold 14px "Courier New",monospace';
      ctx.fillText('CAM-01  —  Waiting for first capture...', 20, feedCanvas.height / 2);
    }
    if (detCanvas) {
      const ctx = detCanvas.getContext('2d');
      ctx.fillStyle = '#0A0A06'; ctx.fillRect(0, 0, detCanvas.width, detCanvas.height);
      ctx.fillStyle = '#504840'; ctx.font = '13px "Courier New",monospace';
      ctx.fillText('Detection overlay will appear after first capture.', 18, detCanvas.height / 2);
    }

    startCountdown();

    // First capture after 3 seconds of entering section
    setTimeout(doCapture, 3000);
  }

  return { init };
})();
