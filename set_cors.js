const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_FILE = "serviceAccountKey.json";
const serviceAccount = require(path.join(process.cwd(), SERVICE_ACCOUNT_FILE));

// Try to get bucket name from project ID
const projectId = serviceAccount.project_id;
const bucketsToTry = [
  `${projectId}.firebasestorage.app`,
  `${projectId}.appspot.com`,
  projectId
];

async function run() {
  for (const bName of bucketsToTry) {
    console.log(`🚀 Trying bucket: ${bName}...`);
    
    // Reset admin app for each attempt to change storageBucket
    if (admin.apps.length) await admin.app().delete();
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bName
    });

    const bucket = admin.storage().bucket();
    const corsConfiguration = [{
      origin: ['*'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: ['Content-Type', 'Authorization', 'x-goog-resumable'],
      maxAgeSeconds: 3600
    }];

    try {
      await bucket.setCorsConfiguration(corsConfiguration);
      console.log(`✅ SUCCESS! CORS set for ${bName}`);
      process.exit(0);
    } catch (err) {
      console.warn(`⚠ Failed for ${bName}: ${err.message}`);
    }
  }
  
  console.error("❌ Could not find a valid bucket to set CORS.");
  process.exit(1);
}

run();
