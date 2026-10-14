# Privacy

MicrometricPro is designed to keep your data on your device.

## What stays on the device

- Images you open, measurements, calibration profiles and saved records are stored in the app's private storage. No other app can read them.
- There is no account, no backend, no analytics and no crash reporting.
- Android backup is disabled (`allowBackup=false`), so app data is not copied to cloud backups.

## Optional AI assistance (Gemini)

AI detection is optional and off until you add your own Google Gemini API key.

- The key is stored in the Android Keystore through secure storage. It is sent only in the `x-goog-api-key` header to `generativelanguage.googleapis.com`. It is never placed in a URL, log, error message, export or backup.
- The first time you run AI, the app asks for your consent. After that, each run sends only the **masked, downscaled circular crop** of your region (the area outside the circle is blacked out) and the prompt to Google. Nothing is sent before you confirm.
- Only counts of detected points come back. Physical values (length, area, density) are always computed on the device and are never sent to or calculated by the AI.
- Google processes the request under your own Gemini API terms and privacy policy. You are responsible for your key and its quota or billing.
- You can remove the key and revoke consent at any time in Settings.

## Permissions

The app requests only `INTERNET`, used solely for the optional Gemini request. Camera and storage permissions are not requested; images are chosen through the system picker.

## Exports

CSV and JSON exports are created only when you ask, written to a temporary cache and handed to the Android share sheet. They contain your records and calibration profile names, never your API key.

## Contact

Report privacy concerns by opening an issue in the project repository.
