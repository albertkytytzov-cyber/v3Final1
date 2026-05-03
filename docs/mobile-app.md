# Mobile App

This project uses Capacitor to package the existing PERFORM web app for Android and iOS.

The current mobile setup is temporary: the native app loads the deployed web app through `MOBILE_SERVER_URL`. Keep that URL in a local ignored file and do not commit real server addresses if the repository is public.

## Local Configuration

Copy the safe example:

```bash
cp apps/mobile/mobile.env.example apps/mobile/.env.mobile.local
```

Set:

```bash
MOBILE_SERVER_URL=https://your-current-server.example.com
```

Use HTTPS for real devices. Session cookies and PWA features are not reliable over plain HTTP.

## Sync Native Projects

After changing `MOBILE_SERVER_URL` or web/native configuration:

```bash
npm run mobile:sync
```

Android only:

```bash
npm run mobile:sync:android
```

iOS only:

```bash
npm run mobile:sync:ios
```

## Open Native Projects

Android requires Android Studio:

```bash
npm run mobile:open:android
```

iOS requires Xcode on macOS:

```bash
npm run mobile:open:ios
```

## Release Notes

- Android can be prepared on Windows with Android Studio.
- iOS needs Xcode/macOS or a cloud build pipeline for signing and App Store/TestFlight delivery.
- The current `server.url` mode is useful for the MVP and internal testing. Before store release, review App Store and Google Play requirements and decide whether to keep remote loading, add live updates, or ship bundled app assets.
