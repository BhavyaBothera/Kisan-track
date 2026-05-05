const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_FILE = "serviceAccountKey.json";
const serviceAccount = require(path.join(process.cwd(), SERVICE_ACCOUNT_FILE));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function listBuckets() {
  try {
    const [buckets] = await admin.storage().getBuckets();
    console.log("Available Buckets:");
    buckets.forEach(b => console.log(` - ${b.name}`));
  } catch (err) {
    console.error("Error listing buckets:", err);
  }
}

listBuckets().then(() => process.exit(0));
