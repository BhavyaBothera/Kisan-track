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

Imports accept CSV or JSON records. The selected category determines the Firestore collection: `vitals`, `inventory`, `veterinaryLogs`, or `animals`. Every imported record is tagged with the signed-in user's `farmerId`.

The vitals screen is read-only. It never creates synthetic sensor readings or alerts.
