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
- `IOS_EXPORT_METHOD` - Xcode export method. Defaults to `app-store` for
  TestFlight/App Store builds. Use `ad-hoc` only when the provisioning profile
  is created for registered test devices.

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
