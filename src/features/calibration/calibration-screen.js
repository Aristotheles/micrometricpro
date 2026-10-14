/**
 * Calibration screen: profile list, stage-micrometer wizard, and profile
 * import/export. Physical scale is computed only here with
 * `computeScaleUmPerPx`; nothing is sent to any AI service.
 */

import { appBar } from '../../ui/components/app-bar.js';
import { button, card, chip, escapeHtml, icon } from '../../ui/components/primitives.js';
import {
  computeScaleUmPerPx,
  createCalibrationProfile,
  EXAMPLE_CALIBRATIONS,
} from '../../core/calibration.js';
import { loadCanonicalImage } from '../../core/canonical-image.js';
import { clampToImageBounds } from '../../core/coordinates.js';
import { distancePx } from '../../core/measurement.js';
import { parseProfileJson, serializeProfile } from '../../core/profile-io.js';
import {
  addProfile,
  getActiveMap,
  loadProfiles,
  removeProfile,
  setActiveProfile,
} from '../../storage/profile-store.js';
import { shareTextFile } from '../../services/share-file.js';
import { createCanvasView } from '../analyze/canvas-view.js';

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const POINT_COLORS = ['#8de0c1', '#ffd166'];
const PROFILE_ERRORS = {
  PROFILE_UNSUPPORTED_VERSION: 'calImportVersion',
};

let mounted = null;

export function calibrationScreen(t) {
  const header = appBar({ eyebrow: t('eyebrowCalibration'), title: t('calibrationTitle') });
  return `${header}<div class="screen-content" data-calibration></div>`;
}

export function unmountCalibration() {
  mounted?.destroy();
  mounted = null;
}

