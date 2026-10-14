/**
 * Analysis screen (stage 4): image canvas, measurement/count/AI tools and
 * the result sheet. State lives in a module-level session so the image,
 * markers and measurements survive switching tabs; the DOM is rebuilt on
 * every app render and re-bound by `mountAnalysis`.
 */

import { appBar } from '../../ui/components/app-bar.js';
import { button, card, chip, escapeHtml, icon, segmented } from '../../ui/components/primitives.js';
import { EXAMPLE_CALIBRATIONS } from '../../core/calibration.js';
import { loadCanonicalImage } from '../../core/canonical-image.js';
import { roiKey } from '../../core/roi.js';
import { prepareRoiCropImage } from '../../core/roi-crop.js';
import { createAiProvider } from '../../services/ai/provider.js';
import { getAiErrorMessage } from '../../services/ai/errors.js';
import { storeImage } from '../../storage/image-store.js';
import { upsertSample } from '../../storage/repository.js';
import { pickProfile } from '../../core/profile-io.js';
import { getActiveMap, loadProfiles } from '../../storage/profile-store.js';
import { createCanvasView } from './canvas-view.js';
import {
  addManualMarker,
  applyAiResult,
  buildSample,
  clearTool,
  computeResults,
  createWorkspace,
  DEFAULT_OBJECTIVE,
  isAiStale,
  niceScaleBar,
  placePoint,
  removeMarkerNear,
  setObjective,
  TOOLS,
  undoMarker,
  undoPoint,
} from './workspace.js';

const CONSENT_KEY = 'micrometricpro.aiConsent';
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MARKER_HIT_CSS_PX = 22;
const TOOL_ICONS = { length: 'ruler', circle: 'target', count: 'plus', ai: 'sparkles' };
const TOOL_LABELS = {
  length: 'toolLength',
  circle: 'toolCircle',
  count: 'toolCount',
  ai: 'toolAi',
};
const TOOL_HINTS = {
  length: 'hintLength',
  circle: 'hintCircle',
  count: 'hintCount',
  ai: 'hintAi',
};
const COLORS = {
  accent: '#8de0c1',
  warning: '#f5c96a',
  ai: '#c5a9ff',
  ink: 'rgb(0 0 0 / 60%)',
};

const session = {
  profiles: [],
  loaded: null,
  workspace: null,
  tool: 'count',
  view: null,
  sampleName: '',
  consentPrompt: false,
  aiBusy: false,
  aiAbort: null,
  saving: false,
  mounted: null,
};

export function hasAiConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

export function revokeAiConsent() {
  localStorage.removeItem(CONSENT_KEY);
}

function pulse() {
  navigator.vibrate?.(10);
}

function stageMarkup(t) {
  const empty = session.loaded
    ? ''
    : `<label class="stage__empty" for="analysis-file">${icon('microscope')}<strong>${t('canvasReady')}</strong><span>${t('canvasDescription')}</span><span class="button button--primary">${icon('image')}<span>${t('chooseImage')}</span></span><small>${t('imageSupport')}</small></label>`;
  return `<div class="stage"><canvas class="stage__canvas" data-analysis-canvas role="img" aria-label="${t('canvasLabel')}"></canvas><div class="stage__badges" data-analysis-badge></div>${empty}<input class="sr-only" id="analysis-file" data-analysis-file type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1"></div>`;
}

export function analysisScreen(t) {
  const header = appBar({ eyebrow: t('eyebrowWorkspace'), title: t('analyzeTitle') });
  return `${header}<div class="screen-content screen-content--analysis" data-analysis>${card(`${stageMarkup(t)}<p class="stage__hint" data-analysis-hint></p>`, { className: 'analysis-card' })}<div class="analysis-panels" data-analysis-panels></div></div>`;
}

export function unmountAnalysis() {
  session.mounted?.destroy();
  session.mounted = null;
}

