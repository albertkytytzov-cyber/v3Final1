# iOS Signing

The iOS GitHub Actions workflow can always build an unsigned IPA artifact. A
signed IPA for TestFlight or device installation requires Apple Developer
signing assets stored in GitHub Secrets.

## Required GitHub Secrets

Add these secrets in GitHub repository settings:

- `IOS_CERTIFICATE_P12_BASE64` - base64 encoded Apple distribution certificate
  exported as `.p12`.
- `IOS_CERTIFICATE_PASSWORD` - password for the exported `.p12` certificate.
- `IOS_PROVISIONING_PROFILE_BASE64` - base64 encoded provisioning profile.
- `IOS_EXPORT_TEAM_ID` - Apple Developer Team ID.

Optional secrets:

- `IOS_BUNDLE_ID` - app bundle id. Defaults to `com.perform.training`.
- `IOS_EXPORT_METHOD` - Xcode export method. Defaults to `app-store-connect`
  for TestFlight/App Store builds. Use `ad-hoc` only when the provisioning
  profile is created for registered test devices.

## Encoding Files

On macOS, encode files before adding them to GitHub Secrets:

```bash
base64 -i ios_distribution.p12 | pbcopy
base64 -i perform.mobileprovision | pbcopy
```

Paste the copied values into the matching GitHub Secrets. Do not commit the
certificate, provisioning profile, private keys or decoded files.

## Running The Build

After the secrets are configured, open GitHub Actions and run `iOS Build`
manually. The workflow uploads:

- `perform-ios-unsigned-ipa` - unsigned build artifact.
- `perform-ios-signed-ipa` - signed build artifact, only when signing secrets
  are present.

## App Store Connect Setup

The iOS app record must exist before uploading a TestFlight build:

- App name: `PERFORM`
- Bundle ID: `com.perform.training`
- App Store Connect Apple ID: `6776354606`
- SKU used locally: `PERFORM-IOS-001`
- Internal TestFlight group: `PERFORM Internal`
- External TestFlight group: `PERFORM Athletes`

For the local Xcode-managed flow, `xcodebuild -exportArchive` can upload the
archive when the export options use `method = app-store-connect` and
`destination = upload`.

## HealthKit Privacy Strings

The iOS target has the HealthKit entitlement, so App Store Connect requires
both privacy descriptions in `apps/mobile/ios/App/App/Info.plist`:

- `NSHealthShareUsageDescription`
- `NSHealthUpdateUsageDescription`

Without `NSHealthUpdateUsageDescription`, App Store Connect rejects upload with
error `90683` even when the app mainly reads Apple Health data.

## Export Compliance

PERFORM does not use proprietary or non-standard encryption. It relies on
Apple/system networking such as HTTPS. Keep
`ITSAppUsesNonExemptEncryption = false` in the iOS `Info.plist`; otherwise App
Store Connect asks for export compliance answers on each new build.

## App Store Release Metadata

Keep these public links live on the deployed web site during App Review:

- Support URL: `https://185.195.185.67.sslip.io/support`
- Privacy Policy URL: `https://185.195.185.67.sslip.io/privacy`

Use manual release for the first App Store submission so Apple approval does
not immediately publish the app before the final coach/athlete smoke test.

## App Store Connect Status

Current production version setup:

- Version: `1.0`
- Selected App Store build: `1.0 (4)`, rejected by App Review on
  `2026-06-04`.
- Fixed App Store build uploaded after rejection: `1.0 (5)` on
  `2026-06-04 22:35 Europe/Bucharest`; App Store Connect reported the upload
  succeeded and the package started processing.
- App Review submission: sent on `2026-06-04 00:35` with submission ID
  `74cd5191-5c95-4cf1-b033-90df3c3c3696`.
- App Review status at follow-up check: rejected with unresolved issues.
- Rejection fixes:
  - `Guideline 2.3.8`: replaced the placeholder-looking iOS app icon with a
    finalized opaque 1024x1024 RGB icon.
  - `Guideline 2.1(a)`: verified the production review account login against
    `https://185.195.185.67.sslip.io/api/v1` and reset the App Review account
    password locally in `.codex-local/ios/app-review.env`.
- The uploaded archive is still iPhone-only: `UIDeviceFamily = [1]`.
- Release mode: manual release after App Review approval.
- Pricing: free in all countries and regions.
- Availability: all countries and regions.
- Device availability: iPhone/iOS only. Mac with Apple silicon and Apple
  Vision Pro availability are disabled until those targets are tested.
- Primary category: Sports.
- Secondary category: Health and Fitness.
- Age rating: 9+ with regional exceptions shown by App Store Connect.
- Regulated medical device: no.
- App Privacy: published with name, email, health, fitness, user content, and
  user ID used for app functionality only.
- TestFlight: external group `PERFORM Athletes` has build `1.0 (3)` submitted
  to TestFlight Beta Review. Build `1.0 (4)` is the iPhone-only production
  build submitted to App Review.

Prepared screenshot assets are stored locally here:

```text
app-store-assets/screenshots-iphone-65/
```

They are 6.5-inch iPhone screenshots at `1242 x 2688` PNG and can be reused
for future metadata updates.

Remaining App Store follow-up items:

- Complete EU Digital Services Act account information in App Store Connect
  under Business. This requires the real legal/trader status and account
  contact details and should not be guessed.
- Optionally add accessibility labels only after a real accessibility check.
  Do not claim support for VoiceOver, large text, contrast, or other features
  until they are verified.
