const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'scratch'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, predicate));
    else if (predicate(full)) results.push(full);
  }
  return results;
}

const htmlFiles = walk(ROOT, file => file.endsWith('.html'));
const jsFiles = walk(ROOT, file => file.endsWith('.js'));
const protectedPages = htmlFiles.filter(file =>
  !['index.html', 'login.html', '404.html', 'privacy.html'].includes(path.basename(file))
);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('Phase 6 runner is operational', () => assert.ok(true));

test('scratch workspace is removed from the repository', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'scratch')), false);
});

test('all JavaScript files pass Node syntax parsing', () => {
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, path.relative(ROOT, file) + ' failed syntax check:\n' + result.stderr);
  }
});

test('protected pages include the centralized authentication guard', () => {
  for (const file of protectedPages) {
    const source = read(file);
    assert.match(source, /js\/core\/auth\.js/, path.basename(file) + ' is missing core auth.js');
  }
});

test('protected pages do not use inline event handlers', () => {
  for (const file of protectedPages) {
    const source = read(file);
    const handlers = source.match(/\son[a-z]+\s*=\s*/gi) || [];
    assert.equal(handlers.length, 0, path.basename(file) + ' contains inline handlers: ' + handlers.join(', '));
  }
});

test('all HTML documents declare a mobile viewport', () => {
  for (const file of htmlFiles) {
    assert.match(read(file), /<meta[^>]+name=["']viewport["'][^>]+content=/i, path.basename(file) + ' has no viewport meta tag');
  }
});

test('all images have alternative text', () => {
  for (const file of htmlFiles) {
    const missing = read(file).match(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi) || [];
    assert.equal(missing.length, 0, path.basename(file) + ' has images without alt text');
  }
});

test('all buttons have an accessible name', () => {
  for (const file of htmlFiles) {
    const source = read(file);
    for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
      const attrs = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').replace(/&[a-z0-9#]+;/gi, ' ').trim();
      const named = text || /\baria-label\s*=|\btitle\s*=/i.test(attrs);
      assert.ok(named, path.basename(file) + ' contains an unnamed button: ' + match[0].slice(0, 160));
    }
  }
});

test('no committed source contains obvious private credentials', () => {
  const files = walk(ROOT, file => /\.(js|html|json|rules|md|css)$/.test(file));
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:GEMINI|GOOGLE|RAZORPAY|FREELLM|ANTHROPIC)[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|TOKEN|KEY)\s*[:=]\s*["'][^"']{12,}/i,
    /\bsk-[A-Za-z0-9]{20,}/
  ];
  for (const file of files) {
    const source = read(file);
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(source, pattern, path.relative(ROOT, file) + ' matches ' + pattern);
    }
  }
});

test('Firestore rules require authentication and preserve farmer ownership', () => {
  const rules = read(path.join(ROOT, 'firestore.rules'));
  assert.match(rules, /function signedIn\(\)\s*\{\s*return request\.auth != null;\s*\}/);
  assert.match(rules, /function ownsNew\(\).*request\.resource\.data\.farmerId == request\.auth\.uid/s);
  assert.match(rules, /function ownsExisting\(\).*resource\.data\.farmerId == request\.auth\.uid/s);
  assert.match(rules, /function ownerUnchanged\(\).*request\.resource\.data\.farmerId == resource\.data\.farmerId/s);
  assert.match(rules, /match \/systemMetrics\/\{id\}[\s\S]*allow read, write: if false;/);
  assert.match(rules, /match \/cameraCaptures\/\{id\}[\s\S]*allow create, update, delete: if false;/);
  assert.match(rules, /match \/clientTelemetry\/\{id\}[\s\S]*request\.resource\.data\.message\.size\(\) <= 500/);
});

test('Storage rules enforce owner-scoped image uploads and a 10 MB limit', () => {
  const rules = read(path.join(ROOT, 'storage.rules'));
  assert.match(rules, /request\.auth != null && request\.auth\.uid == userId/);
  assert.match(rules, /request\.resource\.size <= 10 \* 1024 \* 1024/);
  assert.match(rules, /request\.resource\.contentType\.matches\('image\/\.\*'\)/);
  assert.match(rules, /match \/\{allPaths=\*\*\} \{ allow read, write: if false; \}/);
});

test('camera analysis validates authentication, image type and size before AI processing', () => {
  const source = read(path.join(ROOT, 'js/pages/camera.js'));
  assert.match(source, /firebase\.auth\(\)\.currentUser/);
  assert.match(source, /blob\.type\.startsWith\('image\/'\)/);
  assert.match(source, /blob\.size > 10 \* 1024 \* 1024/);
  assert.match(source, /httpsCallable\('analyzeAnimalImage'\)/);
  assert.match(source, /!doc \|\| !doc\.id \|\| !doc\.imagePath/);
});

test('camera rendering escapes Firestore-derived values before HTML interpolation', () => {
  const source = read(path.join(ROOT, 'js/pages/camera.js'));
  assert.match(source, /escapeHtml\(item\.imageUrl/);
  assert.match(source, /escapeHtml\(item\.animalId/);
  assert.match(source, /escapeHtml\(a\.animalId\)/);
  assert.match(source, /escapeHtml\(a\.breed \|\| a\.species\)/);
  assert.match(source, /escapeHtml\(a\.status\)/);
});

test('camera regression contract keeps delegated capture navigation', () => {
  const source = read(path.join(ROOT, 'js/pages/camera.js'));
  assert.match(source, /addEventListener\(['"]click['"],\s*\(event\) =>/);
  assert.match(source, /closest\('\[data-capture-id\]'\)/);
  assert.match(source, /loadCapture\(item\.dataset\.captureId\)/);
});

test('camera timeout and Firebase failure paths expose friendly errors', () => {
  const source = read(path.join(ROOT, 'js/pages/camera.js'));
  assert.match(source, /AbortError/);
  assert.match(source, /functions\/not-found/);
  assert.match(source, /functions\/unauthenticated/);
  assert.match(source, /friendlyError/);
});

test('Firestore store exposes the core CRUD/read APIs used by page modules', () => {
  const source = read(path.join(ROOT, 'js/core/firestore-store.js'));
  for (const api of ['addAnimal', 'resolveAlert', 'getAnimalById', 'getUnresolvedAlerts', 'unsubscribeAll']) {
    assert.match(source, new RegExp(api));
  }
});

test('Firestore store prevents duplicate animal identifiers and strips client-only fields', () => {
  const source = read(path.join(ROOT, 'js/core/firestore-store.js'));
  assert.match(source, /This Animal ID already exists/);
  assert.match(source, /delete payload\.id/);
  assert.match(source, /delete payload\.vitals/);
  assert.match(source, /farmerId:\s*STATE\.initializedUid/);
});

test('telemetry writes are bounded by the Firestore rules contract', () => {
  const rules = read(path.join(ROOT, 'firestore.rules'));
  assert.match(rules, /eventType\.size\(\) <= 80/);
  assert.match(rules, /severity in \['error', 'warning', 'info'\]/);
  assert.match(rules, /message\.size\(\) <= 500/);
});

test('package test command targets the Phase 6 suite', () => {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  assert.equal(pkg.scripts?.test, 'node --test tests/phase6.test.js');
  assert.match(pkg.engines?.node || '', />=20/);
});
