import { test, expect, type Page } from '@playwright/test';
import pptxgen from 'pptxgenjs';
import { PDFDocument } from 'pdf-lib';

const KEY = 'test-account-key';
async function presentation() {
  const pptx = new pptxgen();
  pptx.addSlide().addText('Lecture slide');
  return { name: 'lecture.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: Buffer.from(await pptx.write({ outputType: 'nodebuffer' }) as Uint8Array) };
}
async function pdf(text: string, size: [number, number] = [960, 540]) {
  const doc = await PDFDocument.create();
  doc.addPage(size).drawText(text);
  return Buffer.from(await doc.save());
}
async function visit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => crossOriginIsolated, undefined, { timeout: 30_000 });
}
async function download(page: Page, action: () => Promise<unknown>) {
  const event = page.waitForEvent('download');
  await action();
  const stream = await (await event).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// Contract/UI tests, not live CloudConvert conversions. No real account keys,
// credits, or user documents are sent to the service by these tests.
async function mockCloud(page: Page, options: { fail?: boolean; pending?: boolean } = {}) {
  const uploaded: Buffer[] = [];
  const deletions: string[] = [];
  const runtimeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/libreoffice/')) runtimeRequests.push(request.url());
  });
  const headers = {
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Cross-Origin-Resource-Policy': 'cross-origin',
  };
  const converted = await pdf('Hosted lecture slide');
  // The isolation service worker forwards fetches. Context routes also capture
  // those worker-owned requests; page routes alone would hit the real network.
  await page.context().route('https://*.cloudconvert.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (request.url().startsWith('https://api.cloudconvert.com/')) {
      expect(request.headers().authorization).toBe(`Bearer ${KEY}`);
      if (request.method() === 'DELETE') {
        deletions.push(request.url());
        await route.fulfill({ status: 204, headers }); return;
      }
      if (request.method() === 'POST') {
        expect(request.postDataJSON().tasks.convert.output_format).toBe('pdf');
        await route.fulfill({ headers, json: { data: {
          id: 'mock-job', status: 'waiting', tasks: [{ name: 'upload', status: 'waiting', result: { form: {
            url: 'https://upload.cloudconvert.com/signed', parameters: { signature: 'test-signature' },
          } } }],
        } } }); return;
      }
      await route.fulfill({ headers, json: { data: {
        id: 'mock-job', status: options.fail ? 'error' : options.pending ? 'processing' : 'finished',
        tasks: [{ name: 'download', status: 'finished', result: { files: [{
          filename: 'lecture.pdf', url: 'https://storage.cloudconvert.com/lecture.pdf',
        }] } }],
      } } }); return;
    }
    expect(request.headers().authorization).toBeUndefined();
    if (request.url().startsWith('https://upload.cloudconvert.com/')) {
      uploaded.push(request.postDataBuffer()!);
      await route.fulfill({ status: 201, headers }); return;
    }
    await route.fulfill({ headers, contentType: 'application/pdf', body: converted });
  });
  return { uploaded, deletions, runtimeRequests, converted };
}

test('requires explicit hosted selection and a key, then downloads a PDF without loading WASM', async ({ page }) => {
  const cloud = await mockCloud(page);
  await visit(page, 'pptx-to-pdf');
  expect(await page.getByLabel('Convert with').inputValue()).toBe('browser');
  await page.getByLabel('Convert with').selectOption('cloudconvert');
  await expect(page.getByText(/uploaded to CloudConvert/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(await presentation());
  await expect(page.getByText('Error: Enter your CloudConvert API key before selecting presentations.')).toBeVisible();
  expect(cloud.uploaded).toHaveLength(0);
  await page.getByLabel('CloudConvert API key').fill(KEY);
  await page.locator('input[type=file]').setInputFiles(await presentation());
  await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible();
  const bytes = await download(page, () => page.getByRole('link', { name: 'Download PDF' }).click());
  expect(bytes).toEqual(cloud.converted);
  expect(cloud.uploaded).toHaveLength(1);
  expect(cloud.deletions).toHaveLength(1);
  expect(cloud.runtimeRequests).toEqual([]);
  await page.goto('pdf-combiner');
  await page.goto('pptx-to-pdf');
  await page.getByLabel('Convert with').selectOption('cloudconvert');
  await expect(page.getByLabel('CloudConvert API key')).toHaveValue('');
});

test('uploads only the PPTX and combines the returned PDF with local notes in order', async ({ page }) => {
  const cloud = await mockCloud(page);
  await visit(page, 'pdf-combiner');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'private-notes.pdf', mimeType: 'application/pdf', buffer: await pdf('Private notes', [300, 400]) },
    await presentation(),
  ]);
  await page.getByLabel('Convert with').selectOption('cloudconvert');
  await page.getByLabel('CloudConvert API key').fill(KEY);
  const bytes = await download(page, () => page.getByRole('button', { name: 'Combine 2 files' }).click());
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPages().map((p) => p.getSize())).toEqual([{ width: 300, height: 400 }, { width: 960, height: 540 }]);
  expect(cloud.uploaded).toHaveLength(1);
  expect(cloud.uploaded[0].toString()).toContain('lecture.pptx');
  expect(cloud.uploaded[0].toString()).not.toContain('private-notes.pdf');
  expect(cloud.runtimeRequests).toEqual([]);
});

test('reports provider failures without silently switching to browser conversion', async ({ page }) => {
  const cloud = await mockCloud(page, { fail: true });
  await visit(page, 'pptx-to-pdf');
  await page.getByLabel('Convert with').selectOption('cloudconvert');
  await page.getByLabel('CloudConvert API key').fill(KEY);
  await page.locator('input[type=file]').setInputFiles(await presentation());
  await expect(page.getByText(/Failed: CloudConvert could not convert/)).toBeVisible();
  expect(cloud.deletions).toHaveLength(1);
  expect(cloud.runtimeRequests).toEqual([]);
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
});

test('leaving the tool cancels polling and requests remote cleanup', async ({ page }) => {
  const cloud = await mockCloud(page, { pending: true });
  await visit(page, 'pptx-to-pdf');
  await page.getByLabel('Convert with').selectOption('cloudconvert');
  await page.getByLabel('CloudConvert API key').fill(KEY);
  await page.locator('input[type=file]').setInputFiles(await presentation());
  await expect.poll(() => cloud.uploaded.length).toBe(1);
  await page.getByRole('link', { name: 'ioctl', exact: true }).click();
  await expect.poll(() => cloud.deletions.length).toBe(1);
  expect(cloud.runtimeRequests).toEqual([]);
});
