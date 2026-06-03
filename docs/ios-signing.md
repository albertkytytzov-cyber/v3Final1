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
