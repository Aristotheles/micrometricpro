import { icon } from './primitives.js';

const ITEMS = [
  { id: 'analyze', icon: 'image', label: 'navAnalyze' },
  { id: 'records', icon: 'records', label: 'navRecords' },
  { id: 'calibration', icon: 'calibration', label: 'navCalibration' },
  { id: 'settings', icon: 'settings', label: 'navSettings' },
];

export function bottomNav(active, translate) {
  return `<nav class="bottom-nav" aria-label="${translate('navLabel')}">${ITEMS.map(
    ({ id, icon: iconName, label }) =>
      `<button class="bottom-nav__item${active === id ? ' is-active' : ''}" type="button" data-route="${id}"${active === id ? ' aria-current="page"' : ''}><span class="bottom-nav__icon">${icon(iconName)}</span><span>${translate(label)}</span></button>`,
  ).join('')}</nav>`;
}
