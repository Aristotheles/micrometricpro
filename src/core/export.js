/** Pure CSV/JSON export of saved samples (spec §8). */

export const CSV_COLUMNS = [
  'id',
  'name',
  'date',
  'objective',
  'scale_um_px',
  'calibrated',
  'manual_count',
  'ai_count',
  'roi_area_mm2',
  'density_per_mm2',
  'notes',
];

const BOM = '\uFEFF';

/** Quotes a cell; neutralises spreadsheet formula injection from user text. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function roiAreaMm2(sample) {
  if (!sample.roi || !sample.calibration) return null;
  const scale = sample.calibration.scaleUmPerPx;
  if (!Number.isFinite(scale)) return null;
  const radiusMm = (sample.roi.r * scale) / 1000;
  return Math.PI * radiusMm * radiusMm;
}

export function sampleToRow(sample) {
  return [
    sample.id,
    sample.name,
    sample.createdAt,
    sample.objective,
    sample.calibration?.scaleUmPerPx,
    sample.calibrated ? 'yes' : 'no',
    sample.manualCount,
    sample.aiResult?.detections?.length,
    roiAreaMm2(sample),
    sample.densityPerMm2,
    sample.notes,
  ];
}

/** UTF-8 BOM so Excel detects the encoding; decimals use a dot; CRLF rows. */
export function samplesToCsv(samples) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const sample of samples) lines.push(sampleToRow(sample).map(csvCell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function samplesToJson(samples) {
  return JSON.stringify(
    { schemaVersion: 2, exportedAt: new Date().toISOString(), samples },
    null,
    2,
  );
}
