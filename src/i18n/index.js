import en from './en.js';
import tr from './tr.js';
import de from './de.js';

const DICTIONARIES = { en, tr, de };
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = Object.keys(DICTIONARIES);

export function isSupportedLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * Looks up `key` in `lang`'s dictionary, falling back to the default
 * language dictionary and finally to the raw key so a missing translation
 * never crashes the UI. `{{name}}` placeholders in the template are
 * replaced from `vars`.
 */
export function translate(lang, key, vars) {
  const dictionary = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANGUAGE];
  const template = dictionary[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}