export function mountAnalysis(root, env) {
  unmountAnalysis();
  const container = root.querySelector('[data-analysis]');
  const canvasElement = root.querySelector('[data-analysis-canvas]');
  if (!container || !canvasElement) return;
  const { t, showToast } = env;
  const format = (value, digits) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat(env.getLanguage(), {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        }).format(value)
      : '—';

  const profileFor = (objective) =>
    pickProfile(session.profiles, objective, getActiveMap()[objective]);
  loadProfiles()
    .then((profiles) => {
      session.profiles = profiles;
      const workspace = session.workspace;
      if (workspace && session.mounted) {
        const objective = workspace.profile.objective;
        setObjective(workspace, objective, profileFor(objective));
        refresh();
      }
    })
    .catch(() => {});

  const canvas = createCanvasView(canvasElement, {
    onViewChange(view) {
      session.view = view;
    },
    onTap(screenPoint, imagePoint) {
      const workspace = session.workspace;
      if (!workspace) return;
      if (session.tool === 'count') {
        const zoom = canvas.getView().zoom;
        if (!removeMarkerNear(workspace, imagePoint, MARKER_HIT_CSS_PX / zoom)) {
          addManualMarker(workspace, imagePoint);
        }
        pulse();
        refresh();
      } else {
        canvas.centerOn(imagePoint);
      }
    },
    drawOverlay: drawOverlay,
  });

  function toastForError(error) {
    const messages = {
      DEGENERATE_CIRCLE: t('errorCollinear'),
      ROI_OUT_OF_BOUNDS: t('circleOutOfBounds'),
    };
    showToast(messages[error?.message] ?? getAiErrorMessage(error, t), 'warning');
  }

  function drawOverlay(ctx, view) {
    const workspace = session.workspace;
    if (!workspace) return;
    const toScreen = (point) => ({
      x: view.offsetX + point.x * view.zoom,
      y: view.offsetY + point.y * view.zoom,
    });
    const results = computeResults(workspace);
    const dot = (point, radius, { fill, stroke, alpha = 1, hollow = false }) => {
      const p = toScreen(point);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      if (!hollow) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke ?? '#fff';
      ctx.stroke();
      ctx.restore();
    };
    const label = (text, point, color = '#fff') => {
      const p = toScreen(point);
      ctx.save();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.ink;
      ctx.fillStyle = color;
      ctx.strokeText(text, p.x + 8, p.y - 8);
      ctx.fillText(text, p.x + 8, p.y - 8);
      ctx.restore();
    };

    if (workspace.roi) {
      const center = toScreen(workspace.roi);
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, workspace.roi.r * view.zoom, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(141 224 193 / 8%)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.accent;
      ctx.stroke();
      ctx.restore();
    }
    workspace.circlePoints.forEach((point, index) => {
      dot(point, 5, { fill: COLORS.accent, stroke: '#fff' });
      label(['A', 'B', 'C'][index], point);
    });

    const [a, b] = workspace.lengthPoints;
    if (a && b) {
      const sa = toScreen(a);
      const sb = toScreen(b);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.warning;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      ctx.restore();
    }
    workspace.lengthPoints.forEach((point, index) => {
      dot(point, 5, { fill: COLORS.warning, stroke: '#fff' });
      label(index === 0 ? 'A' : 'B', point, COLORS.warning);
    });
    if (results.length) {
      label(`${format(results.length.um, 2)} µm`, {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
    }

    const markers = workspace.markerState.markers;
    markers.forEach((marker, index) => {
      const inside =
        !workspace.roi ||
        Math.hypot(marker.x - workspace.roi.x, marker.y - workspace.roi.y) <= workspace.roi.r;
      dot(marker, 5, { fill: COLORS.accent, alpha: inside ? 1 : 0.4 });
      if (markers.length <= 60) label(String(index + 1), marker);
    });

    if (workspace.ai && !isAiStale(workspace)) {
      workspace.ai.detections.forEach((point) =>
        dot(point, 6, { fill: COLORS.ai, stroke: '#fff' }),
      );
      workspace.ai.ambiguous.forEach((point) => dot(point, 6, { stroke: COLORS.ai, hollow: true }));
    }

    if (results.calibrated) {
      const bar = niceScaleBar(results.scaleUmPerPx, view.zoom);
      if (bar) {
        const { height } = canvas.getViewport();
        const x = 14;
        const y = height - 18;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.ink;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + bar.cssPx, y);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 3;
        const text = bar.lengthUm >= 1000 ? `${bar.lengthUm / 1000} mm` : `${bar.lengthUm} µm`;
        ctx.strokeText(text, x, y - 8);
        ctx.fillText(text, x, y - 8);
        ctx.restore();
      }
    }
  }

  function row(labelKey, value, tone = '') {
    return `<div class="result-row${tone ? ` result-row--${tone}` : ''}"><span>${t(labelKey)}</span><strong>${value}</strong></div>`;
  }

  function resultsMarkup() {
    const workspace = session.workspace;
    const results = computeResults(workspace);
    const rows = [
      row(
        'resultScale',
        `${format(results.scaleUmPerPx, 5)} ${t('scaleUnit')} ${chip(t(results.calibrated ? 'calibratedBadge' : 'exampleProfile'), { tone: results.calibrated ? 'success' : 'warning' })}`,
      ),
    ];
    if (results.length) {
      rows.push(
        row(
          'resultLength',
          `${format(results.length.px, 1)} px → ${format(results.length.um, 2)} µm`,
        ),
      );
    }
    if (results.circle) {
      rows.push(
        row('resultRoiDiameter', `${format(results.circle.diameterUm, 1)} µm`),
        row('resultRoiArea', `${format(results.circle.areaMm2, 4)} mm²`),
      );
    }
    rows.push(row('resultManualCount', String(results.manualCount), 'strong'));
    if (results.manualDensityPerMm2 !== null) {
      rows.push(
        row('resultManualDensity', `${format(results.manualDensityPerMm2, 1)} ${t('unitPerMm2')}`),
      );
    }
    if (results.aiCount !== null) {
      rows.push(row('resultAiCount', String(results.aiCount), 'ai'));
      rows.push(row('resultAiDensity', `${format(results.aiDensityPerMm2, 1)} ${t('unitPerMm2')}`));
      const { difference, percentageDifference } = results.comparison;
      const sign = difference > 0 ? '+' : '';
      rows.push(
        row(
          'resultDifference',
          `${sign}${difference}${percentageDifference === null ? '' : ` (${format(percentageDifference, 1)}%)`}`,
        ),
      );
    }
    const warning = results.calibrated
      ? ''
      : `<div class="notice notice--warning">${icon('shield')}<p>${t('exampleWarning')}</p></div>`;
    return `<div class="section-heading"><div><p class="eyebrow">${t('eyebrowWorkspace')}</p><h2>${t('resultsTitle')}</h2></div></div><div class="result-list">${rows.join('')}</div>${warning}<form class="save-form" data-a-form="save"><label class="field"><span class="field__label">${t('sampleNameLabel')}</span><input class="input" name="sample-name" maxlength="80" autocomplete="off" placeholder="${escapeHtml(t('sampleNamePlaceholder'))}" value="${escapeHtml(session.sampleName)}" data-a-sample-name></label>${button(t('saveSample'), { variant: 'primary', type: 'submit', iconName: 'check', disabled: session.saving, className: 'button--wide' })}</form>`;
  }

  function aiPanelMarkup() {
    const workspace = session.workspace;
    if (!workspace.roi) {
      return `<div class="notice">${icon('sparkles')}<p>${t('aiNeedsRoi')}</p></div><button class="button button--secondary" type="button" data-a-tool="circle">${icon('target')}<span>${t('drawCircle')}</span></button>`;
    }
    if (session.aiBusy) {
      return `<div class="notice">${icon('sparkles')}<p>${t('aiRunning')}</p></div><button class="button button--secondary" type="button" data-a-action="ai-abort">${t('cancel')}</button>`;
    }
    if (session.consentPrompt) {
      return `<div class="notice notice--warning">${icon('shield')}<div><strong>${t('aiConsentTitle')}</strong><p>${t('aiConsentBody')}</p></div></div><div class="button-row"><button class="button button--primary" type="button" data-a-action="ai-confirm">${t('aiConsentConfirm')}</button><button class="button button--secondary" type="button" data-a-action="ai-decline">${t('cancel')}</button></div>`;
    }
    let summary = '';
    if (workspace.ai) {
      const stale = isAiStale(workspace);
      summary = `<p class="muted-note">${stale ? t('aiStale') : t('aiSummary', { detected: workspace.ai.detections.length, uncertain: workspace.ai.ambiguous.length })}</p><p class="muted-note">${t('aiLegend')}</p>${workspace.ai.warnings.map((warning) => `<p class="muted-note">${escapeHtml(warning)}</p>`).join('')}`;
    }
    return `<button class="button button--primary" type="button" data-a-action="ai-run">${icon('sparkles')}<span>${t('runAi')}</span></button>${summary}`;
  }

  function panelsMarkup() {
    if (!session.workspace) return '';
    const disabled = session.loaded ? '' : ' disabled';
    const tool = session.tool;
    const tiles = TOOLS.map(
      (id) =>
        `<button class="tool-tile${id === 'ai' ? ' tool-tile--ai' : ''}${tool === id ? ' is-active' : ''}" type="button" data-a-tool="${id}" aria-pressed="${tool === id}">${icon(TOOL_ICONS[id])}<span>${t(TOOL_LABELS[id])}</span></button>`,
    ).join('');
    const iconButton = (action, iconName, label, { className = '', data = '' } = {}) =>
      `<button class="button button--secondary button--square ${className}" type="button" data-a-action="${action}"${data} aria-label="${escapeHtml(label)}">${icon(iconName)}</button>`;
    const nudge = (direction, dx, dy, labelKey) =>
      iconButton(`nudge-${direction}`, 'arrow', t(labelKey), {
        className: `nudge nudge--${direction}`,
        data: ` data-dx="${dx}" data-dy="${dy}"`,
      });
    const pointTool = tool === 'length' || tool === 'circle';
    const primaryAction = pointTool
      ? `<button class="button button--primary" type="button" data-a-action="place"${disabled}>${icon('target')}<span>${t('placePoint')}</span></button>`
      : tool === 'count'
        ? `<button class="button button--primary" type="button" data-a-action="add-marker"${disabled}>${icon('plus')}<span>${t('addMarkerAtCrosshair')}</span></button>`
        : '';
    const editButtons =
      tool === 'ai'
        ? ''
        : `${iconButton('undo', 'undo', t('undo'))}${iconButton('clear', 'trash', t('clearTool'))}`;
    const controls = `<div class="control-row">${primaryAction}<div class="control-row__group">${editButtons}</div></div><div class="control-row control-row--view"><div class="nudge-pad" role="group" aria-label="1 px">${nudge('up', 0, -1, 'nudgeUp')}${nudge('left', -1, 0, 'nudgeLeft')}${nudge('right', 1, 0, 'nudgeRight')}${nudge('down', 0, 1, 'nudgeDown')}</div><div class="control-row__group">${iconButton('zoom-out', 'minus', t('zoomOut'))}${iconButton('fit', 'fit', t('fitView'))}${iconButton('zoom-in', 'plus', t('zoomIn'))}</div></div>`;
    const objectiveOptions = Object.keys(EXAMPLE_CALIBRATIONS).map((objective) => ({
      value: objective,
      label: `${objective}×`,
    }));
    const objectives = segmented({
      label: t('objectiveLabel'),
      name: 'analysis-objective',
      selected: String(session.workspace.profile.objective),
      options: objectiveOptions,
    });
    const changeImage = `<label class="text-link" for="analysis-file">${icon('image')}${t('changeImage')}</label>`;
    return `${card(`<div class="section-heading"><div><p class="eyebrow">${t('eyebrowWorkspace')}</p><h2>${t('analysisTools')}</h2></div>${changeImage}</div><div class="tool-grid">${tiles}</div>${controls}${tool === 'ai' ? `<div class="ai-panel">${aiPanelMarkup()}</div>` : ''}${objectives}`)}${card(resultsMarkup())}`;
  }

  function hintText() {
    if (!session.workspace) return t('imageSupport');
    const workspace = session.workspace;
    let progress = '';
    if (session.tool === 'length') {
      progress = ` ${t('pointsProgress', { done: workspace.lengthPoints.length, total: 2 })}`;
    } else if (session.tool === 'circle') {
      progress = ` ${t('pointsProgress', { done: workspace.circlePoints.length, total: 3 })}`;
    }
    return `${t(TOOL_HINTS[session.tool])}${progress}`;
  }

  function badgeMarkup() {
    if (!session.workspace) return '';
    const calibrated = computeResults(session.workspace).calibrated;
    return chip(t(calibrated ? 'calibratedBadge' : 'uncalibratedBadge'), {
      tone: calibrated ? 'success' : 'warning',
    });
  }

  function refresh() {
    const panels = container.querySelector('[data-analysis-panels]');
    const hint = container.querySelector('[data-analysis-hint]');
    const badge = container.querySelector('[data-analysis-badge]');
    if (panels) panels.innerHTML = panelsMarkup();
    if (hint) hint.textContent = hintText();
    if (badge) badge.innerHTML = badgeMarkup();
    canvas.render();
  }

  async function loadFile(file) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      showToast(t('imageUnsupported'), 'warning');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast(t('imageTooLarge'), 'warning');
      return;
    }
    try {
      const loaded = await loadCanonicalImage(file);
      if (session.loaded) URL.revokeObjectURL(session.loaded.url);
      session.aiAbort?.abort();
      session.loaded = loaded;
      session.workspace = createWorkspace({
        width: loaded.width,
        height: loaded.height,
        profile: profileFor(DEFAULT_OBJECTIVE),
      });
      session.view = null;
      session.sampleName = '';
      session.consentPrompt = false;
      session.aiBusy = false;
      container.querySelector('.stage__empty')?.remove();
      canvas.setImage(loaded.image, { width: loaded.width, height: loaded.height });
      refresh();
    } catch {
      showToast(t('imageDecodeFailed'), 'error');
    }
  }

  async function runAi() {
    const { workspace, loaded } = session;
    if (!workspace?.roi || session.aiBusy) return;
    const requestedRoi = roiKey(workspace.roi);
    const controller = new AbortController();
    session.aiAbort = controller;
    session.aiBusy = true;
    refresh();
    try {
      const crop = await prepareRoiCropImage(loaded.image, workspace.roi);
      const settings = env.getSettings();
      const provider = createAiProvider({ model: settings.model });
      const result = await provider.analyzeStomata({
        imageBase64: crop.imageBase64,
        mimeType: crop.imageMimeType,
        signal: controller.signal,
        systemPrompt: settings.prompt,
      });
      if (
        session.workspace !== workspace ||
        !workspace.roi ||
        roiKey(workspace.roi) !== requestedRoi
      )
        return;
      applyAiResult(workspace, result, crop.cropRect);
      showToast(t('aiDone'), 'success');
    } catch (error) {
      if (session.workspace !== workspace) return;
      if (controller.signal.aborted) {
        showToast(t('aiCancelled'));
      } else {
        showToast(getAiErrorMessage(error, t), 'error');
      }
    } finally {
      if (session.workspace === workspace) {
        session.aiBusy = false;
        session.aiAbort = null;
        session.mounted?.refresh();
      }
    }
  }

  async function saveSample() {
    const { workspace, loaded } = session;
    if (!workspace || !loaded || session.saving) return;
    session.saving = true;
    refresh();
    try {
      const id = `sample-${Date.now()}`;
      const stored = await storeImage({
        imageId: id,
        arrayBuffer: loaded.arrayBuffer,
        mimeType: loaded.mimeType,
        originalName: loaded.originalName,
        width: loaded.width,
        height: loaded.height,
      });
      const now = new Date();
      const sample = buildSample(workspace, {
        id,
        name: session.sampleName.trim() || now.toLocaleString(env.getLanguage()),
        imageRef: stored.path,
        imageHash: loaded.hash,
        now,
      });
      await upsertSample(sample);
      showToast(t('toastSampleSaved'), 'success');
    } catch {
      showToast(t('toastSaveFailed'), 'error');
    } finally {
      session.saving = false;
      session.mounted?.refresh();
    }
  }

  function perform(action, target) {
    const workspace = session.workspace;
    switch (action) {
      case 'zoom-in':
        canvas.zoomBy(1.4);
        return;
      case 'zoom-out':
        canvas.zoomBy(1 / 1.4);
        return;
      case 'fit':
        canvas.fit();
        return;
      case 'nudge-up':
      case 'nudge-down':
      case 'nudge-left':
      case 'nudge-right':
        canvas.nudge(Number(target.dataset.dx), Number(target.dataset.dy));
        return;
      case 'ai-abort':
        session.aiAbort?.abort();
        return;
      case 'ai-run':
        if (hasAiConsent()) runAi();
        else {
          session.consentPrompt = true;
          refresh();
        }
        return;
      case 'ai-confirm':
        localStorage.setItem(CONSENT_KEY, 'true');
        session.consentPrompt = false;
        runAi();
        return;
      case 'ai-decline':
        session.consentPrompt = false;
        refresh();
        return;
      default:
    }
    if (!workspace) return;
    switch (action) {
      case 'place':
        try {
          placePoint(workspace, session.tool, canvas.centerImagePoint());
          pulse();
        } catch (error) {
          toastForError(error);
        }
        break;
      case 'add-marker':
        addManualMarker(workspace, canvas.centerImagePoint());
        pulse();
        break;
      case 'undo':
        if (session.tool === 'count') undoMarker(workspace);
        else undoPoint(workspace, session.tool);
        break;
      case 'clear':
        clearTool(workspace, session.tool);
        break;
      default:
        throw new Error(`Unknown analysis action: ${action}`);
    }
    refresh();
  }

  function onClick(event) {
    const toolButton = event.target.closest('[data-a-tool]');
    if (toolButton) {
      session.tool = toolButton.dataset.aTool;
      session.consentPrompt = false;
      refresh();
      return;
    }
    const actionButton = event.target.closest('[data-a-action]');
    if (actionButton && !actionButton.disabled) perform(actionButton.dataset.aAction, actionButton);
  }

  function onChange(event) {
    const target = event.target;
    if (target.matches('[data-analysis-file]')) {
      loadFile(target.files?.[0]);
      target.value = '';
    } else if (target.matches('input[name="analysis-objective"]') && session.workspace) {
      setObjective(session.workspace, Number(target.value), profileFor(Number(target.value)));
      refresh();
    }
  }

  function onInput(event) {
    if (event.target.matches('[data-a-sample-name]')) session.sampleName = event.target.value;
  }

  function onSubmit(event) {
    if (!event.target.matches('[data-a-form="save"]')) return;
    event.preventDefault();
    saveSample();
  }

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);

  if (session.loaded) {
    container.querySelector('.stage__empty')?.remove();
    canvas.setImage(
      session.loaded.image,
      { width: session.loaded.width, height: session.loaded.height },
      session.view,
    );
  }
  refresh();

  session.mounted = {
    refresh,
    destroy() {
      canvas.destroy();
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('submit', onSubmit);
    },
  };
}