export function mountCalibration(root, env) {
  unmountCalibration();
  const container = root.querySelector('[data-calibration]');
  if (!container) return;
  const { t, showToast } = env;
  const format = (value, digits = 5) =>
    new Intl.NumberFormat(env.getLanguage(), { maximumFractionDigits: digits }).format(value);

  let profiles = [];
  let wizard = null;
  let canvas = null;
  let alive = true;

  function destroyCanvas() {
    canvas?.destroy();
    canvas = null;
    if (wizard?.loaded) URL.revokeObjectURL(wizard.loaded.url);
  }

  const textButton = (action, label, id = '', danger = false) =>
    `<button class="text-link${danger ? ' text-link--danger' : ''}" type="button" data-c-action="${action}"${id ? ` data-id="${id}"` : ''}>${label}</button>`;

  function profileRow(profile, active) {
    const origin = profile.source === 'imported' ? t('calImportedLabel') : t('calOwnLabel');
    const activeChip = active ? chip(t('calActive'), { tone: 'success', iconName: 'check' }) : '';
    return `<article class="profile-row profile-row--user"><div class="profile-row__objective"><span class="objective-badge">${profile.objective}×</span><div><strong>${escapeHtml(profile.name)}</strong><span>${t('calibratedBadge')} · ${origin}</span></div></div><div class="profile-row__scale"><strong>${format(profile.scaleUmPerPx)}</strong><span>${t('scaleUnit')}</span></div><div class="profile-row__actions">${activeChip}${active ? '' : textButton('use', t('calUse'), profile.id)}${textButton('export', t('calExport'), profile.id)}${textButton('delete', t('calDelete'), profile.id, true)}</div></article>`;
  }

  function listMarkup() {
    const active = getActiveMap();
    const own = profiles.length
      ? `<div class="profile-list">${profiles.map((p) => profileRow(p, active[p.objective] === p.id)).join('')}</div>`
      : `<p class="muted-note">${t('calNoUserProfiles')}</p>`;
    const example = Object.keys(EXAMPLE_CALIBRATIONS)
      .map((objective) => {
        const data = EXAMPLE_CALIBRATIONS[objective];
        return `<article class="profile-row"><div class="profile-row__objective"><span class="objective-badge">${objective}×</span><div><strong>${t(`example${objective}`)}</strong><span>${t('exampleOnly')}</span></div></div><div class="profile-row__scale"><strong>${data.scaleUmPerPx}</strong><span>${t('scaleUnit')}</span></div></article>`;
      })
      .join('');
    return `<p class="screen-intro">${t('calibrationIntro')}</p>${card(`<div class="section-heading"><div><p class="eyebrow">${t('calMyProfiles')}</p><h2>${t('calibratedBadge')}</h2></div></div>${own}<div class="button-row"><button class="button button--primary" type="button" data-c-action="c-new">${icon('plus')}<span>${t('addProfile')}</span></button><label class="button button--secondary" for="profile-import">${icon('records')}<span>${t('calImport')}</span></label></div><input class="sr-only" id="profile-import" data-c-import type="file" accept="application/json,.json" tabindex="-1">`, { className: 'calibration-card' })}${card(`<div class="section-heading"><div><p class="eyebrow">${t('exampleOnly')}</p><h2>${t('exampleProfile')}</h2></div>${chip(t('uncalibratedBadge'), { tone: 'warning' })}</div><div class="profile-list">${example}</div><div class="notice notice--warning">${icon('shield')}<p>${t('userProfileNeeded')}</p></div>`, { className: 'calibration-card' })}`;
  }

  function showList() {
    destroyCanvas();
    wizard = null;
    container.innerHTML = listMarkup();
  }

  async function refreshProfiles() {
    try {
      profiles = await loadProfiles();
    } catch {
      profiles = [];
      showToast(t('calLoadFailed'), 'error');
    }
    if (alive && !wizard) showList();
  }

  function drawOverlay(ctx, view) {
    if (!wizard) return;
    const to = (p) => ({ x: view.offsetX + p.x * view.zoom, y: view.offsetY + p.y * view.zoom });
    if (wizard.points.length === 2) {
      const [a, b] = wizard.points.map(to);
      ctx.save();
      ctx.strokeStyle = POINT_COLORS[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    wizard.points.forEach((point, index) => {
      const p = to(point);
      ctx.save();
      ctx.fillStyle = POINT_COLORS[index];
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(index === 0 ? 'A' : 'B', p.x + 9, p.y - 9);
      ctx.restore();
    });
  }

  function startWizard() {
    destroyCanvas();
    wizard = { loaded: null, points: [], distance: '', name: '', objective: '10', notes: '' };
    container.innerHTML = `${card(`<div class="stage"><canvas class="stage__canvas" data-wiz-canvas role="img" aria-label="${t('canvasLabel')}"></canvas><div class="stage__empty" data-wiz-empty>${icon('ruler')}<strong>${t('calWizardTitle')}</strong><span>${t('calWizardIntro')}</span><label class="button button--primary" for="wiz-file">${icon('image')}<span>${t('chooseImage')}</span></label></div><input class="sr-only" id="wiz-file" data-wiz-file type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1"></div><p class="stage__hint" data-wiz-hint></p>`, { className: 'analysis-card' })}<div class="analysis-panels" data-wiz-panel></div>`;
    canvas = createCanvasView(container.querySelector('[data-wiz-canvas]'), {
      onTap(_screen, imagePoint) {
        canvas.centerOn(imagePoint);
      },
      drawOverlay,
    });
    refreshWizard();
  }

  function computed() {
    if (!wizard || wizard.points.length < 2) return { error: 'calErrPoints' };
    const px = distancePx(wizard.points[0], wizard.points[1]);
    try {
      return { scale: computeScaleUmPerPx(wizard.distance.replace(',', '.'), px), px };
    } catch (error) {
      if (error.message === 'INVALID_PIXEL_DISTANCE') return { error: 'calErrPoints', px };
      return { error: 'calErrDistance', px };
    }
  }

  function resultRows(result) {
    const px = result.px
      ? `<div class="result-row"><span>${t('calDistancePx')}</span><strong>${format(result.px, 2)} px</strong></div>`
      : '';
    if (result.scale !== undefined) {
      return `${px}<div class="result-row result-row--strong"><span>${t('calComputedScale')}</span><strong>${format(result.scale)} ${t('scaleUnit')}</strong></div>`;
    }
    return px;
  }

  function wizardPanel() {
    if (!wizard.loaded) return '';
    const result = computed();
    const iconButton = (action, iconName, label) =>
      `<button class="button button--secondary button--square" type="button" data-w-action="${action}" aria-label="${escapeHtml(label)}">${icon(iconName)}</button>`;
    const nudge = (dir, dx, dy, key) =>
      `<button class="button button--secondary button--square nudge--${dir}" type="button" data-w-action="nudge" data-dx="${dx}" data-dy="${dy}" aria-label="${t(key)}">${icon('arrow')}</button>`;
    const controls = `<div class="control-row"><button class="button button--primary" type="button" data-w-action="place"${wizard.points.length >= 2 ? ' disabled' : ''}>${icon('target')}<span>${t('placePoint')} (${wizard.points.length}/2)</span></button><div class="control-row__group">${iconButton('undo', 'undo', t('undo'))}${iconButton('clear', 'trash', t('clearTool'))}</div></div><div class="control-row control-row--view"><div class="nudge-pad" role="group" aria-label="1 px">${nudge('up', 0, -1, 'nudgeUp')}${nudge('left', -1, 0, 'nudgeLeft')}${nudge('right', 1, 0, 'nudgeRight')}${nudge('down', 0, 1, 'nudgeDown')}</div><div class="control-row__group">${iconButton('zoom-out', 'minus', t('zoomOut'))}${iconButton('fit', 'fit', t('fitView'))}${iconButton('zoom-in', 'plus', t('zoomIn'))}</div></div>`;
    const form = `<form class="save-form" data-c-form="save"><label class="field"><span class="field__label">${t('calKnownDistance')}</span><input class="input" name="distance" inputmode="decimal" autocomplete="off" value="${escapeHtml(wizard.distance)}" data-w-field="distance"><span class="field__hint">${t('calKnownDistanceHint')}</span></label><label class="field"><span class="field__label">${t('calProfileName')}</span><input class="input" name="name" maxlength="80" autocomplete="off" value="${escapeHtml(wizard.name)}" data-w-field="name"></label><label class="field"><span class="field__label">${t('calObjectiveLabel')}</span><input class="input" name="objective" type="number" min="1" max="1000" step="any" inputmode="decimal" value="${escapeHtml(wizard.objective)}" data-w-field="objective"></label><label class="field"><span class="field__label">${t('calNotes')}</span><textarea class="input textarea" name="notes" rows="2" maxlength="500" data-w-field="notes">${escapeHtml(wizard.notes)}</textarea></label><div class="button-row">${button(t('calSave'), { variant: 'primary', type: 'submit', iconName: 'check', disabled: result.scale === undefined || Boolean(wizard.saving) })}<button class="button button--secondary" type="button" data-c-action="c-cancel">${t('cancel')}</button></div></form>`;
    return `${card(`<div class="section-heading"><div><p class="eyebrow">${t('eyebrowCalibration')}</p><h2>${t('calWizardTitle')}</h2></div></div>${controls}`)}${card(`<div class="result-list" data-wiz-results>${resultRows(result)}</div>${form}`)}`;
  }

  function refreshWizard() {
    if (!wizard) return;
    const panel = container.querySelector('[data-wiz-panel]');
    const hint = container.querySelector('[data-wiz-hint]');
    if (hint) hint.textContent = wizard.loaded ? t('calHintPoints') : t('calWizardIntro');
    if (panel) panel.innerHTML = wizardPanel();
    canvas?.render();
  }

  async function loadWizardImage(file) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) return showToast(t('imageUnsupported'), 'warning');
    if (file.size > MAX_IMAGE_BYTES) return showToast(t('imageTooLarge'), 'warning');
    try {
      const loaded = await loadCanonicalImage(file);
      if (!wizard || !alive) {
        URL.revokeObjectURL(loaded.url);
        return;
      }
      if (wizard.loaded) URL.revokeObjectURL(wizard.loaded.url);
      wizard.loaded = loaded;
      wizard.points = [];
      container.querySelector('[data-wiz-empty]')?.remove();
      canvas.setImage(loaded.image, { width: loaded.width, height: loaded.height });
      refreshWizard();
    } catch {
      showToast(t('imageDecodeFailed'), 'error');
    }
  }

  async function saveWizard() {
    const result = computed();
    if (!wizard || result.scale === undefined || wizard.saving) return;
    const objective = Number(wizard.objective);
    if (!Number.isFinite(objective) || objective <= 0 || objective > 1000) {
      showToast(t('calErrObjective'), 'warning');
      return;
    }
    wizard.saving = true;
    try {
      const fallbackName = `${objective}× · ${new Date().toLocaleDateString(env.getLanguage())}`;
      const profile = createCalibrationProfile({
        name: wizard.name.trim() || fallbackName,
        objective,
        scaleUmPerPx: result.scale,
        source: 'user',
        directMeasured: true,
        referenceImageWidth: wizard.loaded.width,
        referenceImageHeight: wizard.loaded.height,
        calibrationMethod: 'stage-micrometer',
        notes: wizard.notes.trim() || null,
      });
      await addProfile(profile);
      profiles = await loadProfiles();
      showToast(t('calSaved'), 'success');
      showList();
    } catch {
      wizard.saving = false;
      showToast(t('calSaveFailed'), 'error');
      refreshWizard();
    }
  }

  async function importProfile(file) {
    if (!file) return;
    try {
      if (file.size > 100 * 1024) throw new Error('PROFILE_INVALID_FORMAT');
      const profile = parseProfileJson(await file.text());
      await addProfile(profile);
      profiles = await loadProfiles();
      showToast(t('calImported'), 'success');
      showList();
    } catch (error) {
      showToast(t(PROFILE_ERRORS[error?.message] ?? 'calImportFailed'), 'error');
    }
  }

  function onWizardAction(target) {
    switch (target.dataset.wAction) {
      case 'place':
        if (wizard.points.length < 2) {
          wizard.points.push(
            clampToImageBounds(canvas.centerImagePoint(), {
              width: wizard.loaded.width,
              height: wizard.loaded.height,
            }),
          );
          navigator.vibrate?.(10);
        }
        break;
      case 'undo':
        wizard.points.pop();
        break;
      case 'clear':
        wizard.points = [];
        break;
      case 'nudge':
        canvas.nudge(Number(target.dataset.dx), Number(target.dataset.dy));
        return;
      case 'zoom-in':
        canvas.zoomBy(1.25);
        return;
      case 'zoom-out':
        canvas.zoomBy(0.8);
        return;
      case 'fit':
        canvas.fit();
        return;
      default:
    }
    refreshWizard();
  }

  async function onClick(event) {
    const wizardButton = event.target.closest('[data-w-action]');
    if (wizardButton && wizard && canvas && wizard.loaded) {
      onWizardAction(wizardButton);
      return;
    }
    const target = event.target.closest('[data-c-action]');
    if (!target) return;
    const profile = profiles.find((p) => p.id === target.dataset.id);
    switch (target.dataset.cAction) {
      case 'c-new':
        startWizard();
        break;
      case 'c-cancel':
        showList();
        break;
      case 'use':
        if (profile) setActiveProfile(profile.objective, profile.id);
        showToast(t('calUsing'), 'success');
        showList();
        break;
      case 'export':
        if (profile) {
          await shareTextFile({
            filename: `calibration-${profile.objective}x.json`,
            text: serializeProfile(profile),
            mimeType: 'application/json',
            title: profile.name,
          });
        }
        break;
      case 'delete':
        if (profile && window.confirm(t('calDeleteConfirm'))) {
          try {
            profiles = await removeProfile(profile.id);
            showList();
          } catch {
            showToast(t('calSaveFailed'), 'error');
          }
        }
        break;
      default:
    }
  }

  function onChange(event) {
    if (event.target.matches('[data-wiz-file]')) {
      loadWizardImage(event.target.files?.[0]);
      event.target.value = '';
    } else if (event.target.matches('[data-c-import]')) {
      importProfile(event.target.files?.[0]);
      event.target.value = '';
    }
  }

  function onInput(event) {
    const field = event.target.dataset?.wField;
    if (!field || !wizard) return;
    wizard[field] = event.target.value;
    if (field !== 'distance') return;
    const result = computed();
    const submit = container.querySelector('[data-c-form="save"] button[type="submit"]');
    if (submit) submit.disabled = result.scale === undefined;
    const rows = container.querySelector('[data-wiz-results]');
    if (rows) rows.innerHTML = resultRows(result);
  }

  function onSubmit(event) {
    if (!event.target.matches('[data-c-form="save"]')) return;
    event.preventDefault();
    saveWizard();
  }

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);
  showList();
  refreshProfiles();

  mounted = {
    destroy() {
      alive = false;
      destroyCanvas();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('submit', onSubmit);
    },
  };
}
