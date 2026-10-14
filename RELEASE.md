# Release

The keystore and its passwords are **never** committed (`*.jks`, `*.keystore` and `keystore.properties` are git-ignored).

## 1. Create a keystore (once)

```
keytool -genkeypair -v -keystore micrometricpro-release.jks -alias micrometricpro -keyalg RSA -keysize 4096 -validity 10000
```

Store the file and passwords outside the repository and back them up. Losing the key means you cannot update the app.

## 2. Configure signing locally

Create `android/keystore.properties` (ignored by git):

```
storeFile=C:/secure/micrometricpro-release.jks
storePassword=...
keyAlias=micrometricpro
keyPassword=...
```

`android/app/build.gradle` signs the release build only when this file exists.

## 3. Build

1. Raise `versionCode` and `versionName` in `android/app/build.gradle`.
2. `npm run android:sync`
3. From `android/`: `gradlew assembleRelease` (APK) or `gradlew bundleRelease` (AAB, for Play).

Outputs: `android/app/build/outputs/apk/release/` and `android/app/build/outputs/bundle/release/`.

## 4. Check before publishing

- `npm run check`, `npm run test:unit`, `npm run test:e2e` pass.
- Manifest requests only `INTERNET` and `allowBackup="false"`.
- No key material in the APK: `apksigner verify --print-certs app-release.apk` and search extracted strings for `AIza`.
