import { PDFDocument, type PDFEmbeddedPage, type PDFImage } from 'pdf-lib';
import { isMetafile } from './metafile';

// Embeds slide pictures into the PDF. JPEG and PNG files are embedded as they
// are, and each picture only once even if it's on every slide (like a logo or
// background). Other formats (and interlaced PNGs) are converted to PNG by the browser.

export type ImageAsset =
  | { kind: 'image'; image: PDFImage }
  | { kind: 'metafile'; bytes: Uint8Array }
  | { kind: 'unsupported' };

export function dataUrlBytes(dataUrl: string) {
  return Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

export async function canvasToPng(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode an image');
  return new Uint8Array(await blob.arrayBuffer());
}

export class ImageCache {
  private doc: PDFDocument;
  private cache = new Map<string, Promise<ImageAsset>>();
  private pdfPages = new WeakMap<Uint8Array, Promise<PDFEmbeddedPage | null>>();

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  // `key` identifies the picture (pptxtojson's media path) so repeats are embedded once
  get(dataUrl: string, key = dataUrl): Promise<ImageAsset> {
    let asset = this.cache.get(key);
    if (!asset) {
      asset = this.load(dataUrl);
      this.cache.set(key, asset);
    }
    return asset;
  }

  async embedPixels(pixels: ImageData) {
    const canvas = document.createElement('canvas');
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    canvas.getContext('2d')!.putImageData(pixels, 0, 0);
    return this.doc.embedPng(await canvasToPng(canvas));
  }

  // The first page of a PDF (like one embedded in a metafile), cropped like a
  // PDF viewer shows it, and embedded once per `key`; null if pdf-lib can't read it
  pdfPage(pdf: Uint8Array, key = pdf): Promise<PDFEmbeddedPage | null> {
    let page = this.pdfPages.get(key);
    if (!page) {
      page = PDFDocument.load(pdf)
        .then((source) => {
          const first = source.getPage(0);
          const crop = first.getCropBox();
          return this.doc.embedPage(first, { left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height });
        })
        .catch(() => null);
      this.pdfPages.set(key, page);
    }
    return page;
  }

  async embedCanvas(canvas: HTMLCanvasElement) {
    return this.doc.embedPng(await canvasToPng(canvas));
  }

  private async load(dataUrl: string): Promise<ImageAsset> {
    if (!dataUrl) return { kind: 'unsupported' };
    const bytes = dataUrlBytes(dataUrl);
    if (isMetafile(bytes)) return { kind: 'metafile', bytes };
    try {
      if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: 'image', image: await this.doc.embedJpg(bytes) };
      // pdf-lib garbles the last row of interlaced PNGs, so the browser decodes those
      const interlaced = bytes[28] === 1;
      if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) && !interlaced) return { kind: 'image', image: await this.doc.embedPng(bytes) };
    } catch {
      // Unusual JPEG/PNG variants pdf-lib can't read are converted below
    }
    return this.convert(dataUrl);
  }

  // Lets the browser decode formats like GIF, BMP, WebP and SVG, and re-encodes them as PNG
  private async convert(dataUrl: string): Promise<ImageAsset> {
    const img = new Image();
    img.src = dataUrl;
    try {
      await img.decode();
    } catch {
      return { kind: 'unsupported' };
    }
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1;
    canvas.height = img.naturalHeight || 1;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { kind: 'image', image: await this.embedCanvas(canvas) };
  }
}
