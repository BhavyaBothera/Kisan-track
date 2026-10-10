const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('Phase 8 settings surface exists and is authenticated', () => {
  const html = read('settings.html');
  assert.ok(html.includes('Settings & Privacy'));
  assert.ok(html.includes('js/core/auth.js'));
  assert.ok(html.includes('js/pages/settings.js'));
});

test('shared utilities provide offline, notification and audit infrastructure', () => {
  const source = read('js/core/utils.js');
  for (const name of ['installOfflineHandling', 'setupNotificationInfrastructure', 'saveUserPreference', 'recordAudit']) {
    assert.ok(source.includes(name), name + ' is missing');
  }
});

test('settings provides notification, device and privacy controls', () => {
  const source = read('js/pages/settings.js');
  for (const token of ['Notification.requestPermission', 'devices', 'requestDataAction', 'auditLogs', 'onboardingComplete']) {
    assert.ok(source.includes(token), token + ' is missing');
  }
});

test('data controls use the authenticated callable', () => {
  const source = read('js/pages/settings.js');
  assert.ok(source.includes("httpsCallable('requestDataAction')"));
  assert.ok(source.includes("requestDataAction('export')"));
  assert.ok(source.includes("requestDataAction('deletion')"));
});

test('veterinary workflow supports explicit visit and follow-up dates', () => {
  const html = read('veterinary.html');
  const js = read('js/pages/veterinary.js');
  assert.ok(html.includes('id="form-visit-date"'));
  assert.ok(html.includes('id="form-next-due"'));
  assert.ok(js.includes('nextDueDate'));
  assert.ok(js.includes('form-visit-date'));
});

test('veterinary timeline escapes stored text before HTML rendering', () => {
  const source = read('js/pages/veterinary.js');
  for (const token of ['escapeHtml(log.diagnosis', 'escapeHtml(log.animalId', 'escapeHtml(log.treatment', 'escapeHtml(log.vet']) {
    assert.ok(source.includes(token), token + ' is missing');
  }
});

test('Firestore rules isolate Phase 8 user-owned data', () => {
  const rules = read('firestore.rules');
  for (const token of [
    'match /userPreferences/{userId}',
    'match /devices/{id}',
    'match /auditLogs/{id}',
    'match /dataRequests/{id}',
    'request.auth.uid == userId'
  ]) assert.ok(rules.includes(token), token + ' is missing');
});

test('docs describe product controls and limitations', () => {
  const readme = read('README.md');
  for (const token of ['Settings & Privacy', 'offline handling', 'Audit logs', 'Device management']) {
    assert.ok(readme.toLowerCase().includes(token.toLowerCase()), token + ' is missing');
  }
});

test('user preference rules permit owner reads and validate writable preference types', () => {
  const rules = read('firestore.rules');
  const start = rules.indexOf('match /userPreferences/{userId}');
  const end = rules.indexOf('\n    }', start);
  const block = start >= 0 && end >= 0 ? rules.slice(start, end) : '';
  assert.ok(block.includes('allow read: if signedIn() && request.auth.uid == userId'));
  assert.ok(block.includes('request.resource.data.browserNotifications is bool'));
  assert.ok(block.includes('request.resource.data.onboardingComplete is bool'));
});

test('AI callable prevents capture ID reuse and enforces a daily server-side quota', () => {
  const source = read('functions/index.js');
  for (const token of ['transaction.get(captureRef)', 'transaction.create(captureRef', 'captureSnap.exists', 'resource-exhausted', 'used >= 20', 'aiRateLimits']) {
    assert.ok(source.includes(token), token + ' is missing');
  }
});

test('production deployment is manual, protected and performs a Firebase deploy', () => {
  const workflow = read('.github/workflows/phase7.yml');
  assert.ok(workflow.includes('workflow_dispatch'));
  assert.ok(workflow.includes('inputs.deploy_production == true'));
  assert.ok(workflow.includes('name: production'));
  assert.ok(workflow.includes('firebase deploy --project "$FIREBASE_PROJECT_ID" --only functions,firestore,storage --non-interactive'));
  assert.ok(!workflow.includes('cache: npm'));
});

test('production verifier checks Firebase Functions JavaScript syntax', () => {
  const source = read('scripts/verify-production.js');
  assert.ok(source.includes('--check'));
  assert.ok(source.includes('functions/index.js'));
});
