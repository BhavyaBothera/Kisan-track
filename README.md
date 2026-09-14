# KisanTrack

Static Firebase dashboard for managing animal health data.

## Setup

1. Configure Firebase Authentication (email/password and Google) for the Firebase project in `js/core/firebase-config.js`.
2. Install the Firebase CLI and deploy the access controls and indexes:
   ```sh
   firebase use kisan-track
   firebase deploy --only firestore
   ```
3. Serve this folder using a local web server; do not open the HTML files directly.

## Data contracts

Imports accept CSV or JSON records. The selected category determines the Firestore collection: `vitals`, `inventory`, `vet_logs`, or `animals`. Every imported record is tagged with the signed-in user's `farmerId`.

The vitals screen is read-only. It never creates synthetic sensor readings or alerts.

## Production boundary

The camera page can call Gemini directly only when a user supplies a browser-local API key. Before a production release, move that operation behind an authenticated server-side endpoint (such as a Firebase Cloud Function) and keep the provider key exclusively in server-side secrets. Do not set `KISANTRACK_DEMO_MODE` in a production deployment.
