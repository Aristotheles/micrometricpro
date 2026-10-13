# MicrometricPro

Calibrated microscope-image measurement (length, circle/area) and stomata counting/density for Android.

- Offline-first, no backend, no telemetry.
- Optional AI-assisted detection with **your own** Gemini API key (BYOK). Manual features work fully without a key.
- Languages: English (default), Türkçe, Deutsch.

> Status: early development (see [docs/MVP_PLAN.md](docs/MVP_PLAN.md)).

## Requirements

- Node.js 20+ and npm
- JDK 21, Android SDK (platform 36), for APK builds

## Develop

```
npm install
npm run dev            # Vite dev server
npm run check          # formatting + source policy checks
npm run test:unit      # unit tests
npm run build          # production web build into dist/
npm run android:debug  # build debug APK
```

## License

MIT — see [LICENSE](LICENSE). Third-party notices: [THIRD_PARTY.md](THIRD_PARTY.md).
