const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = ['firebase.json','firestore.rules','firestore.indexes.json','storage.rules','functions/package.json','functions/index.js','js/core/firebase-config.js'];
const failures = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push('Missing required deployment file: ' + file);
const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
if (firebase.functions?.runtime !== 'nodejs20') failures.push('Firebase Functions runtime must remain Node.js 20.');
if (firebase.firestore?.rules !== 'firestore.rules') failures.push('Firebase Firestore rules target is missing or incorrect.');
if (firebase.storage?.rules !== 'storage.rules') failures.push('Firebase Storage rules target is missing or incorrect.');
const config = fs.readFileSync(path.join(root, 'js/core/firebase-config.js'), 'utf8');
if (/GEMINI_API_KEY/i.test(config)) failures.push('Server-side Gemini key must not be referenced by client Firebase config.');
if (/KISANTRACK_DEMO_MODE\s*[:=]\s*["']?true/i.test(config)) failures.push('Production client config must not enable demo mode.');
const functionsPackage = JSON.parse(fs.readFileSync(path.join(root, 'functions/package.json'), 'utf8'));
if (functionsPackage.engines?.node !== '20') failures.push('Functions package must pin Node.js 20.');
if (failures.length) { console.error('Production verification failed:'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('Production deployment checks passed.');
