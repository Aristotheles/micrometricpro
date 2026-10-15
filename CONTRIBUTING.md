# Contributing / Katkı

Thanks for helping! / Katkın için teşekkürler!

## Setup

```bash
npm install
npm run check        # format + source checks
npm run test:unit    # unit tests
npm run build        # web build
npx playwright test  # e2e (optional)
```

Android build needs JDK 21 and the Android SDK; see [RELEASE.md](RELEASE.md).

## Rules / Kurallar

- Physical values (µm, mm², density) are computed only in deterministic app code; never send manual counts or calibration to AI.
- Never commit API keys, keystores, `.env` or `local.properties`.
- New dependencies must be MIT/Apache/BSD compatible and listed in [THIRD_PARTY.md](THIRD_PARTY.md).
- Keep `npm run check` and the tests green. Small, focused pull requests are preferred.
- UI strings must be added for EN, TR and DE.

Licensed under MIT; contributions are accepted under the same license.
