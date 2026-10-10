import type JSZip from 'jszip';
import { resolveColor, type ColorTheme } from './drawingColor';
import { A, IMAGE_REL, P, R, addRelationship, child, readXml, relationshipTarget } from './ooxml';

// PowerPoint can recolor pictures (duotone, grayscale, black and white,
// brightness/contrast, a transparent color) and tile them as backgrounds.
// pptxtojson shows pictures as they are, so the effects are baked into new
// images in the presentation before it's parsed.

const EFFECTS = ['duotone', 'grayscl', 'biLevel', 'lum', 'clrChange', 'alphaModFix'];
const RASTER = /\.(png|jpe?g|gif|bmp|webp)$/i;
// Large pictures are scaled down to this many pixels on their longest side
const MAX_SIZE = 3000;

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function applyEffect(pixels: Uint8ClampedArray, effect: Element, colors: ColorTheme) {
  const val = (name: string, fallback = 0) => Number(effect.getAttribute(name) ?? fallback) / 100000;
  switch (effect.localName) {
    case 'duotone': {
      // Dark parts take the first color, light parts the second
      const [dark, light] = Array.from(effect.children, (c) => resolveColor(c, colors));
      if (!dark || !light) return;
      for (let i = 0; i < pixels.length; i += 4) {
        const t = luminance(pixels[i], pixels[i + 1], pixels[i + 2]) / 255;
        pixels[i] = (dark.r + (light.r - dark.r) * t) * 255;
        pixels[i + 1] = (dark.g + (light.g - dark.g) * t) * 255;
        pixels[i + 2] = (dark.b + (light.b - dark.b) * t) * 255;
      }
      return;
    }
    case 'grayscl':
    case 'biLevel': {
      const threshold = val('thresh', 50000) * 255;
      for (let i = 0; i < pixels.length; i += 4) {
        const l = luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
        const v = effect.localName === 'grayscl' ? l : l >= threshold ? 255 : 0;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      }
      return;
    }
    case 'lum': {
      const bright = val('bright');
      const contrast = val('contrast');
      const adjust = (v: number) => {
        let x = v / 255;
        x = contrast > 0 ? (x - 0.5) / Math.max(0.01, 1 - contrast) + 0.5 : (x - 0.5) * (1 + contrast) + 0.5;
        return (x + bright) * 255;
      };
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = adjust(pixels[i]);
        pixels[i + 1] = adjust(pixels[i + 1]);
        pixels[i + 2] = adjust(pixels[i + 2]);
      }
      return;
    }
    case 'clrChange': {
      // "Set transparent color" swaps one exact color for another (usually transparent)
      const from = resolveColor(child(effect, A, 'clrFrom')?.firstElementChild, colors);
      const to = resolveColor(child(effect, A, 'clrTo')?.firstElementChild, colors);
      if (!from || !to) return;
      const near = (a: number, b: number) => Math.abs(a - b * 255) <= 3;
      for (let i = 0; i < pixels.length; i += 4) {
        if (near(pixels[i], from.r) && near(pixels[i + 1], from.g) && near(pixels[i + 2], from.b)) {
          pixels[i] = to.r * 255;
          pixels[i + 1] = to.g * 255;
          pixels[i + 2] = to.b * 255;
          pixels[i + 3] = to.a * 255;
        }
      }
      return;
    }
    case 'alphaModFix': {
      const amount = val('amt', 100000);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] *= amount;
      return;
    }
  }
}

async function decode(bytes: Uint8Array) {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error("Couldn't encode an image"))), 'image/png')
  );

// Repeats a picture across the background, like <a:tile> does
function tile(image: HTMLCanvasElement, tileEl: Element, slide: { width: number; height: number }) {
  const scale = 2; // Pixels per point
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(slide.width * scale);
  canvas.height = Math.round(slide.height * scale);
  const ctx = canvas.getContext('2d')!;
  const sx = Number(tileEl.getAttribute('sx') ?? 100000) / 100000;
  const sy = Number(tileEl.getAttribute('sy') ?? 100000) / 100000;
  // Pictures are 96 dpi unless they say otherwise: a pixel is 0.75pt
  const w = image.width * 0.75 * sx * scale;
  const h = image.height * 0.75 * sy * scale;
  if (w < 1 || h < 1) return image;
  const tx = (Number(tileEl.getAttribute('tx') ?? 0) / 12700) * scale;
  const ty = (Number(tileEl.getAttribute('ty') ?? 0) / 12700) * scale;
  for (let y = (ty % h) - h; y < canvas.height; y += h) {
    for (let x = (tx % w) - w; x < canvas.width; x += w) ctx.drawImage(image, x, y, w, h);
  }
  return canvas;
}

