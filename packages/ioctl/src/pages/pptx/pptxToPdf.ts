import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { parse, type Slide } from 'pptxtojson';
import { writeLinks, type Link } from '../pdfLinks';
import { readCharts, stubCharts } from './chartXml';
import { drawSlide, drawUnreadableSlide, loadLayoutFonts } from './drawSlide';
import { FontEmbedder } from './fonts';
import { ImageCache } from './images';
import { layoutSlide, placeLineSpacing } from './layoutSlide';
import { Painter } from './painter';
import { LINK_PREFIX, preparePptx } from './preprocess';
import { embedInvisibleFont } from './textLayer';

// PowerPoint's single line spacing is about 1.2x the font size
const PARSE_OPTIONS = { imageMode: 'base64', singleLineSpacingFactor: 1.2 } as const;

// pptxtojson fails on the whole file when it can't read one slide. When that
// happens, the slides are parsed one at a time so the others still convert.
async function parseSlides(zip: JSZip): Promise<{ size: { width: number; height: number }; slides: (Slide | null)[] }> {
  const generate = () => zip.generateAsync({ type: 'arraybuffer' });
  try {
    return await parse(await generate(), PARSE_OPTIONS);
  } catch (error) {
    console.error('Reading the presentation failed, so reading its slides one at a time:', error);
    const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
    if (!contentTypes) throw error;
    let size: { width: number; height: number } | undefined;
    const slides: (Slide | null)[] = [];
    for (let n = 1; zip.file(`ppt/slides/slide${n}.xml`); n++) {
      // pptxtojson finds the slides through [Content_Types].xml, so list only this one
      const only = contentTypes.replace(/<Override[^>]*PartName="\/ppt\/slides\/slide(\d+)\.xml"[^>]*\/>/g, (match, k) => (Number(k) === n ? match : ''));
      zip.file('[Content_Types].xml', only);
      try {
        const parsed = await parse(await generate(), PARSE_OPTIONS);
        size = parsed.size;
        slides.push(parsed.slides[0] ?? null);
      } catch (slideError) {
        console.error(`Couldn't read slide ${n}:`, slideError);
        slides.push(null);
      }
    }
    zip.file('[Content_Types].xml', contentTypes);
    if (!size) throw error;
    return { size, slides };
  }
}

// A link's target on the page it's on: decodes the targets preprocessing
// passed through pptxtojson, and turns slide jumps into pages
function linkTarget(href: string, page: number, pageCount: number): Link['target'] | null {
  const target = href.startsWith(LINK_PREFIX) ? decodeURIComponent(href.slice(LINK_PREFIX.length)) : href;
  const slide = target.match(/^slide:(\d+)$/);
  if (slide) return { page: Number(slide[1]) - 1 };
  const jump = target.match(/^jump:(\w+)$/)?.[1];
  if (jump) {
    const pages: Record<string, number> = { nextslide: page + 1, previousslide: page - 1, firstslide: 0, lastslide: pageCount - 1 };
    return pages[jump] !== undefined && pages[jump] >= 0 && pages[jump] < pageCount ? { page: pages[jump] } : null;
  }
  return /^(https?|mailto|ftp):/i.test(target) ? { uri: target } : null;
}

// Copies the title, author, subject and keywords from the presentation's properties
async function setMetadata(doc: PDFDocument, zip: JSZip, fileName: string) {
  const text = await zip.file('docProps/core.xml')?.async('text');
  const core = text ? new DOMParser().parseFromString(text, 'application/xml') : null;
  const field = (name: string) => core?.getElementsByTagNameNS('*', name)[0]?.textContent?.trim() || undefined;
  doc.setTitle(field('title') ?? fileName.replace(/\.pptx$/i, ''), { showInWindowTitleBar: true });
  const author = field('creator');
  if (author) doc.setAuthor(author);
  const subject = field('subject') ?? field('description');
  if (subject) doc.setSubject(subject);
  const keywords = field('keywords');
  if (keywords) doc.setKeywords(keywords.split(/[,;]\s*/).filter(Boolean));
  doc.setCreator('ioctl PPTX to PDF');
}

// Converts a .pptx file into a PDF with one page per slide, entirely in the
// browser. The browser lays out each slide's text with the bundled fonts, and
// the slide is drawn into the PDF as vector graphics with those fonts embedded.
export async function pptxToPdf(file: File, onProgress?: (slide: number, total: number) => void) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    // Password-protected .pptx files aren't zip archives
    throw new Error(`"${file.name}" couldn't be opened. It may be password-protected or damaged.`);
  }
  const { slideNumbers } = await preparePptx(zip);
  const charts = await readCharts(zip);
  stubCharts(zip);
  const pptx = await parseSlides(zip);
  const { width, height } = pptx.size;

  const doc = await PDFDocument.create();
  await setMetadata(doc, zip, file.name);
  const links: Link[][] = [];
  const fonts = new FontEmbedder(doc);
  const images = new ImageCache(doc);
  const invisibleFont = embedInvisibleFont(doc);

  // Slides have to be in the document to be laid out, so lay them out offscreen
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0' });
  document.body.append(host);
  try {
    for (const [index, slide] of pptx.slides.entries()) {
      onProgress?.(index + 1, pptx.slides.length);
      const page = doc.addPage([width, height]);
      const painter = new Painter(page, doc);
      const ctx = { painter, fonts, images, invisibleFont, host, ptPerPx: 1, charts: charts[index] ?? [] };
      if (slide) {
        const layout = layoutSlide(slide, pptx.size, slideNumbers[index] ?? index + 1);
        host.replaceChildren(layout.root);
        await loadLayoutFonts(layout.root);
        placeLineSpacing(layout.root);
        ctx.ptPerPx = width / layout.root.getBoundingClientRect().width;
        await drawSlide(ctx, slide, layout, pptx.size);
      } else {
        await drawUnreadableSlide(ctx, pptx.size);
      }
      painter.finish();
      links.push(
        painter.links.flatMap((link) => {
          const target = linkTarget(link.target, index, pptx.slides.length);
          return target ? [{ rect: link.rect, target }] : [];
        })
      );
    }
  } finally {
    host.remove();
  }
  writeLinks(doc, links);
  return doc;
}
