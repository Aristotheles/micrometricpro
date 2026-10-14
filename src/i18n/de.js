export default {
  appTitle: 'MicrometricPro',
  langLabel: 'Sprache',
  lengthMode: 'Länge',
  circleMode: 'Kreis / Stoma',
  reset: 'Zurücksetzen',
  setA: 'A markieren',
  setB: 'B markieren',
  setC: 'C markieren',
  zoomOut: '− Zoom',
  zoomIn: '+ Zoom',
  nudgeLeft: '← 1 px',
  nudgeRight: '1 px →',
  nudgeUp: '↑ 1 px',
  nudgeDown: '1 px ↓',
  stomaCountLabel: 'Anzahl Stomata:',
  selectPhotoPrompt: 'Foto auswählen. Bild ziehen, um den Messpunkt in die Mitte zu bringen.',
  helpText:
    'Länge: A und B wählen. Kreis/Stoma: drei weit auseinanderliegende Punkte A-B-C auf dem Kreisumfang wählen; Mittelpunkt, Durchmesser, Fläche und Stomata/mm² werden automatisch berechnet.',
  calibrationsLabel: 'Kalibrierungen:',
  photoNotSelected: 'Foto auswählen.',
  imageDecodeFailed: 'Bild konnte nicht geöffnet werden.',
  scaleReadout: '{{objective}}× ausgewählt · Maßstab: <b class="good">{{scale}} µm/pixel</b>',
  lengthReadout: 'A–B: <b>{{px}} px</b> → <b class="good">{{um}} µm</b>',
  circlePrompt:
    '{{objective}}× · Drei Punkte auf dem Umfang wählen: A, B und C. Mittelpunkt wird automatisch ermittelt.',
  collinearWarning:
    '<span class="warn">Die drei Punkte liegen zu nah an einer Geraden. Wählen Sie Punkt C an einer anderen Stelle des Kreises.</span>',
  circleReadout:
    'Durchmesser: <b>{{diameter}} µm</b> · Radius: <b>{{radius}} µm</b> · Fläche: <b class="good">{{area}} mm²</b> · Stomata: <b>{{count}}</b> · Dichte: <b class="good">{{density}} Stomata/mm²</b>',
  circleOutOfBounds: 'Das gesamte Sichtfeld muss innerhalb des Bildes liegen.',
  aiApiKeyMissing:
    'Fügen Sie Ihren Gemini-API-Schlüssel in den Einstellungen hinzu, um die KI-Analyse zu verwenden.',
  aiApiKeyInvalid:
    'Gemini hat diesen API-Schlüssel abgelehnt. Prüfen oder ersetzen Sie ihn in den Einstellungen.',
  aiQuotaExceeded:
    'Das Gemini-API-Kontingent oder Ratenlimit wurde erreicht. Versuchen Sie es später erneut.',
  aiTimeout:
    'Die Gemini-Anfrage hat das Zeitlimit überschritten. Prüfen Sie die Verbindung und versuchen Sie es erneut.',
  aiNetwork:
    'Gemini ist nicht erreichbar. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
  aiServiceError: 'Gemini ist vorübergehend nicht verfügbar. Versuchen Sie es später erneut.',
  aiInvalidResponse:
    'Gemini hat ein nicht lesbares Ergebnis zurückgegeben. Wiederholen Sie die Analyse.',
  aiInvalidRequest: 'Das Bild oder die Anfrage ist für eine Gemini-Analyse ungültig.',
  aiSecureStorageUnavailable:
    'Sicherer Schlüsselspeicher ist auf diesem Gerät nicht verfügbar. Der API-Schlüssel wurde nicht gespeichert.',
};
