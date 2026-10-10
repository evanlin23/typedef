import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { MAX_PAGE_SIZE, getDisplayedSize, normalizePageWidths } from './pdfPageSizes';

async function pages(...sizes: [number, number][]) {
  const doc = await PDFDocument.create();
  return sizes.map((size) => doc.addPage(size));
}

describe('normalizePageWidths', () => {
  it('scales every page to the median width, keeping aspect ratios', async () => {
    const list = await pages([612, 792], [720, 540], [1440, 1080]);
    normalizePageWidths(list);
    expect(list.map((p) => Math.round(getDisplayedSize(p).width))).toEqual([720, 720, 720]);
    expect(Math.round(getDisplayedSize(list[0]).height)).toBe(Math.round((792 * 720) / 612));
  });

  it("isn't thrown off by one huge page", async () => {
    const list = await pages([720, 540], [720, 540], [7200, 5400]);
    normalizePageWidths(list);
    expect(list.map((p) => Math.round(getDisplayedSize(p).width))).toEqual([720, 720, 720]);
  });

  it('measures rotated pages as displayed', async () => {
    const [page] = await pages([612, 792]);
    page.setRotation({ type: 'degrees', angle: 90 } as never);
    expect(getDisplayedSize(page)).toEqual({ width: 792, height: 612 });
  });

  it('keeps pages within the largest size viewers support', async () => {
    const list = await pages([100, 14000], [100, 100], [100, 100]);
    normalizePageWidths(list);
    expect(getDisplayedSize(list[0]).height).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });
});
