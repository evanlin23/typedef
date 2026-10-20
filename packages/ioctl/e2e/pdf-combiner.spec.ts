import { test, expect, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeLinks } from '../src/pages/pdfLinks';

async function pdfFile(name: string, text: string, size: [number, number], links = false) {
  const doc = await PDFDocument.create();
  doc.addPage(size).drawText(text, { x: 10, y: 40, size: 12 });
  if (links) {
    doc.addPage(size).drawText('Last slide', { x: 10, y: 40, size: 12 });
    writeLinks(doc, [[
      { rect: [10, 10, 90, 25], target: { page: 1 } },
      { rect: [100, 10, 180, 25], target: { uri: 'https://example.com/' } },
    ], []]);
  }
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

async function visit(page: Page, route = 'pdf-combiner') {
  await page.goto(route);
  await expect(page.locator('h2')).toBeVisible();
}

async function download(page: Page, button = 'Combine 2 files') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const result = await pending;
  const chunks: Buffer[] = [];
  for await (const chunk of (await result.createReadStream())!) chunks.push(Buffer.from(chunk));
  return { bytes: Buffer.concat(chunks), filename: result.suggestedFilename() };
}

test('combines exported slides and notes locally with original geometry, text, and links', async ({ page, context }) => {
  const unexpected: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    if (/libreoffice|soffice/i.test(url) || (url.startsWith('http') && new URL(url).origin !== 'http://127.0.0.1:4175')) unexpected.push(url);
  });
  await visit(page);
  await expect(page.locator('input[type=file]')).toHaveAttribute('accept', 'application/pdf,.pdf');
  await page.locator('input[type=file]').setInputFiles([
    await pdfFile('notes.pdf', 'Lecture notes', [300, 400]),
    await pdfFile('exported-slides.PDF', 'Exported lecture slides', [960, 540], true),
  ]);
  await page.getByLabel('Output filename:').fill('lecture-handout');
  const { bytes, filename } = await download(page);
  expect(filename).toBe('lecture-handout.pdf');
  const result = await PDFDocument.load(bytes);
  expect(result.getPages().map((p) => p.getSize())).toEqual([
    { width: 300, height: 400 }, { width: 960, height: 540 }, { width: 960, height: 540 },
  ]);
  const parsed = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    const texts = [];
    for (let n = 1; n <= parsed.numPages; n++) {
      const text = await (await parsed.getPage(n)).getTextContent();
      texts.push(text.items.map((item) => 'str' in item ? item.str : '').join(' '));
    }
    expect(texts).toEqual(['Lecture notes', 'Exported lecture slides', 'Last slide']);
    const annotations = await (await parsed.getPage(2)).getAnnotations();
    expect(annotations.some((a) => a.url === 'https://example.com/')).toBe(true);
    const internal = annotations.find((a) => a.dest);
    expect(internal).toBeTruthy();
    expect(await parsed.getPageIndex(internal!.dest[0])).toBe(2);
  } finally { await parsed.destroy(); }
  expect(unexpected).toEqual([]);
});

test('keeps keyboard reordering and optional width matching', async ({ page }) => {
  // Keep both drop targets in view so the sensor moves a file rather than scrolling.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await visit(page);
  await page.locator('input[type=file]').setInputFiles([
    await pdfFile('small.pdf', 'Small page', [100, 200]),
    await pdfFile('wide.pdf', 'Wide page', [200, 100]),
  ]);
  const handle = page.getByRole('button', { name: 'Drag to reorder' }).first();
  const initialY = (await page.getByRole('listitem').first().boundingBox())!.y;
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  // Wait for the visible drag displacement before dropping.
  await expect.poll(async () => (await page.getByRole('listitem').first().boundingBox())!.y).toBeGreaterThan(initialY);
  await page.keyboard.press('Space');
  await expect(page.getByRole('listitem').first()).toContainText('wide.pdf');
  await page.getByLabel('Match page widths (scales pages)').check();
  const result = await PDFDocument.load((await download(page)).bytes);
  expect(result.getPages().map((p) => p.getSize())).toEqual([
    { width: 200, height: 100 }, { width: 200, height: 400 },
  ]);
});

test('rejects presentations in a mixed drop while keeping PDFs and explaining export', async ({ page }) => {
  await visit(page);
  const pdf = await pdfFile('notes.pdf', 'Notes', [300, 400]);
  const transfer = await page.evaluateHandle(({ bytes }) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], 'notes.pdf', { type: 'application/pdf' }));
    data.items.add(new File(['presentation'], 'slides.PPTX', { type: 'application/pdf' }));
    data.items.add(new File(['old presentation'], 'old.ppt'));
    return data;
  }, { bytes: [...pdf.buffer] });
  await page.locator('#drop-zone-pdf').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('alert')).toContainText('Export PowerPoint presentations as PDF');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem')).toContainText('notes.pdf');
  await expect(page.getByRole('button', { name: 'Combine 1 files', exact: true })).toBeDisabled();
  await page.getByText('Combining PowerPoint slides? Export a PDF first', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Google Slides', exact: true })).toHaveAttribute('href', 'https://slides.google.com/');
  await expect(page.getByText('This requires uploading the presentation to Google.', { exact: false })).toBeVisible();
});

test('reports corrupt PDFs without downloading partial output and recovers after removal', async ({ page }) => {
  await visit(page);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('input[type=file]').setInputFiles([
    await pdfFile('valid.pdf', 'Valid', [300, 400]),
    { name: 'damaged.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
  ]);
  await page.getByRole('button', { name: 'Combine 2 files', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not process "damaged.pdf"');
  expect(downloads).toBe(0);
  await page.getByRole('listitem').filter({ hasText: 'damaged.pdf' }).getByTitle('Remove this file').click();
  await page.locator('input[type=file]').setInputFiles(await pdfFile('replacement.pdf', 'Replacement', [300, 400]));
  expect((await PDFDocument.load((await download(page)).bytes)).getPageCount()).toBe(2);
});

test('old converter links explain retirement and lead to the PDF combiner', async ({ page }) => {
  await visit(page, 'pptx-to-pdf');
  await expect(page.getByText('The experimental PPTX converter has been retired', { exact: false })).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open PDF Combiner' }).click();
  await expect(page.locator('h2')).toHaveText('PDF Combiner');
  await page.getByRole('link', { name: 'ioctl', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open PPTX to PDF' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open Image Animator', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Multi Image Animator', exact: true })).toBeVisible();
});
