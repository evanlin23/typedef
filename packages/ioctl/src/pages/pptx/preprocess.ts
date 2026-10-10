import type JSZip from 'jszip';

// pptxtojson misses a few things that are common in lecture slides, so the
// slide XML is patched before it's parsed:
// - bullets inherited from the layout/master are written into each paragraph
// - line breaks become marker characters (pptxtojson turns them into spaces)
// - embedded objects, like MathType equations, are replaced by their preview picture
// - outlines that take their width from the theme get an explicit width
// The markers are private-use characters that renderSlide turns back into markup.
export const BULLET_START = '\uE000';
export const BULLET_END = '\uE001';
export const LINE_BREAK = '\uE002';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OLE_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';

// Common Wingdings/Symbol bullet characters and their Unicode look-alikes
const SYMBOL_FONT_BULLETS: Record<string, string> = {
  l: '●', n: '■', q: '❑', u: '◆', v: '❖', w: '⬥', '§': '▪', '¨': '◻', Ø: '➢', ü: '✔', '·': '•',
};

const child = (el: Element | null | undefined, ns: string, name: string) =>
  el ? Array.from(el.children).find((c) => c.namespaceURI === ns && c.localName === name) ?? null : null;
const path = (el: Element | null | undefined, ...names: [string, string][]) =>
  names.reduce<Element | null | undefined>((cur, [ns, name]) => child(cur, ns, name), el) ?? null;

async function readXml(zip: JSZip, file: string) {
  const text = await zip.file(file)?.async('text');
  return text ? new DOMParser().parseFromString(text, 'application/xml') : null;
}

