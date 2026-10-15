# Security Policy / Güvenlik Politikası

## Reporting a vulnerability / Açık bildirimi

Please report security issues **privately** through GitHub's
"Report a vulnerability" button (Security tab → Advisories) instead of opening a public issue.
Include steps to reproduce and the app version. Never include a real API key in a report.

Güvenlik sorunlarını herkese açık issue yerine GitHub'ın **"Report a vulnerability"**
düğmesiyle (Security sekmesi → Advisories) özel olarak bildirin. Yeniden üretme adımlarını ve
uygulama sürümünü ekleyin. Bildirime asla gerçek bir API anahtarı koymayın.

## Scope / Kapsam

- The Gemini API key is stored only on the device and must never appear in logs, errors, exports or URLs.
- The app requests only the `INTERNET` permission and has no backend.
- Gemini API anahtarı yalnızca cihazda saklanır; log, hata, dışa aktarma veya URL'de görünmemelidir.
- Uygulama yalnızca `INTERNET` iznini ister ve arka uç kullanmaz.

See [PRIVACY.md](PRIVACY.md) for details.
