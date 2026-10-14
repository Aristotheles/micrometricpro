import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../../src/i18n/index.js';
import en from '../../src/i18n/en.js';
import tr from '../../src/i18n/tr.js';
import de from '../../src/i18n/de.js';

test('EN, TR and DE dictionaries define the exact same set of keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
});

test('translate returns the language-specific string', () => {
  assert.equal(translate('tr', 'photoNotSelected'), 'Fotoğraf seç.');
  assert.equal(translate('de', 'photoNotSelected'), 'Foto auswählen.');
  assert.equal(translate('en', 'photoNotSelected'), 'Select a photo.');
});

test('translate falls back to the default language for an unsupported language', () => {
  assert.equal(
    translate('fr', 'photoNotSelected'),
    translate(DEFAULT_LANGUAGE, 'photoNotSelected'),
  );
});

test('translate falls back to the raw key for an unknown key', () => {
  assert.equal(translate('tr', 'doesNotExist'), 'doesNotExist');
});

test('translate substitutes {{placeholders}} from vars', () => {
  const result = translate('tr', 'scaleReadout', {
    objective: '40',
    scale: '0.24510',
  });
  assert.ok(result.includes('40×'));
  assert.ok(result.includes('0.24510'));
});

test('English is the default and all supported languages are available', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.deepEqual(SUPPORTED_LANGUAGES.sort(), ['de', 'en', 'tr']);
});
