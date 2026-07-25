# RunArena — Native Android app

A thin native wrapper around the RunArena PWA. The web app is **bundled inside
the APK** (`app/src/main/assets/www`) and served through Android's
`WebViewAssetLoader` on `https://appassets.androidplatform.net/`, a real https
origin — so ES modules, the service worker, `localStorage` and geolocation all
work, **offline included**. (Map tiles/fonts still need the internet the first
time, then the service worker caches them.)

## Build the APK

You need **Android Studio** (Hedgehog 2023.1.1 or newer) — it bundles the JDK 17
and can install the Android SDK. No Node required.

1. Open **Android Studio → Open** and select the `android/` folder.
2. Let **Gradle sync** finish (it downloads Gradle 8.2, AGP 8.2.2, and SDK 34 on
   first run; accept any SDK/license prompts).
3. Build the APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. When it finishes, click **locate** — the file is
   `app/build/outputs/apk/debug/app-debug.apk`.
5. Copy it to your phone and install (enable *Install unknown apps* for your file
   manager), **or** just plug in the phone with USB debugging on and press
   **Run ▶** in Android Studio.

## Update the app content

After changing the web app, re-bundle then rebuild:

```bash
python scripts/sync_android.py
```

## Notes / next steps

- **App id:** `com.runarena.app` · **min Android:** 8.0 (API 26) · portrait.
- **Permissions:** Internet + Location (GPS). Location is requested at runtime the
  first time the app asks for your position.
- **Release build:** the debug APK above is fine for testing/sideloading. For the
  Play Store you'll need a **signed release** — in Android Studio: *Build →
  Generate Signed Bundle / APK*, create a keystore, and build a release
  `.aab`. (Keep the keystore safe; it's required for every future update.)
- This is a WebView wrapper, so it doesn't yet use native plugins. If you later
  want background GPS, health-app sync, or push notifications, the migration path
  is Capacitor (needs Node) — the same bundled `www` drops in.
