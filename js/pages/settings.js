// KisanTrack — Phase 8 Settings & Product Polish
var SettingsModule = (function () {
  'use strict';
  let currentUser = null;
  let preferences = { browserNotifications: false, onboardingComplete: false };
  function el(id) { return document.getElementById(id); }

  async function loadPreferences() {
    if (!currentUser) return;
    const snap = await db.collection('userPreferences').doc(currentUser.uid).get();
    if (snap.exists) preferences = { ...preferences, ...snap.data() };
    updatePreferenceUI();
  }

  function updatePreferenceUI() {
    const notifications = el('pref-notifications');
    if (notifications) notifications.checked = preferences.browserNotifications === true;
    const onboarding = el('onboarding-status');
    if (onboarding) onboarding.textContent = preferences.onboardingComplete ? 'Completed' : 'Not completed';
  }

  async function toggleNotifications() {
    const enabled = el('pref-notifications').checked;
    if (enabled && !('Notification' in window)) {
      el('pref-notifications').checked = false;
      showToast('Browser notifications are not supported here.', 'warning');
      return;
    }
    if (enabled && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        el('pref-notifications').checked = false;
        showToast('Notification permission was not granted.', 'warning');
        return;
      }
    }
    try {
      await saveUserPreference('browserNotifications', enabled);
      preferences.browserNotifications = enabled;
      await recordAudit('notification_preference_changed', { enabled });
      showToast(enabled ? 'Browser notifications enabled.' : 'Browser notifications disabled.');
    } catch (err) {
      el('pref-notifications').checked = !enabled;
      showToast('Could not save notification preference.', 'error');
    }
  }

  async function completeOnboarding() {
    await saveUserPreference('onboardingComplete', true);
    preferences.onboardingComplete = true;
    updatePreferenceUI();
    await recordAudit('onboarding_completed');
    showToast('Onboarding marked complete.');
  }

  async function registerDevice() {
    const deviceId = localStorage.getItem('kisan:deviceId') || crypto.randomUUID();
    localStorage.setItem('kisan:deviceId', deviceId);
    await db.collection('devices').doc(deviceId).set({
      farmerId: currentUser.uid,
      label: 'This browser',
      userAgent: navigator.userAgent.slice(0, 300),
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      revoked: false
    }, { merge: true });
  }

  async function loadDevices() {
    const list = el('device-list');
    if (!list || !currentUser) return;
    try {
      const snap = await db.collection('devices').where('farmerId', '==', currentUser.uid).get();
      if (snap.empty) {
        list.innerHTML = '<p class="settings-muted">No registered devices yet.</p>';
        return;
      }
      const currentId = localStorage.getItem('kisan:deviceId');
      list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const current = doc.id === currentId;
        return '<div class="settings-row"><div><strong>' + window.escapeHtml(d.label || 'Browser device') +
          '</strong><div class="settings-muted">' + (current ? 'Current device · ' : '') +
          window.escapeHtml(d.userAgent || 'Unknown browser') +
          '</div></div><span class="settings-pill">' + (d.revoked ? 'Revoked' : 'Active') + '</span></div>';
      }).join('');
    } catch (err) {
      list.innerHTML = '<p class="settings-muted">Device information is temporarily unavailable.</p>';
    }
  }

  async function requestDataAction(type) {
    const fn = firebase.app().functions('asia-south1').httpsCallable('requestDataAction');
    try {
      const result = await fn({ type });
      await recordAudit('data_' + type + '_requested', { requestId: result.data.requestId });
      showToast(result.data.message || 'Request recorded.');
    } catch (err) {
      showToast('Could not record the request. Please try again.', 'error');
    }
  }

  async function clearLocalState() {
    ['kisan:onboarding:profile', 'kisan:onboarding:animals', 'kisan:onboarding:alerts', 'kisan:onboarding:veterinary']
      .forEach(key => localStorage.removeItem(key));
    await recordAudit('local_preferences_reset');
    showToast('Local onboarding state reset.');
  }

  async function loadAuditLogs() {
    const list = el('audit-list');
    if (!list || !currentUser) return;
    try {
      const snap = await db.collection('auditLogs').where('farmerId', '==', currentUser.uid).orderBy('timestamp', 'desc').limit(20).get();
      list.innerHTML = snap.empty ? '<p class="settings-muted">No audit activity yet.</p>' :
        snap.docs.map(doc => {
          const d = doc.data();
          return '<div class="settings-row"><div><strong>' + window.escapeHtml(d.action || 'Activity') +
            '</strong><div class="settings-muted">' + window.escapeHtml(formatTimestamp(d.timestamp)) +
            '</div></div></div>';
        }).join('');
    } catch (err) {
      list.innerHTML = '<p class="settings-muted">Audit history is temporarily unavailable.</p>';
    }
  }

  function bind() {
    el('pref-notifications')?.addEventListener('change', toggleNotifications);
    el('btn-onboarding-complete')?.addEventListener('click', completeOnboarding);
    el('btn-reset-local')?.addEventListener('click', clearLocalState);
    el('btn-export-data')?.addEventListener('click', () => requestDataAction('export'));
    el('btn-delete-account')?.addEventListener('click', () => {
      if (confirm('Request account deletion? This records a deletion request for review.')) requestDataAction('deletion');
    });
  }

  async function init() {
    bind();
    document.addEventListener('kisanTrack:authReady', e => start(e.detail?.user), { once: true });
    if (firebase.auth().currentUser) start(firebase.auth().currentUser);
  }

  async function start(user) {
    currentUser = user;
    try {
      await registerDevice();
      await Promise.all([loadPreferences(), loadDevices(), loadAuditLogs()]);
      await recordAudit('settings_opened');
    } catch (err) {
      if (window.recordClientTelemetry) window.recordClientTelemetry('settings_load_failed', err?.message || 'settings load failed', 'warning');
    }
  }

  return { init };
})();