# KisanTrack

Static Firebase dashboard for managing animal health data.

## Setup

1. Configure Firebase Authentication (email/password and Google) for the Firebase project in `js/core/firebase-config.js`.
2. Install the Firebase CLI and deploy the access controls and indexes:
   ```sh
   firebase use kisan-track
   firebase deploy --only firestore
   ```
3. Deploy Firebase Functions as well as Firestore/Storage rules for production behavior:\n   ```sh\n   firebase deploy --only functions,firestore,storage\n   ```\n4. Serve this folder using a local web server; do not open the HTML files directly.

## Data contracts

Imports accept CSV or JSON records. The selected category determines the Firestore collection: `vitals`, `inventory`, `vet_logs`, or `animals`. Every imported record is tagged with the signed-in user's `farmerId`.

The vitals screen is read-only. It never creates synthetic sensor readings or alerts.

## Privacy, retention and AI boundary

Camera images are processed through the authenticated server-side Firebase Function and the Gemini provider key is kept in server-side secrets. Camera captures are configured for a 3-day retention period and are removed by the scheduled cleanup function after deployment.

AI output is an AI-assisted visual screening signal, not a veterinary diagnosis. Review concerning findings with a qualified veterinarian.

Operational client errors may be recorded in the private `clientTelemetry` collection for troubleshooting. AI request/success counters are stored in the private `systemMetrics` collection.

See `privacy.html` for the user-facing privacy and AI-processing disclosure. Do not set `KISANTRACK_DEMO_MODE` in a production deployment.
