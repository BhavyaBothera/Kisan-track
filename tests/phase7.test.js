const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Phase 7 package exposes the verification pipeline', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.lint, 'eslint .');
  assert.match(pkg.scripts['format:check'], /^prettier --check/);
  assert.equal(pkg.scripts.verify, 'npm run lint && npm run format:check && npm test && npm run verify:production');
  assert.ok(pkg.devDependencies.eslint); assert.ok(pkg.devDependencies.prettier);
});

test('ESLint blocks dangerous JavaScript constructs', () => { const c=read('eslint.config.js'); for(const r of ['no-debugger','no-eval','no-implied-eval','no-new-func']) assert.match(c,new RegExp(r)); });

test('formatter ignores generated and dependency directories', () => { const c=read('.prettierignore'); for(const x of ['node_modules/','.git/','scratch/','assets/']) assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'))); });

test('production verifier checks deployment contracts', () => { const c=read('scripts/verify-production.js'); for(const x of ['firebase.json','firestore.rules','firestore.indexes.json','storage.rules','functions/package.json','nodejs20','KISANTRACK_DEMO_MODE']) assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'))); });

test('Phase 7 CI defines quality, staging and production gates', () => { const c=read('.github/workflows/phase7.yml'); for(const x of ['npm ci','npm run verify','npm audit','firebase-tools','FIREBASE_SERVICE_ACCOUNT_KISANTRACK','staging','production']) assert.match(c,new RegExp(x.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'))); });

test('Phase 6 regression remains part of the pipeline', () => { assert.ok(fs.existsSync(path.join(ROOT,'tests/phase6.test.js'))); assert.ok(fs.existsSync(path.join(ROOT,'.github/workflows/phase6.yml'))); });
