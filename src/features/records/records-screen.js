/**
 * Records screen: list, search, open, rename, delete, and CSV/JSON export.
 * Values shown here are the ones stored with the sample; nothing is recomputed
 * from a different calibration profile.
 */

import { appBar } from '../../ui/components/app-bar.js';
import {
  button,
  card,
  chip,
  emptyState,
  escapeHtml,
  icon,
} from '../../ui/components/primitives.js';
import { samplesToCsv, samplesToJson } from '../../core/export.js';
import { deleteSample, loadSamples, upsertSample } from '../../storage/repository.js';
import { deleteImage, readImageBase64 } from '../../storage/image-store.js';
import { shareTextFile } from '../../services/share-file.js';

let mounted = null;

export function recordsScreen(t) {
  const header = appBar({ eyebrow: t('eyebrowLibrary'), title: t('recordsTitle') });
  return `${header}<div class="screen-content" data-records></div>`;
}

export function unmountRecords() {
  mounted?.destroy();
  mounted = null;
}

function mimeFor(path) {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function mountRecords(root, env) {
  unmountRecords();
  const container = root.querySelector('[data-records]');
  if (!container) return;
  const { t, showToast } = env;
  const locale = env.getLanguage();
  const number = (value, digits = 2) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)
      : '—';
  const dateText = (iso) => new Date(iso).toLocaleString(locale);

  let samples = [];
  let query = '';
  let openId = null;
  const selected = new Set();
  let alive = true;
  let imageUrl = null;

  function visible() {
    const q = query.trim().toLowerCase();
    return samples.filter((s) => !q || String(s.name).toLowerCase().includes(q));
  }

  function row(sample) {
    const checked = selected.has(sample.id) ? ' checked' : '';
    const badge = chip(t(sample.calibrated ? 'calibratedBadge' : 'uncalibratedBadge'), {
      tone: sample.calibrated ? 'success' : 'warning',
    });
    return `<article class="record-row"><label class="record-row__select"><input type="checkbox" data-r-select="${sample.id}"${checked} aria-label="${t('recSelect')}"></label><button class="record-row__main" type="button" data-r-open="${sample.id}"><strong>${escapeHtml(sample.name)}</strong><span>${dateText(sample.createdAt)} · ${sample.objective}× · ${t('resultManualCount')}: ${sample.manualCount ?? 0}</span></button>${badge}</article>`;
  }

  function listMarkup() {
    if (!samples.length) {
      return `<p class="screen-intro">${t('recordsIntro')}</p>${card(emptyState({ iconName: 'records', title: t('recordsEmptyTitle'), description: t('recordsEmptyDescription') }), { className: 'empty-card' })}`;
    }
    const rows = visible();
    const exportCount = selected.size || rows.length;
    return `<p class="screen-intro">${t('recordsIntro')}</p>${card(`<label class="field"><span class="field__label">${t('recSearch')}</span><input class="input" type="search" data-r-search value="${escapeHtml(query)}" autocomplete="off"></label><div class="button-row"><button class="button button--secondary" type="button" data-r-action="r-csv">${icon('arrow')}<span data-r-label="recExportCsv">${t('recExportCsv')} (${exportCount})</span></button><button class="button button--secondary" type="button" data-r-action="r-json">${icon('arrow')}<span data-r-label="recExportJson">${t('recExportJson')} (${exportCount})</span></button></div><div class="record-list">${rows.length ? rows.map(row).join('') : `<p class="muted-note">${t('recNoMatch')}</p>`}</div>`, { className: 'records-card' })}`;
  }

  async function detailMarkup(sample) {
    const rows = [];
    const add = (label, value, cls = '') =>
      rows.push(
        `<div class="result-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`,
      );
    add(t('recDate'), dateText(sample.createdAt));
    add(t('objectiveLabel'), `${sample.objective}×`);
    add(
      t('resultScale'),
      `${number(sample.calibration?.scaleUmPerPx, 5)} ${t('scaleUnit')} ${chip(t(sample.calibrated ? 'calibratedBadge' : 'exampleProfile'), { tone: sample.calibrated ? 'success' : 'warning' })}`,
    );
    if (sample.calibration?.name) add(t('calProfileName'), escapeHtml(sample.calibration.name));
    const length = sample.measurements?.length;
    if (length) add(t('resultLength'), `${number(length.um)} µm`);
    const circle = sample.measurements?.circle;
    if (circle) {
      add(t('resultRoiDiameter'), `${number(circle.diameterUm)} µm`);
      add(t('resultRoiArea'), `${number(circle.areaMm2, 4)} mm²`);
    }
    add(t('resultManualCount'), String(sample.manualCount ?? 0), 'result-row--strong');
    if (Number.isFinite(sample.densityPerMm2)) {
      add(t('resultManualDensity'), `${number(sample.densityPerMm2, 1)} ${t('unitPerMm2')}`);
    }
    if (sample.aiResult) {
      add(t('resultAiCount'), String(sample.aiResult.detections.length), 'result-row--ai');
    }
    const warning = sample.calibrated
      ? ''
      : `<div class="notice notice--warning">${icon('shield')}<p>${t('exampleWarning')}</p></div>`;
    let image;
    try {
      const data = await readImageBase64(sample.imageRef);
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      imageUrl = URL.createObjectURL(new Blob([bytes], { type: mimeFor(sample.imageRef) }));
      image = `<img class="record-image" src="${imageUrl}" alt="${escapeHtml(sample.name)}">`;
    } catch {
      image = `<p class="muted-note">${t('recImageMissing')}</p>`;
    }
    return `<button class="text-link" type="button" data-r-action="back">${t('recBack')}</button>${card(`${image}<form class="save-form" data-r-form="rename"><label class="field"><span class="field__label">${t('sampleNameLabel')}</span><input class="input" name="name" maxlength="80" autocomplete="off" value="${escapeHtml(sample.name)}"></label>${button(t('recRename'), { variant: 'secondary', type: 'submit', iconName: 'check' })}</form><div class="result-list">${rows.join('')}</div>${warning}<div class="button-row"><button class="button button--secondary" type="button" data-r-action="r-csv">${icon('arrow')}<span>${t('recExportCsv')}</span></button><button class="button button--secondary" type="button" data-r-action="r-json">${icon('arrow')}<span>${t('recExportJson')}</span></button><button class="button button--secondary" type="button" data-r-action="delete">${icon('trash')}<span>${t('calDelete')}</span></button></div>`)}`;
  }

  async function render() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      imageUrl = null;
    }
    if (openId) {
      const sample = samples.find((s) => s.id === openId);
      if (sample) {
        const markup = await detailMarkup(sample);
        if (alive) container.innerHTML = markup;
        return;
      }
      openId = null;
    }
    container.innerHTML = listMarkup();
  }

  async function reload() {
    try {
      const database = await loadSamples();
      samples = [...database.samples].sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      );
    } catch {
      samples = [];
      showToast(t('recLoadFailed'), 'error');
    }
    if (alive) await render();
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  function chosen() {
    if (openId) return samples.filter((s) => s.id === openId);
    return selected.size ? samples.filter((s) => selected.has(s.id)) : visible();
  }

  async function onClick(event) {
    const open = event.target.closest('[data-r-open]');
    if (open) {
      openId = open.dataset.rOpen;
      await render();
      return;
    }
    const target = event.target.closest('[data-r-action]');
    if (!target) return;
    const list = chosen();
    switch (target.dataset.rAction) {
      case 'back':
        openId = null;
        await render();
        break;
      case 'r-csv':
        if (list.length) {
          await shareTextFile({
            filename: `micrometricpro-${stamp()}.csv`,
            text: samplesToCsv(list),
            mimeType: 'text/csv',
            title: 'MicrometricPro CSV',
          });
        }
        break;
      case 'r-json':
        if (list.length) {
          await shareTextFile({
            filename: `micrometricpro-${stamp()}.json`,
            text: samplesToJson(list),
            mimeType: 'application/json',
            title: 'MicrometricPro JSON',
          });
        }
        break;
      case 'delete': {
        const sample = samples.find((s) => s.id === openId);
        if (sample && window.confirm(t('recDeleteConfirm'))) {
          try {
            await deleteSample(sample.id);
            await deleteImage(sample.imageRef);
            selected.delete(sample.id);
            openId = null;
            showToast(t('recDeleted'), 'success');
            await reload();
          } catch {
            showToast(t('recDeleteFailed'), 'error');
          }
        }
        break;
      }
      default:
    }
  }

  function updateExportLabels() {
    const count = selected.size || visible().length;
    container.querySelectorAll('[data-r-label]').forEach((label) => {
      label.textContent = `${t(label.dataset.rLabel)} (${count})`;
    });
  }

  function onChange(event) {
    const id = event.target.dataset?.rSelect;
    if (!id) return;
    if (event.target.checked) selected.add(id);
    else selected.delete(id);
    updateExportLabels();
  }

  function onInput(event) {
    if (!event.target.matches('[data-r-search]')) return;
    query = event.target.value;
    const list = container.querySelector('.record-list');
    if (!list) return;
    const rows = visible();
    list.innerHTML = rows.length
      ? rows.map(row).join('')
      : `<p class="muted-note">${t('recNoMatch')}</p>`;
    updateExportLabels();
  }

  async function onSubmit(event) {
    if (!event.target.matches('[data-r-form="rename"]')) return;
    event.preventDefault();
    const sample = samples.find((s) => s.id === openId);
    const name = new FormData(event.target).get('name')?.toString().trim();
    if (!sample || !name) return;
    try {
      const updated = { ...sample, name, updatedAt: new Date().toISOString() };
      await upsertSample(updated);
      samples = samples.map((s) => (s.id === updated.id ? updated : s));
      showToast(t('recRenamed'), 'success');
    } catch {
      showToast(t('toastSaveFailed'), 'error');
    }
  }

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  container.addEventListener('input', onInput);
  container.addEventListener('submit', onSubmit);
  reload();

  mounted = {
    destroy() {
      alive = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('submit', onSubmit);
    },
  };
}
