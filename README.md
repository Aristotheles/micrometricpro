# MicrometricPro

Calibrated microscope-image measurement (length, circle/area) and stomata counting/density for Android.

- Offline-first, no backend, no telemetry. See [PRIVACY.md](PRIVACY.md).
- Optional AI-assisted detection with **your own** Gemini API key (BYOK). Manual features work fully without a key.
- Languages: English (default), Türkçe, Deutsch.
- Android only (minSdk 26). Capacitor 8, Vanilla JS (ES modules), Vite.

## How it works

1. **Calibrate** (Calibrate tab): photograph a stage micrometer, mark two points a known distance apart, and save a profile per objective. Without your own profile, results use the built-in _example_ profile and are labelled uncalibrated.
2. **Analyze**: open an image, measure length, draw the counting circle (3 edge points), and count stomata manually. Physical values are computed on the device only.
3. **AI assist (optional)**: add a Gemini key in Settings, then run AI on the circle. You confirm and review every detection.
4. **Save and export**: records are stored privately on the device; export CSV (UTF-8 with BOM, dot decimals) or JSON through the share sheet.

## Gemini API key (BYOK)

1. Create a key in Google AI Studio.
2. In the app, open Settings → AI and paste the key (or paste it during onboarding).
3. The key is stored in the Android Keystore and sent only in a request header to Google. Remove it any time in Settings.

You pay for / are limited by your own Gemini quota. The app never ships a key.

## Develop

```
npm install
npm run dev            # Vite dev server
npm run check          # formatting + source policy checks
npm run test:unit      # unit tests
npm run test:e2e       # Playwright (Chromium, mobile viewport)
npm run build          # production web build into dist/
npm run android:debug  # build debug APK
```

First e2e run needs `npx playwright install chromium`.

Requirements: Node.js 20+, JDK 21, Android SDK (platform 36) for APK builds. A debug APK is also built by CI and uploaded as an artifact.

## Release

See [RELEASE.md](RELEASE.md) for signed APK/AAB instructions. No keystore is stored in this repository.

## License

MIT — see [LICENSE](LICENSE). Third-party notices: [THIRD_PARTY.md](THIRD_PARTY.md).
