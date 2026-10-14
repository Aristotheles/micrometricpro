import { bottomNav } from './components/bottom-nav.js';
import { appBar } from './components/app-bar.js';
import {
  button,
  card,
  chip,
  emptyState,
  escapeHtml,
  field,
  icon,
  iconSpriteMarkup,
  segmented,
  stepper,
  toast as toastMarkup,
} from './components/primitives.js';
import { DEFAULT_LANGUAGE, isSupportedLanguage, translate } from '../i18n/index.js';
import { EXAMPLE_CALIBRATIONS } from '../core/calibration.js';
import { STOMATA_SYSTEM_PROMPT } from '../services/ai/prompt.js';
import { DEFAULT_GEMINI_MODEL } from '../services/ai/config.js';
import {
  maskGeminiApiKey,
  removeGeminiApiKey,
  saveGeminiApiKey,
} from '../services/ai/api-key-store.js';
import { createAiProvider } from '../services/ai/provider.js';
import { getAiErrorMessage } from '../services/ai/errors.js';
import {
  analysisScreen,
  mountAnalysis,
  revokeAiConsent,
  unmountAnalysis,
} from '../features/analyze/analyze-screen.js';

const STORAGE_KEYS = {
  language: 'micrometricpro.language',
  theme: 'micrometricpro.theme',
  onboarded: 'micrometricpro.onboarded',
  model: 'micrometricpro.geminiModel',
  prompt: 'micrometricpro.aiPrompt',
};
const ONBOARDING_STEPS = ['onboardStepLanguage', 'onboardStepCalibration', 'onboardStepPrivacy'];
const ROUTE_TITLE_KEYS = {
  analyze: 'analyzeTitle',
  records: 'recordsTitle',
  calibration: 'calibrationTitle',
  settings: 'settingsTitle',
  about: 'aboutTitle',
};

