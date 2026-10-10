import JSZip from 'jszip';
import { toCanvas } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';
import { parse } from 'pptxtojson';
import { preparePptx } from './preprocess';
import { renderSlide } from './renderSlide';
import { drawInvisibleText, embedInvisibleFont, measureTextLines } from './textLayer';

// Slides are rasterized at 2x so text stays sharp when zoomed in
const PIXEL_RATIO = 2;
const JPEG_QUALITY = 0.8;

// Converts a .pptx file into a PDF with one page per slide, entirely in the browser.
// Each slide is rendered to an image, with an invisible text layer for searching.
export async function pptxToPdf(file: File, onProgress?: (slide: number, total: number) => void) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    // Password-protected .pptx files aren't zip archives
    throw new Error(`"${file.name}" couldn't be opened. It may be password-protected or damaged.`);
  }
  await preparePptx(zip);
  // PowerPoint's single line spacing is about 1.2x the font size
  const pptx = await parse(await zip.generateAsync({ type: 'arraybuffer' }), { imageMode: 'base64', singleLineSpacingFactor: 1.2 });
  const { width, height } = pptx.size;

  const doc = await PDFDocument.create();
  const font = embedInvisibleFont(doc);

  // Slides have to be in the document to be laid out, so render them offscreen
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0' });
  document.body.append(host);
  try {
    for (const [index, slide] of pptx.slides.entries()) {
      onProgress?.(index + 1, pptx.slides.length);
      const slideNode = renderSlide(slide, pptx.size, index + 1);
      host.replaceChildren(slideNode);
      // Drop images the browser can't decode rather than failing the whole slide
      await Promise.all(Array.from(slideNode.querySelectorAll('img'), (img) => img.decode().catch(() => img.remove())));

      const lines = measureTextLines(slideNode, width / slideNode.getBoundingClientRect().width);
      const canvas = await toCanvas(slideNode, { pixelRatio: PIXEL_RATIO, skipFonts: true });
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      if (!jpeg) throw new Error(`Could not render slide ${index + 1}`);

      const page = doc.addPage([width, height]);
      page.drawImage(await doc.embedJpg(await jpeg.arrayBuffer()), { x: 0, y: 0, width, height });
      drawInvisibleText(page, font, lines);
    }
  } finally {
    host.remove();
  }
  return doc;
}