export class ImageBaker {
  private zip: JSZip;
  private slide: { width: number; height: number };
  private baked = new Map<string, Promise<string | null>>();
  private count = 0;

  constructor(zip: JSZip, slide: { width: number; height: number }) {
    this.zip = zip;
    this.slide = slide;
  }

  // Bakes the effects of each picture in a part into a new image
  async bake(file: string, doc: Document, colors: ColorTheme) {
    for (const blip of Array.from(doc.getElementsByTagNameNS(A, 'blip'))) {
      const effects = Array.from(blip.children).filter((c) => c.namespaceURI === A && EFFECTS.includes(c.localName));
      // Tiled backgrounds are drawn into a slide-sized image
      const blipFill = blip.parentElement;
      const tileEl = blipFill?.parentElement?.localName === 'bgPr' ? child(blipFill, A, 'tile') : null;
      if (!effects.length && !tileEl) continue;
      const id = blip.getAttributeNS(R, 'embed');
      const source = id && (await relationshipTarget(this.zip, file, id));
      if (!source || !RASTER.test(source) || !this.zip.file(source)) continue;

      const key = `${source}|${effects.map((e) => new XMLSerializer().serializeToString(e)).join('')}|${tileEl ? new XMLSerializer().serializeToString(tileEl) : ''}`;
      let result = this.baked.get(key);
      if (!result) {
        result = this.render(source, effects, colors, tileEl).catch((error) => {
          console.error(`Couldn't apply picture effects to ${source}:`, error);
          return null;
        });
        this.baked.set(key, result);
      }
      const target = await result;
      if (!target) continue;
      blip.setAttributeNS(R, 'r:embed', await addRelationship(this.zip, file, IMAGE_REL, target));
      effects.forEach((e) => e.remove());
      if (tileEl) {
        const stretch = doc.createElementNS(A, 'a:stretch');
        stretch.append(doc.createElementNS(A, 'a:fillRect'));
        tileEl.replaceWith(stretch);
      }
    }
  }

  private async render(source: string, effects: Element[], colors: ColorTheme, tileEl: Element | null) {
    let canvas = await decode(await this.zip.file(source)!.async('uint8array'));
    if (effects.length) {
      const ctx = canvas.getContext('2d')!;
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (const effect of effects) applyEffect(image.data, effect, colors);
      ctx.putImageData(image, 0, 0);
    }
    if (tileEl) canvas = tile(canvas, tileEl, this.slide);
    const target = `ppt/media/ioctl-baked-${++this.count}.png`;
    this.zip.file(target, await toPng(canvas));
    return target;
  }
}

// Backgrounds can refer to the theme's background fills (<p:bgRef>). The fill
// is written into the part itself, with the reference's color as its
// placeholder color, so its colors and picture effects are resolved like any other.
export async function resolveBackgroundRef(zip: JSZip, file: string, doc: Document, themeFile: string | null, theme: Document | null) {
  const bgRef = doc.getElementsByTagNameNS(P, 'bgRef')[0];
  if (!bgRef || !theme || !themeFile) return;
  const idx = Number(bgRef.getAttribute('idx'));
  const list = theme.getElementsByTagNameNS(A, idx >= 1001 ? 'bgFillStyleLst' : 'fillStyleLst')[0];
  const fill = list?.children[idx >= 1001 ? idx - 1001 : idx - 1];
  if (!fill || fill.localName === 'noFill') return;

  const copy = doc.importNode(fill, true) as Element;
  const color = bgRef.firstElementChild;
  for (const placeholder of Array.from(copy.getElementsByTagNameNS(A, 'schemeClr')).filter((c) => c.getAttribute('val') === 'phClr')) {
    if (!color) continue;
    // The placeholder's own modifiers apply on top of the reference's color
    const resolved = doc.importNode(color, true) as Element;
    for (const modifier of Array.from(placeholder.children)) resolved.append(modifier);
    placeholder.replaceWith(resolved);
  }
  const blip = child(copy, A, 'blip');
  if (blip) {
    const id = blip.getAttributeNS(R, 'embed');
    const target = id && (await relationshipTarget(zip, themeFile, id));
    if (!target) return;
    blip.setAttributeNS(R, 'r:embed', await addRelationship(zip, file, IMAGE_REL, target));
  }

  const bgPr = doc.createElementNS(P, 'p:bgPr');
  bgPr.append(copy, doc.createElementNS(A, 'a:effectLst'));
  bgRef.replaceWith(bgPr);
}

export async function slideSize(zip: JSZip) {
  const sldSz = (await readXml(zip, 'ppt/presentation.xml'))?.getElementsByTagNameNS(P, 'sldSz')[0];
  return { width: Number(sldSz?.getAttribute('cx') ?? 9144000) / 12700, height: Number(sldSz?.getAttribute('cy') ?? 6858000) / 12700 };
}

