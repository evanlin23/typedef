import { PDFArray, PDFName, PDFNumber, type PDFPage } from 'pdf-lib';

// Every box that defines a page's geometry. They're all scaled together so the
// visible region stays aligned with the scaled content.
const PAGE_BOXES = ['MediaBox', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox'].map((key) => PDFName.of(key));

// Acrobat can't display pages larger than 200 inches on a side
export const MAX_PAGE_SIZE = 14400;

// Size of the page as a viewer displays it (the CropBox, accounting for rotation)
export function getDisplayedSize(page: PDFPage) {
  const { width, height } = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

// Uniformly scales a page's boxes, content, and annotations by `factor`
function scalePage(page: PDFPage, factor: number) {
  for (const key of PAGE_BOXES) {
    const box = page.node.lookupMaybe(key, PDFArray);
    if (!box) continue;
    const scaled = box.asArray().map((_, i) => box.lookup(i, PDFNumber).asNumber() * factor);
    page.node.set(key, page.doc.context.obj(scaled));
  }
  page.scaleContent(factor, factor);
  page.scaleAnnotations(factor, factor);
}

// Scales every page to the median page width, preserving aspect ratios, so pages
// from differently sized PDFs don't show up tiny or huge. Unlike the widest or
// narrowest width, the median leaves most pages as they are and isn't thrown off
// by an outlier like a single poster-sized page.
export function normalizePageWidths(pages: PDFPage[]) {
  const sizes = pages.map(getDisplayedSize);
  const widths = sizes.map((size) => size.width).sort((a, b) => a - b);
  const targetWidth = widths[Math.floor(widths.length / 2)];
  pages.forEach((page, i) => {
    const { width, height } = sizes[i];
    const factor = Math.min(targetWidth / width, MAX_PAGE_SIZE / Math.max(width, height));
    if (Math.abs(factor - 1) > 1e-3) scalePage(page, factor);
  });
}
