import { test, expect, type Page } from '@playwright/test';
import pptxgen from 'pptxgenjs';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function presentation() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'ioctl tests';
  const first = pptx.addSlide();
  first.addText('Presentation first slide', { x: 0.5, y: 0.3, w: 8, h: 0.6, fontSize: 24, fontFace: 'Liberation Sans' });
  first.addTable([['Name', 'Value'], ['Table entry', '42']], { x: 0.5, y: 1.3, w: 4, h: 1.3, fontSize: 16 });
  first.addChart(pptx.ChartType.bar, [{ name: 'Series', labels: ['Alpha', 'Beta'], values: [10, 20] }], { x: 5, y: 1.3, w: 5, h: 3, showLegend: true, showValue: true });
  first.addText('External link', { x: 0.5, y: 4, w: 3, h: 0.5, hyperlink: { url: 'https://example.com/' } });
  first.addText('Next slide', { x: 4, y: 4, w: 3, h: 0.5, hyperlink: { slide: 2 } });
  const second = pptx.addSlide();
  second.addText('Presentation second slide', { x: 0.5, y: 0.3, w: 8, h: 1, fontSize: 24 });
  second.addImage({ data: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nO3NsQ0AAAjDsB7L/y/AE3SzlDnOTqp17wAAAAAAAAAAAOCxA8DajEwE3+ygAAAAAElFTkSuQmCC', x: 5, y: 2, w: 1, h: 1 });
  second.addShape(pptx.ShapeType.rect, { x: 1, y: 2, w: 2, h: 1, rotate: 25, fill: { color: 'FF6600' } });
  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }) as Uint8Array);
}

async function visit(page: Page, route: string) {
  await page.goto(route);
  // The headerless static server must become isolated through the service worker.
  await page.waitForFunction(() => globalThis.crossOriginIsolated, undefined, { timeout: 30_000 });
  await expect(page.locator('h2')).toBeVisible();
}

async function downloadedBytes(page: Page, action: () => Promise<unknown>) {
  const downloadPromise = page.waitForEvent('download', { timeout: 150_000 });
  await action();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function pageTexts(bytes: Uint8Array) {
  const doc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    const texts: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      texts.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
    }
    return texts;
  } finally { await doc.destroy(); }
}

test('converts a real PPTX locally with searchable slides, tables, charts, and links', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:4175/')) externalRequests.push(request.url());
  });
  await visit(page, 'pptx-to-pdf');
  await page.locator('input[type=file][accept*=".pptx"]').setInputFiles({ name: 'slides.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await presentation() });
  const link = page.getByRole('link', { name: 'Download PDF' });
  await expect(link).toBeVisible({ timeout: 150_000 });
  const bytes = await downloadedBytes(page, () => link.click());
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(960, 0);
  expect(doc.getPage(0).getHeight()).toBeCloseTo(540, 0);
  const texts = await pageTexts(bytes);
  expect(texts[0]).toContain('Presentation first slide');
  expect(texts[0]).toContain('Table entry');
  expect(texts[0]).toContain('Alpha');
  expect(texts[1]).toContain('Presentation second slide');
  const parsed = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const annotations = await (await parsed.getPage(1)).getAnnotations();
  expect(annotations.some((annotation) => annotation.url === 'https://example.com/')).toBe(true);
  expect(annotations.some((annotation) => annotation.dest)).toBe(true);
  await parsed.destroy();
  expect(externalRequests).toEqual([]);
});

test('combines PDF and PPTX in order while preserving original sizes', async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 400]).drawText('PDF notes before slides');
  await visit(page, 'pdf-combiner');
  await page.locator('input[type=file][accept*=".pptx"]').setInputFiles([
    { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) },
    { name: 'slides.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: await presentation() },
  ]);
  const bytes = await downloadedBytes(page, () => page.getByRole('button', { name: 'Combine 2 files' }).click());
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(3);
  expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 400 });
  expect(doc.getPage(1).getWidth()).toBeCloseTo(960, 0);
  const texts = await pageTexts(bytes);
  expect(texts[0]).toContain('PDF notes before slides');
  expect(texts[1]).toContain('Presentation first slide');
  expect(texts[2]).toContain('Presentation second slide');
});

test('reports a damaged presentation and continues with the next queued file', async ({ page }) => {
  await visit(page, 'pptx-to-pdf');
  await page.locator('input[type=file][accept*=".pptx"]').setInputFiles([
    { name: 'broken.pptx', mimeType: '', buffer: Buffer.from('not a presentation') },
    { name: 'valid.pptx', mimeType: '', buffer: await presentation() },
  ]);
  await expect(page.getByText('Failed:', { exact: false })).toBeVisible({ timeout: 150_000 });
  await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible({ timeout: 150_000 });
});


test('converts consecutive presentations and embeds a supplied local font in both PDFs', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:4175/')) externalRequests.push(request.url());
  });
  const pptx = new pptxgen();
  pptx.addSlide().addText('Custom local font', { x: 1, y: 1, w: 7, h: 1, fontFace: 'Ioctl Test Font' });
  const buffer = Buffer.from(await pptx.write({ outputType: 'nodebuffer' }) as Uint8Array);
  await visit(page, 'pptx-to-pdf');
  await page.getByText('Optional presentation fonts', { exact: true }).click();
  await page.getByLabel('Presentation font files').setInputFiles(fileURLToPath(new URL('./fixtures/IoctlTestFont.ttf', import.meta.url)));
  await page.locator('input[type=file][accept*=".pptx"]').setInputFiles([
    { name: 'one.pptx', mimeType: '', buffer }, { name: 'two.pptx', mimeType: '', buffer },
  ]);
  const links = page.getByRole('link', { name: 'Download PDF' });
  await expect(links).toHaveCount(2, { timeout: 150_000 });
  for (let n = 0; n < 2; n++) {
    const bytes = await downloadedBytes(page, () => links.nth(n).click());
    const doc = await PDFDocument.load(bytes);
    const fonts = doc.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFDict)
      .map(([, object]) => (object as PDFDict).get(PDFName.of('BaseFont'))?.toString() || '');
    expect(fonts.some((font) => font.includes('IoctlTestFont'))).toBe(true);
    expect((await pageTexts(bytes))[0]).toContain('Custom local font');
  }
  expect(externalRequests).toEqual([]);
});

test('requests installed-font access only on a click and keeps file selection available when denied', async ({ page }) => {
  await page.addInitScript(() => {
    let queries = 0;
    Object.defineProperty(window, 'fontQueryCount', { get: () => queries });
    Object.defineProperty(window, 'queryLocalFonts', { configurable: true, value: async () => {
      queries++;
      throw new DOMException('Denied', 'NotAllowedError');
    } });
  });
  await visit(page, 'pptx-to-pdf');
  await page.getByText('Optional presentation fonts', { exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { fontQueryCount: number }).fontQueryCount)).toBe(0);
  await page.getByRole('button', { name: 'Load installed Office fonts' }).click();
  await expect(page.getByRole('alert')).toContainText('Font access was not allowed');
  expect(await page.evaluate(() => (window as unknown as { fontQueryCount: number }).fontQueryCount)).toBe(1);
  await expect(page.getByLabel('Presentation font files')).toBeEnabled();
});
