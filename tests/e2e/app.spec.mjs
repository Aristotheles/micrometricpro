import { test, expect } from '@playwright/test';

const FAKE_KEY = ['AI', 'za', 'SyE2E_not_a_real_key_000000000000000'].join('');

async function makePng(page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    context.fillStyle = '#334455';
    context.fillRect(0, 0, 1200, 800);
    context.fillStyle = '#ffffff';
    context.fillRect(300, 300, 4, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

const click = (page, selector) => page.locator(selector).first().dispatchEvent('click');

async function repeat(page, selector, times) {
  for (let i = 0; i < times; i += 1) await click(page, selector);
}

async function drawCircle(page) {
  await click(page, "[data-a-tool='circle']");
  await click(page, "[data-a-action='place']");
  await repeat(page, "[data-a-action='nudge-down']", 60);
  await click(page, "[data-a-action='place']");
  await repeat(page, "[data-a-action='nudge-left']", 60);
  await click(page, "[data-a-action='place']");
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
});

test('onboarding completes without an API key', async ({ page }) => {
  await expect(page.locator('.onboarding')).toBeVisible();
  for (let i = 0; i < 2; i += 1) await click(page, "[data-action='onboarding-next']");
  await expect(page.locator("[data-form='onboarding-key']")).toBeVisible();
  await click(page, "[data-action='onboarding-next']");
  await expect(page.locator('[data-analysis-canvas]')).toBeVisible();
});

test('calibrate, measure, save, reopen and export CSV', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('micrometricpro.onboarded', 'true'));
  await page.reload();
  const png = await makePng(page);

  await click(page, "[data-route='calibration']");
  await click(page, "[data-c-action='c-new']");
  await page.setInputFiles('[data-wiz-file]', png);
  await click(page, "[data-w-action='place']");
  await repeat(page, "[data-w-action='nudge'][data-dx='1']", 100);
  await click(page, "[data-w-action='place']");
  await page.fill("[data-w-field='distance']", '100');
  await page.fill("[data-w-field='name']", 'Scope A');
  await click(page, '[data-c-form="save"] button[type=submit]');
  await expect(page.locator('.profile-row--user')).toContainText('Scope A');

  await click(page, "[data-route='analyze']");
  await page.setInputFiles('[data-analysis-file]', png);
  await expect(page.locator('[data-analysis-badge]')).toContainText('Calibrated');
  await drawCircle(page);
  await page.fill('[data-a-sample-name]', 'Leaf 1, =test');
  await click(page, '[data-a-form="save"] button[type=submit]');
  await expect(page.locator('.toast')).toBeVisible();

  await page.reload();
  await click(page, "[data-route='records']");
  await expect(page.locator('.record-row')).toContainText('Leaf 1');
  await click(page, '[data-r-open]');
  await expect(page.locator('.result-list')).toContainText('Scope A');

  const download = page.waitForEvent('download');
  await click(page, "[data-r-action='r-csv']");
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  expect(raw.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(raw.toString('utf8')).toContain('Leaf 1');

  await click(page, "[data-r-action='delete']");
  await expect(page.locator('.empty-card')).toBeVisible();
});

test('API key is never persisted in web storage and AI is gated by consent', async ({ page }) => {
  const requests = [];
  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });

  for (let i = 0; i < 2; i += 1) await click(page, "[data-action='onboarding-next']");
  await page.fill('#onboarding-api-key', FAKE_KEY);
  await click(page, "[data-form='onboarding-key'] button[type=submit]");
  await click(page, "[data-action='onboarding-next']");

  const png = await makePng(page);
  await page.setInputFiles('[data-analysis-file]', png);
  await drawCircle(page);
  await click(page, "[data-a-tool='ai']");
  await click(page, "[data-a-action='ai-run']");
  await expect(page.locator("[data-a-action='ai-confirm']")).toBeVisible();
  expect(requests).toHaveLength(0);

  const stored = await page.evaluate(() =>
    JSON.stringify([{ ...localStorage }, { ...sessionStorage }]),
  );
  expect(stored).not.toContain(FAKE_KEY);
  for (const url of requests) expect(url).not.toContain(FAKE_KEY);
});
test('language switch updates the document language', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('micrometricpro.onboarded', 'true'));
  await page.reload();
  await click(page, "[data-route='settings']");
  await page.selectOption("[data-setting='language']", 'tr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
});
