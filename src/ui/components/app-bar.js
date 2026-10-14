import { icon } from './primitives.js';

export function appBar({ title, eyebrow, trailing = '' }) {
  return `<header class="app-bar"><div class="app-bar__brand">${icon('microscope')}<span>MicrometricPro</span></div><div class="app-bar__heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${trailing}</div></header>`;
}
