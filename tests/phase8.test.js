const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Phase 8 settings surface exists and is authenticated', () => {
  const html = read('settings.html');
  assert.match(html, /Settings & Privacy/);
  assert.match(html, /js\\/core\\/auth\\.js/);
  assert.match(html, /js\\/pages\\/settings\\.js/);
});

test('Phase 8 shared utilities provide offline, notification and audit infrastructure', () => {
  const source = read('js/core/utils.js');
  ['installOfflineHandling', 'setupNotificationInfrastructure', 'saveUserPreference', 'recordAudit'].forEach(name => assert.ok(source.includes(name), name + ' is missing'));
});

test('Phase 8 settings provides notification, device and privacy controls', () => {
  const source = read('js/pages/settings.js');
  ['Notification.requestPermission', 'devices', 'requestDataAction', 'auditLogs', 'onboardingComplete'].forEach(token => assert.ok(source.includes(token), token + ' is missing'));
});

test('Phase 8 data controls use the authenticated callable', () => {
  const source = read('js/pages/settings.js');
  assert.ok(source.includes("httpsCallable('requestDataAction')"));
  assert.ok(source.includes("requestDataAction('export')"));
  assert.ok(source.includes("requestDataAction('deletion')"));
});

test('Veterinary workflow supports explicit visit and follow-up dates', () => {
  const html = read('veterinary.html');
  const js = read('js/pages/veterinary.js');
  assert.match(html, /id="form-visit-date"/);
  assert.match(html, /id="form-next-due"/);
  assert.match(js, /nextDueDate/);
  assert.match(js, /form-visit-date/);
});

test('Veterinary timeline escapes stored text before HTML rendering', () => {
  const source = read('js/pages/veterinary.js');
  ['escapeHtml(log.diagnosis', 'escapeHtml(log.animalId', 'escapeHtml(log.treatment', 'escapeHtml(log.vet'].forEach(token => assert.ok(source.includes(token), token + ' is missing'));
});

test('Firestore rules isolate Phase 8 user-owned data', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /match \/userPreferences\/\{userId\}/);
  assert.match(rules, /match \/devices\/\{id\}/);
  assert.match(rules, /match \/auditLogs\/\{id\}/);
  assert.match(rules, /match \/dataRequests\/\{id\}/);
  assert.match(rules, /request\.auth\.uid == userId/);
});

test('Phase 8 docs describe product controls and limitations', () => {
  const readme = read('README.md');
  ['Settings & Privacy', 'offline handling', 'Audit logs', 'Device management'].forEach(token => assert.match(readme, new RegExp(token, 'i')));
});