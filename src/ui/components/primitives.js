const ICONS = new Set([
  'microscope',
  'image',
  'ruler',
  'records',
  'calibration',
  'settings',
  'plus',
  'sparkles',
  'shield',
  'arrow',
  'check',
  'sun',
  'moon',
  'globe',
  'close',
]);

import iconSprite from '../icons.svg?raw';

export function iconSpriteMarkup() {
  return iconSprite.replace('<svg ', '<svg class="icon-sprite" aria-hidden="true" ');
}

export function icon(name, className = '') {
  if (!ICONS.has(name)) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon ${className}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
}

export function button(
  label,
  {
    variant = 'secondary',
    action,
    iconName,
    type = 'button',
    disabled = false,
    className = '',
  } = {},
) {
  const actionAttribute = action ? ` data-action="${action}"` : '';
  const disabledAttribute = disabled ? ' disabled' : '';
  return `<button class="button button--${variant} ${className}" type="${type}"${actionAttribute}${disabledAttribute}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
}

export function card(content, { className = '' } = {}) {
  return `<section class="card ${className}">${content}</section>`;
}

export function chip(label, { tone = 'neutral', iconName } = {}) {
  return `<span class="chip chip--${tone}">${iconName ? icon(iconName) : ''}${label}</span>`;
}

export function field({
  id,
  label,
  type = 'text',
  value = '',
  placeholder = '',
  autocomplete,
  hint,
  inputMode,
}) {
  const autocompleteAttr = autocomplete ? ` autocomplete="${autocomplete}"` : '';
  const inputModeAttr = inputMode ? ` inputmode="${inputMode}"` : '';
  return `<label class="field" for="${id}"><span class="field__label">${label}</span><input id="${id}" class="input" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}"${autocompleteAttr}${inputModeAttr}>${hint ? `<span class="field__hint">${hint}</span>` : ''}</label>`;
}

export function segmented({ label, name, options, selected }) {
  return `<fieldset class="segmented"><legend>${label}</legend><div class="segmented__options">${options
    .map(
      ({ value, label: optionLabel, iconName }) =>
        `<label class="segmented__option"><input type="radio" name="${name}" value="${value}"${value === selected ? ' checked' : ''}><span>${iconName ? icon(iconName) : ''}${optionLabel}</span></label>`,
    )
    .join('')}</div></fieldset>`;
}

export function emptyState({ iconName = 'image', title, description, action }) {
  return `<div class="empty-state"><div class="empty-state__icon">${icon(iconName)}</div><h3>${title}</h3><p>${description}</p>${action ?? ''}</div>`;
}

export function stepper({ current, total, labels }) {
  return `<div class="stepper" aria-label="${current + 1} of ${total}"><div class="stepper__track">${labels
    .map(
      (label, index) =>
        `<span class="stepper__step${index <= current ? ' is-active' : ''}${index < current ? ' is-complete' : ''}" aria-label="${label}"></span>`,
    )
    .join('')}</div><span class="stepper__count">${current + 1} / ${total}</span></div>`;
}

export function dialog({ title, body, actions = '' }) {
  return `<dialog class="dialog" aria-labelledby="dialog-title"><div class="dialog__content"><h2 id="dialog-title">${title}</h2><div>${body}</div><div class="dialog__actions">${actions}</div></div></dialog>`;
}

export function toast(message, tone = 'info') {
  return `<div class="toast toast--${tone}" role="status" aria-live="polite">${message}</div>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
