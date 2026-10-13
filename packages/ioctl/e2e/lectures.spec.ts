import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

interface Lecture { id: string; expectedPages: number; size: [number, number] }
const lectures: Lecture[] = JSON.parse(readFileSync(new URL('./fixtures/lectures.json', import.meta.url), 'utf8'));
const directory = process.env.IOCTL_LECTURE_FIXTURES_DIR;
test.skip(!directory, 'Set IOCTL_LECTURE_FIXTURES_DIR after running scripts/fetch-lecture-fixtures.mjs.');

async function visit(page: Page, route: string) {
  await page.goto(route);
  await page.waitForFunction(() => crossOriginIsolated, undefined, { timeout: 30_000 });
}
async function download(page: Page, action: () => Promise<unknown>) {
  const event = page.waitForEvent('download', { timeout: 150_000 });
  await action();
  const stream = await (await event).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

for (const lecture of lectures) {
  test(`converts ${lecture.id}: all ${lecture.expectedPages} lecture slides`, async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:4175/')) external.push(request.url());
    });
    await visit(page, 'pptx-to-pdf');
    await page.locator('input[type=file][accept*=".pptx"]').setInputFiles(resolve(directory!, `${lecture.id}.pptx`));
    const link = page.getByRole('link', { name: 'Download PDF' });
    await expect(link).toBeVisible({ timeout: 150_000 });
    const pdf = await PDFDocument.load(await download(page, () => link.click()));
    expect(pdf.getPageCount()).toBe(lecture.expectedPages);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(lecture.size[0], 0);
      expect(page.getHeight()).toBeCloseTo(lecture.size[1], 0);
    }
    expect(external).toEqual([]);
  });
}

test('combines three real lecture decks after local PDF notes without dropping or reordering slides', async ({ page }) => {
  test.setTimeout(300_000);
  const notes = await PDFDocument.create();
  notes.addPage([300, 400]).drawText('Local PDF notes before the lectures');
  await visit(page, 'pdf-combiner');
  await page.locator('input[type=file][accept*=".pptx"]').setInputFiles([
    { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await notes.save()) },
    ...['kth-linear-algebra', 'kth-beamforming', 'kth-practical-networks'].map((id) => ({
      name: `${id}.pptx`, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: readFileSync(resolve(directory!, `${id}.pptx`)),
    })),
  ]);
  const bytes = await download(page, () => page.getByRole('button', { name: 'Combine 4 files' }).click());
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(62);
  expect(pdf.getPage(0).getSize()).toEqual({ width: 300, height: 400 });
  const parsed = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    for (const [pageNumber, title] of [[1, 'Local PDF notes'], [2, 'Linear algebra'], [16, 'beamforming'], [42, 'Practical']] as const) {
      const content = await (await parsed.getPage(pageNumber)).getTextContent();
      const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ');
      expect(text.toLowerCase()).toContain(title.toLowerCase());
    }
  } finally { await parsed.destroy(); }
});