function detectLanguage(deviceLanguage = navigator.language) {
  const language = String(deviceLanguage).toLowerCase().split('-')[0];
  return isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function readPreference(key, fallback) {
  const value = localStorage.getItem(key);
  return value ?? fallback;
}

function savePreference(key, value) {
  localStorage.setItem(key, value);
}

function safeReturnButton(label) {
  return button(label, { variant: 'icon', action: 'back', iconName: 'arrow' });
}

function onboardingMarkup(state, t) {
  const languageNames = {
    en: t('languageEnglish'),
    tr: t('languageTurkish'),
    de: t('languageGerman'),
  };
  const stepTitle = ['onboardTitleLanguage', 'onboardTitleCalibration', 'onboardTitlePrivacy'];
  const stepDescription = [
    'onboardDescriptionLanguage',
    'onboardDescriptionCalibration',
    'onboardDescriptionPrivacy',
  ];
  const languageOptions = ['en', 'tr', 'de']
    .map(
      (language) =>
        `<label class="language-card${state.language === language ? ' is-selected' : ''}"><input type="radio" name="onboarding-language" value="${language}"${state.language === language ? ' checked' : ''}><span class="language-card__code">${language.toUpperCase()}</span><span class="language-card__name">${languageNames[language]}</span>${state.language === language ? icon('check', 'language-card__check') : ''}</label>`,
    )
    .join('');

  let content = '';
  if (state.onboardingStep === 0) {
    content = `<div class="language-grid">${languageOptions}</div>`;
  } else if (state.onboardingStep === 1) {
    content = `<div class="onboarding-note onboarding-note--warning">${chip(t('exampleProfile'), { tone: 'warning', iconName: 'calibration' })}<p>${t('userProfileNeeded')}</p><div class="example-scales"><span>4× <strong>${EXAMPLE_CALIBRATIONS[4].scaleUmPerPx} ${t('scaleUnit')}</strong></span><span>10× <strong>${EXAMPLE_CALIBRATIONS[10].scaleUmPerPx} ${t('scaleUnit')}</strong></span><span>40× <strong>${EXAMPLE_CALIBRATIONS[40].scaleUmPerPx} ${t('scaleUnit')}</strong></span></div></div>`;
  } else {
    content = `<div class="onboarding-note onboarding-note--privacy">${icon('shield')}<p>${t('privacySummary')}</p></div><ul class="privacy-list"><li>${icon('check')}${t('onboardPrivacyPoint1')}</li><li>${icon('check')}${t('onboardPrivacyPoint2')}</li><li>${icon('check')}${t('onboardPrivacyPoint3')}</li></ul><form class="optional-key" data-form="onboarding-key"><div><strong>${t('onboardOptionalKey')}</strong><span>${t('onboardOptionalKeyHint')}</span></div><label class="sr-only" for="onboarding-api-key">${t('apiKeyLabel')}</label><input class="input" id="onboarding-api-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t('apiKeyPlaceholder')}"><button class="button button--secondary" type="submit">${t('saveKey')}</button></form>`;
  }

  return `<main class="onboarding"><div class="onboarding__top"><span class="brand-mark">${icon('microscope')}</span><span>MicrometricPro</span></div><div class="onboarding__body">${stepper({ current: state.onboardingStep, total: ONBOARDING_STEPS.length, labels: ONBOARDING_STEPS.map(t) })}<p class="eyebrow">${t(ONBOARDING_STEPS[state.onboardingStep])}</p><h1>${t(stepTitle[state.onboardingStep])}</h1><p class="onboarding__description">${t(stepDescription[state.onboardingStep])}</p>${content}</div><div class="onboarding__footer">${state.onboardingStep > 0 ? button(t('onboardingBack'), { variant: 'text', action: 'onboarding-back' }) : '<span></span>'}${button(t(state.onboardingStep === ONBOARDING_STEPS.length - 1 ? 'onboardingStart' : 'onboardingContinue'), { variant: 'primary', action: 'onboarding-next', iconName: state.onboardingStep === ONBOARDING_STEPS.length - 1 ? 'check' : 'arrow' })}</div></main>`;
}

function recordsScreen(t) {
  const header = appBar({ eyebrow: t('eyebrowLibrary'), title: t('recordsTitle') });
  return `${header}<div class="screen-content screen-content--empty"><p class="screen-intro">${t('recordsIntro')}</p>${card(emptyState({ iconName: 'records', title: t('recordsEmptyTitle'), description: t('recordsEmptyDescription') }), { className: 'empty-card' })}</div>`;
}

function calibrationScreen(t) {
  const profile = (objective, translation) => {
    const data = EXAMPLE_CALIBRATIONS[objective];
    return `<article class="profile-row"><div class="profile-row__objective"><span class="objective-badge">${objective}×</span><div><strong>${t(translation)}</strong><span>${t('exampleOnly')}</span></div></div><div class="profile-row__scale"><strong>${data.scaleUmPerPx}</strong><span>${t('scaleUnit')}</span></div></article>`;
  };
  const header = appBar({ eyebrow: t('eyebrowCalibration'), title: t('calibrationTitle') });
  return `${header}<div class="screen-content"><p class="screen-intro">${t('calibrationIntro')}</p>${card(`<div class="section-heading"><div><p class="eyebrow">${t('exampleOnly')}</p><h2>${t('exampleProfile')}</h2></div>${chip(t('uncalibratedBadge'), { tone: 'warning' })}</div><div class="profile-list">${profile(4, 'example4')}${profile(10, 'example10')}${profile(40, 'example40')}</div><div class="notice notice--warning">${icon('shield')}<p>${t('userProfileNeeded')}</p></div>${button(t('addProfile'), { variant: 'primary', action: 'stage-placeholder', iconName: 'plus', className: 'button--wide' })}`, { className: 'calibration-card' })}<p class="muted-note">${t('profileWizardNext')}</p></div>`;
}

function settingsScreen(state, t) {
  const header = appBar({ eyebrow: t('eyebrowSettings'), title: t('settingsTitle') });
  const appearance = card(
    `<div class="settings-section__heading">${icon('sun')}<h2>${t('appearanceSection')}</h2></div>${segmented(
      {
        label: t('themeLabel'),
        name: 'theme',
        selected: state.theme,
        options: [
          { value: 'dark', label: t('themeDark'), iconName: 'moon' },
          { value: 'light', label: t('themeLight'), iconName: 'sun' },
        ],
      },
    )}<label class="field field--select"><span class="field__label">${t('languageLabel')}</span><select class="input" name="language" data-setting="language"><option value="en"${state.language === 'en' ? ' selected' : ''}>${t('languageEnglish')}</option><option value="tr"${state.language === 'tr' ? ' selected' : ''}>${t('languageTurkish')}</option><option value="de"${state.language === 'de' ? ' selected' : ''}>${t('languageGerman')}</option></select></label>`,
  );
  const ai = card(
    `<div class="settings-section__heading">${icon('sparkles')}<h2>${t('aiSection')}</h2></div><p class="settings-copy">${t('aiOptionalNote')}</p><form data-form="api-key"><div class="key-field-row">${field({ id: 'gemini-api-key', label: t('apiKeyLabel'), type: 'password', placeholder: t('apiKeyPlaceholder'), autocomplete: 'off', hint: t('apiKeyHint') })}</div><div class="button-row">${button(t('saveKey'), { variant: 'primary', type: 'submit', iconName: 'shield' })}${button(t('testKey'), { variant: 'secondary', action: 'test-key', iconName: 'sparkles' })}</div></form><div class="key-status"><span class="key-status__indicator"></span><span data-key-status>${t('aiApiKeyMissing')}</span><button class="text-link text-link--danger" type="button" data-action="remove-key">${t('removeKey')}</button></div><label class="field"><span class="field__label">${t('modelLabel')}</span><input class="input" type="text" name="model" value="${escapeHtml(state.model)}" data-setting="model" autocapitalize="off" spellcheck="false"><span class="field__hint">${t('modelHint')}</span></label><label class="field"><span class="field__label">${t('promptLabel')}</span><textarea class="input textarea" name="prompt" rows="5" data-setting="prompt">${escapeHtml(state.prompt)}</textarea><span class="field__hint">${t('promptHint')}</span></label><button class="text-link" type="button" data-action="reset-prompt">${t('resetPrompt')}</button><button class="text-link" type="button" data-action="revoke-consent">${t('revokeConsent')}</button>`,
  );
  const privacy = card(
    `<div class="settings-section__heading">${icon('shield')}<h2>${t('privacySection')}</h2></div><p class="settings-copy">${t('privacySummary')}</p><p class="settings-copy muted">${t('privacyDetails')}</p><button class="list-link" type="button" data-route="about"><span>${icon('globe')}${t('aboutLicenses')}</span>${icon('arrow')}</button><div class="data-management"><strong>${t('dataManagement')}</strong><p>${t('dataManagementNext')}</p></div>`,
  );
  return `${header}<div class="screen-content screen-content--settings"><p class="screen-intro">${t('settingsIntro')}</p>${appearance}${ai}${privacy}</div>`;
}

function aboutScreen(t) {
  const header = appBar({
    eyebrow: t('eyebrowSettings'),
    title: t('aboutTitle'),
    trailing: safeReturnButton(t('close')),
  });
  return `${header}<div class="screen-content">${card(`<div class="about-brand">${icon('microscope')}<strong>MicrometricPro</strong></div><p class="screen-intro">${t('aboutIntro')}</p><h2>${t('privacyHeading')}</h2><p class="settings-copy">${t('privacySummary')}</p><p class="settings-copy muted">${t('privacyDetails')}</p><h2>${t('licensesHeading')}</h2><p class="settings-copy">${t('aboutLicenseText')}</p>`, { className: 'about-card' })}</div>`;
}

function renderScreen(state, t) {
  switch (state.route) {
    case 'analyze':
      return analysisScreen(t);
    case 'records':
      return recordsScreen(t);
    case 'calibration':
      return calibrationScreen(t);
    case 'settings':
      return settingsScreen(state, t);
    case 'about':
      return aboutScreen(t);
    default:
      throw new Error(`Unknown route: ${state.route}`);
  }
}

export function startApp(root) {
  if (!root) throw new Error('APP_ROOT_NOT_FOUND');

  const savedLanguage = readPreference(STORAGE_KEYS.language, detectLanguage());
  const state = {
    language: isSupportedLanguage(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE,
    theme: readPreference(STORAGE_KEYS.theme, 'dark') === 'light' ? 'light' : 'dark',
    model: readPreference(STORAGE_KEYS.model, DEFAULT_GEMINI_MODEL),
    prompt: readPreference(STORAGE_KEYS.prompt, STOMATA_SYSTEM_PROMPT),
    onboardingStep: 0,
    route: readPreference(STORAGE_KEYS.onboarded, 'false') === 'true' ? 'analyze' : 'onboarding',
    toastTimer: null,
  };

  const t = (key, vars) => translate(state.language, key, vars);

  function applyPreferences() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.lang = state.language;
    const titleKey =
      state.route === 'onboarding'
        ? ['onboardTitleLanguage', 'onboardTitleCalibration', 'onboardTitlePrivacy'][
            state.onboardingStep
          ]
        : ROUTE_TITLE_KEYS[state.route];
    document.title = `MicrometricPro · ${t(titleKey)}`;
  }

  function render() {
    applyPreferences();
    if (state.route === 'onboarding') {
      root.innerHTML = `${iconSpriteMarkup()}${onboardingMarkup(state, t)}<div class="toast-region" id="toast-region"></div>`;
      return;
    }
    const activeRoute = state.route === 'about' ? 'settings' : state.route;
    root.innerHTML = `${iconSpriteMarkup()}<div class="app-shell">${renderScreen(state, t)}${bottomNav(activeRoute, t)}</div><div class="toast-region" id="toast-region"></div>`;
    if (state.route === 'settings') refreshKeyStatus();
    if (state.route === 'analyze') {
      mountAnalysis(root, {
        t,
        showToast,
        getLanguage: () => state.language,
        getSettings: () => ({ model: state.model, prompt: state.prompt }),
      });
    } else {
      unmountAnalysis();
    }
  }

  function showToast(message, tone = 'info') {
    const region = root.querySelector('#toast-region');
    if (!region) return;
    region.innerHTML = toastMarkup(message, tone);
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      const activeToast = region.querySelector('.toast');
      activeToast?.classList.add('is-leaving');
      setTimeout(() => {
        if (region.contains(activeToast)) region.replaceChildren();
      }, 200);
    }, 3200);
  }

  async function refreshKeyStatus() {
    const status = root.querySelector('[data-key-status]');
    const indicator = root.querySelector('.key-status__indicator');
    if (!status || !indicator) return;
    try {
      const masked = await maskGeminiApiKey();
      if (!root.contains(status)) return;
      status.textContent = masked || t('aiApiKeyMissing');
      indicator.classList.toggle('is-set', Boolean(masked));
    } catch (error) {
      if (!root.contains(status)) return;
      status.textContent = getAiErrorMessage(error, t);
      indicator.classList.remove('is-set');
    }
  }

  async function saveKeyFromInput(inputId) {
    const input = root.querySelector(`#${inputId}`);
    const key = input?.value ?? '';
    if (!key.trim()) {
      showToast(t('toastKeyEntry'), 'warning');
      input?.focus();
      return;
    }
    showToast(t('toastKeySaving'));
    try {
      await saveGeminiApiKey(key);
      if (input) input.value = '';
      showToast(t('keySaved'), 'success');
      await refreshKeyStatus();
    } catch (error) {
      showToast(getAiErrorMessage(error, t), 'error');
    }
  }

  async function testKey() {
    showToast(t('toastKeyTesting'));
    try {
      const provider = createAiProvider({ model: state.model });
      await provider.testApiKey();
      showToast(t('keyConnected'), 'success');
    } catch (error) {
      showToast(getAiErrorMessage(error, t), 'error');
      await refreshKeyStatus();
    }
  }

  function completeOnboarding() {
    savePreference(STORAGE_KEYS.onboarded, 'true');
    state.route = 'analyze';
    render();
  }

  root.addEventListener('click', async (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      state.route = routeButton.dataset.route;
      render();
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    switch (actionButton.dataset.action) {
      case 'onboarding-next':
        if (state.onboardingStep < ONBOARDING_STEPS.length - 1) {
          state.onboardingStep += 1;
          render();
        } else {
          completeOnboarding();
        }
        break;
      case 'onboarding-back':
        state.onboardingStep = Math.max(0, state.onboardingStep - 1);
        render();
        break;
      case 'stage-placeholder':
        showToast(t('toastStagePlaceholder'));
        break;
      case 'test-key':
        await testKey();
        break;
      case 'remove-key':
        showToast(t('toastKeyRemoving'));
        try {
          await removeGeminiApiKey();
          showToast(t('keyRemoved'), 'success');
          await refreshKeyStatus();
        } catch (error) {
          showToast(getAiErrorMessage(error, t), 'error');
        }
        break;
      case 'revoke-consent':
        revokeAiConsent();
        showToast(t('toastConsentRevoked'), 'success');
        break;
      case 'reset-prompt': {
        state.prompt = STOMATA_SYSTEM_PROMPT;
        savePreference(STORAGE_KEYS.prompt, state.prompt);
        render();
        showToast(t('toastPromptReset'), 'success');
        break;
      }
      case 'back':
        state.route = 'settings';
        render();
        break;
      default:
        throw new Error(`Unknown UI action: ${actionButton.dataset.action}`);
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('input[name="onboarding-language"]')) {
      if (!isSupportedLanguage(target.value)) throw new Error('UNSUPPORTED_LANGUAGE');
      state.language = target.value;
      savePreference(STORAGE_KEYS.language, state.language);
      render();
      return;
    }
    if (target.matches('input[name="theme"]')) {
      state.theme = target.value === 'light' ? 'light' : 'dark';
      savePreference(STORAGE_KEYS.theme, state.theme);
      render();
      showToast(t('toastSettingsSaved'), 'success');
      return;
    }
    if (target.matches('[data-setting="language"]')) {
      if (!isSupportedLanguage(target.value)) throw new Error('UNSUPPORTED_LANGUAGE');
      state.language = target.value;
      savePreference(STORAGE_KEYS.language, state.language);
      render();
      return;
    }
    if (target.matches('[data-setting="model"]')) {
      const model = target.value.trim();
      if (!/^[A-Za-z0-9._-]+$/.test(model)) {
        target.setCustomValidity(t('modelInvalid'));
        target.reportValidity();
        return;
      }
      target.setCustomValidity('');
      state.model = model;
      savePreference(STORAGE_KEYS.model, model);
      showToast(t('toastSettingsSaved'), 'success');
    }
    if (target.matches('[data-setting="prompt"]')) {
      state.prompt = target.value;
      savePreference(STORAGE_KEYS.prompt, state.prompt);
      showToast(t('toastSettingsSaved'), 'success');
    }
  });

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'api-key') await saveKeyFromInput('gemini-api-key');
    else if (form.dataset.form === 'onboarding-key') {
      await saveKeyFromInput('onboarding-api-key');
    } else {
      throw new Error(`Unknown form: ${form.dataset.form}`);
    }
  });

  render();
}
