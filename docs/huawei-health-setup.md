# Huawei Health Android setup

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

The app reads only daily summaries requested by the athlete from the device. Synced summaries are sent to the platform API under the authenticated athlete account.