// Resolves the target of the first relationship of the given type, relative to `file`
async function relatedFile(zip: JSZip, file: string, type: string) {
  const dir = file.slice(0, file.lastIndexOf('/'));
  const rels = await readXml(zip, `${dir}/_rels/${file.slice(dir.length + 1)}.rels`);
  const rel = Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? []).find((r) => r.getAttribute('Type')?.endsWith(type));
  const target = rel?.getAttribute('Target');
  if (!target) return null;
  const parts = target.startsWith('/') ? target.slice(1).split('/') : [...dir.split('/'), ...target.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

function placeholderOf(sp: Element) {
  const ph = path(sp, [P, 'nvSpPr'], [P, 'nvPr'], [P, 'ph']);
  return ph && { type: ph.getAttribute('type') ?? 'obj', idx: ph.getAttribute('idx') };
}

function findPlaceholder(doc: Document | null, ph: { type: string; idx: string | null }, matchIdx: boolean) {
  const shapes = Array.from(doc?.getElementsByTagNameNS(P, 'sp') ?? []);
  const normalize = (type: string) => ({ ctrTitle: 'title', subTitle: 'body', obj: 'body' })[type] ?? type;
  return (
    (matchIdx && ph.idx !== null && shapes.find((sp) => placeholderOf(sp)?.idx === ph.idx)) ||
    shapes.find((sp) => {
      const other = placeholderOf(sp);
      return other && normalize(other.type) === normalize(ph.type);
    }) ||
    null
  );
}

function masterStyleName(sp: Element) {
  const ph = placeholderOf(sp);
  if (!ph) return 'otherStyle';
  if (ph.type === 'title' || ph.type === 'ctrTitle') return 'titleStyle';
  if (['body', 'obj', 'subTitle'].includes(ph.type)) return 'bodyStyle';
  return 'otherStyle';
}

const AUTO_NUMBER_FORMATS: Record<string, (n: number) => string> = {
  alphaLc: (n) => String.fromCharCode(97 + ((n - 1) % 26)),
  alphaUc: (n) => String.fromCharCode(65 + ((n - 1) % 26)),
  romanLc: (n) => toRoman(n).toLowerCase(),
  romanUc: (n) => toRoman(n),
  arabic: (n) => String(n),
};

function toRoman(n: number) {
  const numerals: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let result = '';
  for (const [value, numeral] of numerals) {
    while (n >= value) {
      result += numeral;
      n -= value;
    }
  }
  return result;
}

// e.g. "arabicPeriod" -> "3.", "alphaLcParenR" -> "c)", "romanUcParenBoth" -> "(III)"
function formatAutoNumber(scheme: string, n: number) {
  const format = Object.keys(AUTO_NUMBER_FORMATS).find((key) => scheme.startsWith(key)) ?? 'arabic';
  const value = AUTO_NUMBER_FORMATS[format](n);
  if (scheme.endsWith('ParenBoth')) return `(${value})`;
  if (scheme.endsWith('ParenR')) return `${value})`;
  if (scheme.endsWith('Plain')) return value;
  return `${value}.`;
}

function addBullets(slide: Document, layout: Document | null, master: Document | null, defaultTextStyle: Element | null) {
  const txStyles = master && path(master.documentElement, [P, 'txStyles']);

  for (const sp of Array.from(slide.getElementsByTagNameNS(P, 'sp'))) {
    const txBody = child(sp, P, 'txBody');
    if (!txBody) continue;

    // Paragraph property sources for each level, from most to least specific
    const ph = placeholderOf(sp);
    const lstStyles = [
      child(txBody, A, 'lstStyle'),
      ...(ph ? [findPlaceholder(layout, ph, true), findPlaceholder(master, ph, false)] : []).map((s) =>
        path(s, [P, 'txBody'], [A, 'lstStyle'])
      ),
      child(txStyles, P, masterStyleName(sp)),
      defaultTextStyle,
    ];

    const counters: number[] = [];
    for (const para of Array.from(txBody.getElementsByTagNameNS(A, 'p'))) {
      const pPr = child(para, A, 'pPr');
      const level = Number(pPr?.getAttribute('lvl') ?? 0);
      const chain = [pPr, ...lstStyles.map((style) => child(style, A, `lvl${level + 1}pPr`))].filter((x): x is Element => !!x);
      const first = (name: string) => chain.map((el) => child(el, A, name)).find((x) => x);
      const kind = chain
        .map((el) => Array.from(el.children).find((c) => c.namespaceURI === A && ['buNone', 'buChar', 'buAutoNum', 'buBlip'].includes(c.localName)))
        .find((x) => x);
      // Bullets set on the paragraph itself would make pptxtojson render a list as well
      for (const own of Array.from(pPr?.children ?? [])) {
        if (['buChar', 'buAutoNum', 'buBlip'].includes(own.localName)) own.remove();
      }

      counters.length = level + 1;
      if (kind?.localName !== 'buAutoNum') delete counters[level];
      const runs = Array.from(para.children).filter((c) => c.namespaceURI === A && (c.localName === 'r' || c.localName === 'fld'));
      const hasText = runs.some((r) => child(r, A, 't')?.textContent?.trim());
      if (!kind || kind.localName === 'buNone' || !hasText) continue;

      let bullet = '•';
      if (kind.localName === 'buChar') {
        bullet = kind.getAttribute('char') || '•';
        const font = first('buFont')?.getAttribute('typeface') ?? '';
        if (/wingdings|symbol/i.test(font)) {
          // Symbol fonts often store characters in the private-use area (U+F0xx)
          const code = bullet.charCodeAt(0);
          bullet = SYMBOL_FONT_BULLETS[String.fromCharCode(code >= 0xf000 ? code - 0xf000 : code)] ?? '•';
        }
      } else if (kind.localName === 'buAutoNum') {
        counters[level] = (counters[level] ?? Number(kind.getAttribute('startAt') ?? 1) - 1) + 1;
        bullet = formatAutoNumber(kind.getAttribute('type') ?? 'arabicPeriod', counters[level]);
      }

      // Style the bullet like the paragraph's first run, then apply bullet color/size overrides
      const firstRunProps = child(runs[0], A, 'rPr');
      const rPr = (firstRunProps?.cloneNode(true) as Element | undefined) ?? slide.createElementNS(A, 'a:rPr');
      const color = first('buClr');
      if (color) {
        for (const fill of Array.from(rPr.children).filter((c) => c.localName.endsWith('Fill'))) fill.remove();
        const solidFill = slide.createElementNS(A, 'a:solidFill');
        for (const c of Array.from(color.children)) solidFill.append(c.cloneNode(true));
        rPr.prepend(solidFill);
      }
      const sizePct = first('buSzPct')?.getAttribute('val');
      const size = rPr.getAttribute('sz') ?? chain.map((el) => child(el, A, 'defRPr')?.getAttribute('sz')).find((x) => x);
      if (sizePct && size) rPr.setAttribute('sz', String(Math.round((Number(size) * Number(sizePct)) / 100000)));

      const run = slide.createElementNS(A, 'a:r');
      const text = slide.createElementNS(A, 'a:t');
      text.textContent = `${BULLET_START}${bullet}${BULLET_END}`;
      run.append(rPr, text);
      if (pPr) pPr.after(run);
      else para.prepend(run);
    }
  }
}

function markLineBreaks(doc: Document) {
  for (const br of Array.from(doc.getElementsByTagNameNS(A, 'br'))) {
    const run = doc.createElementNS(A, 'a:r');
    const rPr = child(br, A, 'rPr');
    if (rPr) run.append(rPr);
    const text = doc.createElementNS(A, 'a:t');
    text.textContent = LINE_BREAK;
    run.append(text);
    br.replaceWith(run);
  }
}

function replaceEmbeddedObjects(doc: Document) {
  for (const frame of Array.from(doc.getElementsByTagNameNS(P, 'graphicFrame'))) {
    const data = path(frame, [A, 'graphic'], [A, 'graphicData']);
    if (data?.getAttribute('uri') !== OLE_URI) continue;
    const picture = data.getElementsByTagNameNS(P, 'pic')[0];
    const spPr = child(picture, P, 'spPr');
    const frameXfrm = child(frame, P, 'xfrm');
    if (!picture || !spPr || !frameXfrm) continue;
    // Show the picture wherever the object's frame is
    const xfrm = doc.createElementNS(A, 'a:xfrm');
    for (const c of Array.from(frameXfrm.children)) xfrm.append(c.cloneNode(true));
    child(spPr, A, 'xfrm')?.remove();
    spPr.prepend(xfrm);
    frame.replaceWith(picture);
  }
}

// pptxtojson draws outlines without a width as invisible, while PowerPoint uses
// the width of the theme line style the shape refers to
function setOutlineWidths(doc: Document, theme: Document | null) {
  const themeLines = Array.from(theme?.getElementsByTagNameNS(A, 'lnStyleLst')[0]?.children ?? []);
  for (const line of Array.from(doc.getElementsByTagNameNS(A, 'ln'))) {
    if (line.parentElement?.localName !== 'spPr' || line.hasAttribute('w') || child(line, A, 'noFill')) continue;
    const shape = line.parentElement.parentElement;
    const styleIndex = Number(path(shape, [P, 'style'], [A, 'lnRef'])?.getAttribute('idx') ?? 0);
    const hasFill = Array.from(line.children).some((c) => c.localName.endsWith('Fill'));
    if (!styleIndex && !hasFill) continue;
    line.setAttribute('w', themeLines[styleIndex - 1]?.getAttribute('w') ?? '9525');
  }
}

export async function preparePptx(zip: JSZip) {
  const cache = new Map<string, Promise<Document | null>>();
  const load = (file: string | null) => {
    if (!file) return Promise.resolve(null);
    if (!cache.has(file)) cache.set(file, readXml(zip, file));
    return cache.get(file)!;
  };
  const presentation = await load('ppt/presentation.xml');
  const defaultTextStyle = presentation && path(presentation.documentElement, [P, 'defaultTextStyle']);

  // Slides, layouts and masters, with the theme each one uses
  const parts = new Map<string, Document | null>();
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  for (const slideFile of slideFiles) {
    const layoutFile = await relatedFile(zip, slideFile, '/slideLayout');
    const masterFile = layoutFile && (await relatedFile(zip, layoutFile, '/slideMaster'));
    const themeFile = masterFile && (await relatedFile(zip, masterFile, '/theme'));
    const [slide, layout, master, theme] = await Promise.all([slideFile, layoutFile, masterFile, themeFile].map(load));
    if (slide) addBullets(slide, layout, master, defaultTextStyle);
    for (const file of [slideFile, layoutFile, masterFile]) {
      if (file) parts.set(file, theme);
    }
  }

  for (const [file, theme] of parts) {
    const doc = await load(file);
    if (!doc) continue;
    markLineBreaks(doc);
    replaceEmbeddedObjects(doc);
    setOutlineWidths(doc, theme);
    zip.file(file, new XMLSerializer().serializeToString(doc));
  }
}
