# Mobile App

PERFORM mobile is a Capacitor app with bundled local UI in `apps/mobile/www`.
The app does not load the web site from the server. The server is used only as
the API backend for auth, athletes, plans, calendar, readiness and results.

## Architecture

```text
Android/iPhone app
  -> bundled mobile UI
  -> API server
  -> PostgreSQL
```

Main mobile layers:

- `apps/mobile/src/api` - API client.
- `apps/mobile/src/storage` - local session, cached data and selected athlete.
- `apps/mobile/src/sync` - offline sync queue.
- `apps/mobile/src/screens` - mobile UI screens.
- `apps/mobile/www` - bundled static shell and styles.

## Local Configuration

Copy the safe example:

```bash
cp apps/mobile/mobile.env.example apps/mobile/.env.mobile.local
```

Set:

```bash
MOBILE_API_BASE_URL=https://your-current-server.example.com/api/v1
```

`MOBILE_SERVER_URL` is no longer used for loading the interface. If it still
exists in a local file, the build script uses it only as a fallback to derive
`/api/v1` for the API client.

## Build And Sync

Build bundled mobile assets:

```bash
npm run mobile:build
```

Sync native projects:

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

## Web Download Button

The web app shows a direct mobile download button instead of relying on browser
PWA installation prompts. Configure the button with:

```bash
NEXT_PUBLIC_MOBILE_APP_DOWNLOAD_URL=/downloads/perform-mobile-android.apk
```

For self-hosted deployments, place the Android APK at
`apps/web/public/downloads/perform-mobile-android.apk` before building the web
image, or set `NEXT_PUBLIC_MOBILE_APP_DOWNLOAD_URL` to an external release URL.

## Open Native Projects

Android requires Android Studio:

```bash
npm run mobile:open:android
```

iOS requires Xcode on macOS:

```bash
npm run mobile:open:ios
```

## Offline Mode

The mobile app stores the latest loaded data in local storage:

- current session and user;
- athletes;
- assigned plans;
- competitions;
- competition plans;
- readiness entry;
- execution results;
- pending sync actions.

When a readiness entry, training result or competition result cannot be sent
because the device is offline or the server is unavailable, the action is saved
locally. The queue is retried when the connection returns or when the user taps
sync.

## Backend Notes

The web app still uses httpOnly session cookies. The mobile app additionally
uses the session token returned by login/register and sends it through the
`Authorization: Bearer <token>` header. Existing cookie auth remains supported.

For production, the API server must allow the mobile app origin in CORS, for
example `capacitor://localhost`, together with the public web origin.
