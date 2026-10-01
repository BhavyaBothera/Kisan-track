# KisanTrack

Static Firebase dashboard for managing animal health data.

## Setup

1. Configure Firebase Authentication (email/password and Google) for the Firebase project in `js/core/firebase-config.js`.
2. Install the Firebase CLI and deploy the access controls and indexes:
   ```sh
   firebase use kisan-track
   firebase deploy --only firestore
   ```
3. Deploy Firebase Functions as well as Firestore/Storage rules for production behavior:
   ```sh
   firebase deploy --only functions,firestore,storage
   ```
4. Serve this folder using a local web server; do not open the HTML files directly.

## Data contracts

Imports accept CSV or JSON records. The selected category determines the Firestore collection: `vitals`, `inventory`, `vet_logs`, or `animals`. Every imported record is tagged with the signed-in user's `farmerId`.

The vitals screen is read-only. It never creates synthetic sensor readings or alerts.

## Privacy, retention and AI boundary

Camera images are processed through the authenticated server-side Firebase Function and the Gemini provider key is kept in server-side secrets. Camera captures are configured for a 3-day retention period and are removed by the scheduled cleanup function after deployment.

AI output is an AI-assisted visual screening signal, not a veterinary diagnosis. Review concerning findings with a qualified veterinarian.

Operational client errors may be recorded in the private `clientTelemetry` collection for troubleshooting. AI request/success counters are stored in the private `systemMetrics` collection.

See `privacy.html` for the user-facing privacy and AI-processing disclosure. Do not set `KISANTRACK_DEMO_MODE` in a production deployment.


## Phase 8 product controls

- **Settings & Privacy** provides browser notification preferences, onboarding completion, device registry visibility, privacy/data-action requests, and recent audit activity.
- **Offline handling** displays an explicit connection-state banner instead of silently presenting stale connectivity as healthy.
- **Notifications** use the browser Notification API only after the user enables the preference and grants permission; critical alert notifications are deduplicated per alert.
- **Veterinary workflow** records an explicit visit date and optional follow-up/next-due date; stored timeline text is escaped before HTML rendering.
- **Device management** registers the current browser as an account-owned device record. It does not claim to revoke Firebase authentication sessions.
- **Audit logs** are user-scoped product activity records and are not presented as tamper-proof security logs.
- **Privacy actions** record export/deletion requests through the authenticated `requestDataAction` callable; fulfillment remains a backend/admin workflow.
