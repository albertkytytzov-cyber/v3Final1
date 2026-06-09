# App Store Review Response 2026-06-09

## Issue

Apple rejected PERFORM iOS `1.0 (6)` under Guideline 2.1(a):

- App Review could not establish a connection to the server.
- Review devices: iPhone 17 Pro Max and iPad Air 11-inch (M4).

## Root Cause

The production API was healthy, but the generated iOS Capacitor bundle still contained an old mobile API URL:

- Wrong: `https://127.0.0.1.sslip.io/api/v1`
- Correct: `https://185.195.185.67.sslip.io/api/v1`

This meant the App Store build could try to connect to a local/review-device address instead of the PERFORM production API.

## Fix

- Re-synced iOS mobile assets with the production API URL.
- Added a production fallback URL in the mobile asset builder.
- Added `check:mobile-release-config`, which fails when mobile release config uses `localhost`, `127.0.0.1`, `http://`, an empty API URL, or a URL different from production.
- Added this check to the main `npm test` chain.
- Bumped iOS build from `1.0 (6)` to `1.0 (7)`.
- Built and uploaded `1.0 (7)` to App Store Connect.

## Verification

- `curl https://185.195.185.67.sslip.io/api/v1/health` returns `200`.
- TLS certificate is valid and issued by Let's Encrypt.
- iOS archive `1.0 (7)` contains `public/mobile-config.js` with `https://185.195.185.67.sslip.io/api/v1`.
- Review account login succeeds against production API:
  - Email: `apple-review@perform.training`
  - Role: `coach`
  - Session token returned: yes
- Checks passed:
  - `npm run check:mobile-release-config`
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Reply Draft

Hello App Review team,

Thank you for the review. We found and fixed the server connection issue.

Build `1.0 (6)` contained a stale generated iOS mobile configuration that pointed to `https://127.0.0.1.sslip.io/api/v1` instead of the production PERFORM API. The production API is available at `https://185.195.185.67.sslip.io/api/v1` and uses a valid Let's Encrypt TLS certificate.

We rebuilt and re-synced the iOS bundle, added a release guard that prevents localhost/127.0.0.1/HTTP/empty API URLs from being used in iOS or Android release bundles, verified the production health endpoint, and verified the App Review login account successfully.

We uploaded a new build, `1.0 (7)`, with the corrected production API configuration. Please review the new build.

Test account:

- Email: `apple-review@perform.training`
- Password: `PerformReview2026!`

Best regards,
Vasiliy Tatarli
