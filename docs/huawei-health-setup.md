# Huawei Health Android setup

For the Huawei Band 11 Pro device-specific test plan, see
`docs/huawei-band-11-pro-test-plan.md`.

This project reads Huawei Health data through the Android app. Do not collect or store the user's Huawei login and password on the server.

Required Huawei/AppGallery setup:

1. Create or open the Android app in AppGallery Connect with package name `com.perform.training`.
2. Add the signing certificate fingerprint that matches the Android build used for testing or release.
3. Enable Health Kit and Account Kit for the app.
4. Apply for the read permissions used by the app:
   - sleep
   - heart rate
   - activity
   - activity records
   - distance
   - calories
5. Download `agconnect-services.json` from AppGallery Connect.
6. Put the file at `apps/mobile/android/app/agconnect-services.json`.
7. Build and sync the mobile app.

Current Android identity for the local test build:

- Package name: `com.perform.training`.
- Version: `1.0.23`.
- Debug signing certificate:
  - SHA-1: `B8:AC:4A:15:EC:73:72:95:E8:EC:BF:BC:D4:89:7B:00:4E:EE:FD:08`
  - SHA-256: `8F:E3:8C:5C:AD:5B:28:5C:54:49:61:E3:1B:4D:AA:2A:76:91:D2:E1:55:D5:44:2D:72:FE:97:8C:52:59:4E:31`

After downloading `agconnect-services.json`, install it with:

```bash
scripts/install-huawei-agconnect.sh ~/Downloads/agconnect-services.json
```

The script validates that the file targets `com.perform.training`, copies it to
`apps/mobile/android/app/agconnect-services.json`, and runs the readiness
check. The file is intentionally ignored by git.

Readiness check before device testing:

```bash
scripts/check-huawei-watch-readiness.sh
```

The check reports:

- whether `agconnect-services.json` is present in the Android app;
- whether the Android phone is visible through `adb`;
- whether HMS Core (`com.huawei.hwid`) is installed when the phone exposes it;
- whether Huawei Health (`com.huawei.health`) is installed;
- whether PERFORM (`com.perform.training`) is installed.
- whether Huawei watches are visible in Android Bluetooth diagnostics.

Current Huawei Android implementation:

- The native `HuaweiHealth` Capacitor plugin reports whether the build has
  AppGallery Connect config before it tries to authorize Health Kit.
- If `agconnect-services.json` is missing, the app shows a specific setup
  error instead of a generic Huawei failure.
- On non-Huawei Android phones, a separate `com.huawei.hwid` package may be
  absent while Huawei Health still runs its own health/device services. Treat
  missing `com.huawei.hwid` as diagnostic context, not an automatic blocker.
- The first data read path is Huawei Health Kit:
  - sleep summary;
  - resting/continuous heart-rate summary;
  - workout/activity records;
  - distance;
  - calories;
  - workout duration.
- SpO2, HRV/stress and detailed workout graphs are not treated as done until
  we verify the exact Huawei Health Kit data types exposed by the Band 11 Pro.
- While Health Kit is blocked by missing `agconnect-services.json`, Android
  Health Connect can be used as a fallback probe. PERFORM accepts
  `com.huawei.health` as a supported Health Connect source and shows whether
  Huawei-origin records are present in diagnostics.

The app reads only daily summaries requested by the athlete from the device. Synced summaries are sent to the platform API under the authenticated athlete account.
