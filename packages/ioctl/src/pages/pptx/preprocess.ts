import type JSZip from 'jszip';
import { DEFAULT_THEME, readColorTheme, resolveColor, toHex, type ColorTheme } from './drawingColor';
import { A, P, R, REL, addRelationship, child, dirOf, path, readXml, relatedFile, relatedFiles, relationship, relativePath, relsFileOf, resolvePath, serialize } from './ooxml';
import { ImageBaker, resolveBackgroundRef, slideSize } from './imageEffects';
import { builtInTableStyle } from './tableStyles';

// pptxtojson misses a few things that are common in lecture slides, so the
// presentation is patched before it's parsed:
// - slides are put in presentation order and hidden slides are dropped
// - master shapes are layered under layout shapes, and hidden where slides hide them
// - built-in table styles are defined when a file uses them without defining them
// - bullets inherited from the layout/master are written into each paragraph
// - text boxes take their defaults from the presentation's default text style
// - line breaks and tabs become marker characters (pptxtojson turns them into spaces)
// - markup-compatibility alternatives are resolved to their fallback content
// - embedded objects, like MathType equations, are replaced by their preview picture
// - fills, outlines and shadows that shapes take from the theme are written out
// - colors with modifiers (tints, shades, hue offsets) are resolved
// - picture effects (recoloring, tiling) are baked into new images
// - all-caps and small-caps text is capitalized
// The markers are private-use characters that renderSlide turns back into markup.
export const BULLET_START = '\uE000';
export const BULLET_END = '\uE001';
export const LINE_BREAK = '\uE002';
export const TAB = '\uE003';

const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const SLIDE_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const SLIDE_FILE = /^ppt\/slides\/slide\d+\.xml$/;
const OLE_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const A14 = 'http://schemas.microsoft.com/office/drawing/2010/main';

// Common Wingdings/Symbol bullet characters and their Unicode look-alikes
const SYMBOL_FONT_BULLETS: Record<string, string> = {
  l: '●', n: '■', q: '❑', u: '◆', v: '❖', w: '◆', '§': '▪', '¨': '◻', Ø: '➢', ü: '✔', '·': '•',
};


// pptxtojson reads slides in file name order (which can differ from the
// presentation's order) and includes hidden slides. This renames the slide
// files to presentation order and drops hidden slides, like PowerPoint's own
// PDF export does.
// Returns the number of each slide that's kept. Hidden slides still count, like
// in PowerPoint, and numbering can start from something other than 1.
async function orderSlides(zip: JSZip): Promise<number[]> {
  const presentation = await readXml(zip, 'ppt/presentation.xml');
  const presentationRels = await readXml(zip, 'ppt/_rels/presentation.xml.rels');
  const contentTypes = await readXml(zip, '[Content_Types].xml');
  if (!presentation || !presentationRels || !contentTypes) return [];

  const relsById = new Map(Array.from(presentationRels.getElementsByTagNameNS(REL, 'Relationship'), (r) => [r.getAttribute('Id'), r]));
  const firstNumber = Number(presentation.documentElement.getAttribute('firstSlideNum') ?? 1);
  const ordered: string[] = [];
  const numbers: number[] = [];
  for (const [position, sldId] of Array.from(presentation.getElementsByTagNameNS(P, 'sldId')).entries()) {
    const target = relsById.get(sldId.getAttributeNS(R, 'id'))?.getAttribute('Target');
    const file = target && resolvePath('ppt', target);
    const slide = file && !ordered.includes(file) ? await readXml(zip, file) : null;
    if (file && slide && slide.documentElement.getAttribute('show') !== '0') {
      ordered.push(file);
      numbers.push(firstNumber + position);
    }
  }
  const renamed = new Map(ordered.map((file, i) => [file, `ppt/slides/slide${i + 1}.xml`]));

  // Move the slides (and their relationship files) to their new names
  const oldFiles = Object.keys(zip.files).filter((name) => SLIDE_FILE.test(name));
  const contents = new Map<string, { xml: string; rels?: string }>();
  for (const file of oldFiles) contents.set(file, { xml: await zip.file(file)!.async('text'), rels: await zip.file(relsFileOf(file))?.async('text') });
  for (const file of oldFiles) {
    zip.remove(file);
    zip.remove(relsFileOf(file));
  }
  for (const [from, to] of renamed) {
    const { xml, rels } = contents.get(from)!;
    zip.file(to, xml);
    if (rels) zip.file(relsFileOf(to), rels);
  }

  // Point relationships to the new names, and drop ones to removed slides
  for (const relsFile of Object.keys(zip.files).filter((name) => name.endsWith('.rels'))) {
    const rels = await readXml(zip, relsFile);
    if (!rels) continue;
    const baseDir = dirOf(dirOf(relsFile)); // e.g. ppt/slides/_rels/x.rels -> ppt/slides
    let changed = false;
    for (const rel of Array.from(rels.getElementsByTagNameNS(REL, 'Relationship'))) {
      const target = rel.getAttribute('Target');
      if (rel.getAttribute('TargetMode') === 'External' || !target) continue;
      const file = resolvePath(baseDir, target);
      if (!SLIDE_FILE.test(file)) continue;
      const to = renamed.get(file);
      if (to) rel.setAttribute('Target', target.startsWith('/') ? `/${to}` : relativePath(baseDir, to));
      else rel.remove();
      changed = true;
    }
    if (changed) zip.file(relsFile, serialize(rels));
  }

  // Keep the content types and slide list in step
  const types = contentTypes.documentElement;
  for (const override of Array.from(types.getElementsByTagNameNS(CT, 'Override'))) {
    if (override.getAttribute('ContentType') === SLIDE_TYPE) override.remove();
  }
  for (const file of renamed.values()) {
    const override = contentTypes.createElementNS(CT, 'Override');
    override.setAttribute('PartName', `/${file}`);
    override.setAttribute('ContentType', SLIDE_TYPE);
    types.append(override);
  }
  zip.file('[Content_Types].xml', serialize(contentTypes));
  const keptRelIds = new Set(Array.from(presentationRels.getElementsByTagNameNS(REL, 'Relationship'), (r) => r.getAttribute('Id')));
  for (const sldId of Array.from(presentation.getElementsByTagNameNS(P, 'sldId'))) {
    const target = relsById.get(sldId.getAttributeNS(R, 'id'))?.getAttribute('Target');
    if (!target || !renamed.has(resolvePath('ppt', target)) || !keptRelIds.has(sldId.getAttributeNS(R, 'id'))) sldId.remove();
  }
  zip.file('ppt/presentation.xml', serialize(presentation));
  return numbers;
}

// Table styles saved by PowerPoint take their fills and borders from the theme
// (<a:fillRef>, <a:lnRef>), which pptxtojson ignores, so they're written out
function resolveTableStyleRefs(styles: Document, theme: Document | null) {
  const themeLines = Array.from(theme?.getElementsByTagNameNS(A, 'lnStyleLst')[0]?.children ?? []);
  for (const ref of Array.from(styles.getElementsByTagNameNS(A, 'fillRef'))) {
    if (ref.parentElement?.localName !== 'tcStyle' || !ref.firstElementChild) continue;
    const fill = styles.createElementNS(A, 'a:fill');
    const solid = styles.createElementNS(A, 'a:solidFill');
    solid.append(ref.firstElementChild);
    fill.append(solid);
    ref.replaceWith(fill);
  }
  for (const ref of Array.from(styles.getElementsByTagNameNS(A, 'lnRef'))) {
    if (ref.parentElement?.parentElement?.localName !== 'tcBdr' || !ref.firstElementChild) continue;
    const line = styles.createElementNS(A, 'a:ln');
    line.setAttribute('w', themeLines[Number(ref.getAttribute('idx')) - 1]?.getAttribute('w') ?? '12700');
    const solid = styles.createElementNS(A, 'a:solidFill');
    solid.append(ref.firstElementChild);
    line.append(solid);
    ref.replaceWith(line);
  }
}

const isShape = (el: Element) => ['sp', 'grpSp', 'graphicFrame', 'cxnSp', 'pic', 'contentPart', 'AlternateContent'].includes(el.localName);
const isPlaceholder = (el: Element) => el.getElementsByTagNameNS(P, 'ph').length > 0;

// Copies elements into another part, along with the relationships they use
async function copyIntoPart(zip: JSZip, elements: Element[], fromFile: string, toFile: string, toDoc: Document) {
  const copies: Element[] = [];
  for (const el of elements) {
    const copy = toDoc.importNode(el, true) as Element;
    for (const node of [copy, ...Array.from(copy.getElementsByTagName('*'))]) {
      for (const attr of Array.from(node.attributes).filter((a) => a.namespaceURI === R)) {
        const rel = await relationship(zip, fromFile, attr.value);
        if (rel) attr.value = await addRelationship(zip, toFile, rel.type, rel.target, rel.external);
      }
    }
    copies.push(copy);
  }
  return copies;
}

// pptxtojson draws a layout's own shapes under its master's (PowerPoint draws
// them on top), and ignores slides that hide the master's shapes. So the
// master's shapes are copied into each layout under its own, and slides that
// hide them get a copy of their layout without those shapes.
async function arrangeBackgroundShapes(zip: JSZip, load: (file: string | null) => Promise<Document | null>, slideFiles: string[]) {
  const layoutFiles = new Set<string>();
  for (const slideFile of slideFiles) {
    const layoutFile = await relatedFile(zip, slideFile, '/slideLayout');
    if (layoutFile) layoutFiles.add(layoutFile);
  }
  for (const layoutFile of layoutFiles) {
    const masterFile = await relatedFile(zip, layoutFile, '/slideMaster');
    const [layout, master] = await Promise.all([load(layoutFile), load(masterFile)]);
    const layoutTree = layout?.getElementsByTagNameNS(P, 'spTree')[0];
    const masterTree = master?.getElementsByTagNameNS(P, 'spTree')[0];
    if (!layout || !masterFile || !layoutTree || !masterTree || layout.documentElement.getAttribute('showMasterSp') === '0') continue;
    const shapes = Array.from(masterTree.children).filter((el) => isShape(el) && !isPlaceholder(el));
    const copies = await copyIntoPart(zip, shapes, masterFile, layoutFile, layout);
    const first = Array.from(layoutTree.children).find(isShape);
    for (const copy of copies) layoutTree.insertBefore(copy, first ?? null);
    layout.documentElement.setAttribute('showMasterSp', '0');
  }

  const bare = new Map<string, string>();
  for (const slideFile of slideFiles) {
    const slide = await load(slideFile);
    if (slide?.documentElement.getAttribute('showMasterSp') !== '0') continue;
    const rels = await readXml(zip, relsFileOf(slideFile));
    const layoutRel = Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? []).find((r) => r.getAttribute('Type')?.endsWith('/slideLayout'));
    const layoutFile = layoutRel && resolvePath(dirOf(slideFile), layoutRel.getAttribute('Target') ?? '');
    const layout = layoutFile ? await load(layoutFile) : null;
    if (!rels || !layoutRel || !layoutFile || !layout) continue;
    let bareFile = bare.get(layoutFile);
    if (!bareFile) {
      bareFile = layoutFile.replace(/\.xml$/, '-ioctl-bare.xml');
      const copy = layout.cloneNode(true) as Document;
      const tree = copy.getElementsByTagNameNS(P, 'spTree')[0];
      for (const el of Array.from(tree?.children ?? [])) if (isShape(el) && !isPlaceholder(el)) el.remove();
      copy.documentElement.setAttribute('showMasterSp', '0');
      zip.file(bareFile, serialize(copy));
      const layoutRels = await zip.file(relsFileOf(layoutFile))?.async('text');
      if (layoutRels) zip.file(relsFileOf(bareFile), layoutRels);
      bare.set(layoutFile, bareFile);
    }
    layoutRel.setAttribute('Target', relativePath(dirOf(slideFile), bareFile));
    zip.file(relsFileOf(slideFile), serialize(rels));
  }
}

// Tables refer to built-in styles that files often don't define (see tableStyles.ts)
async function prepareTableStyles(zip: JSZip, slides: Document[], theme: Document | null, colors: ColorTheme) {
  const used = new Set(slides.flatMap((slide) => Array.from(slide.getElementsByTagNameNS(A, 'tableStyleId')).map((id) => id.textContent?.trim() ?? '')));
  if (!used.size) return;
  const styles =
    (await readXml(zip, 'ppt/tableStyles.xml')) ??
    new DOMParser().parseFromString(`<a:tblStyleLst xmlns:a="${A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`, 'application/xml');
  const defined = new Set(Array.from(styles.getElementsByTagNameNS(A, 'tblStyle')).map((s) => s.getAttribute('styleId')));
  for (const id of used) {
    const style = !defined.has(id) && builtInTableStyle(id);
    if (style) styles.documentElement.append(styles.importNode(new DOMParser().parseFromString(style, 'application/xml').documentElement, true));
  }
  resolveTableStyleRefs(styles, theme);
  resolveColorModifiers(styles, colors);
  zip.file('ppt/tableStyles.xml', serialize(styles));
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

// Capitalizes runs set to all caps or small caps (here or inherited), which
// pptxtojson shows in their original case. Small caps are capitals at 80% size
// for the lowercase letters.
function applyCaps(para: Element, chain: Element[]) {
  const doc = para.ownerDocument;
  const inherited = chain.map((el) => child(el, A, 'defRPr')?.getAttribute('cap')).find((x) => x);
  const inheritedSize = chain.map((el) => child(el, A, 'defRPr')?.getAttribute('sz')).find((x) => x) ?? '1800';
  for (const run of Array.from(para.children).filter((c) => c.namespaceURI === A && (c.localName === 'r' || c.localName === 'fld'))) {
    const rPr = child(run, A, 'rPr');
    const cap = rPr?.getAttribute('cap') ?? inherited;
    const text = child(run, A, 't');
    if (!text?.textContent || (cap !== 'all' && cap !== 'small')) continue;
    if (cap === 'all') {
      text.textContent = text.textContent.toUpperCase();
      continue;
    }
    // Small caps: split the run into pieces of lowercase and other characters
    const pieces = text.textContent.match(/\p{Ll}+|[^\p{Ll}]+/gu) ?? [];
    const size = Number(rPr?.getAttribute('sz') ?? inheritedSize);
    for (const piece of pieces) {
      const copy = run.cloneNode(true) as Element;
      child(copy, A, 't')!.textContent = piece.toUpperCase();
      if (/\p{Ll}/u.test(piece)) {
        const props = child(copy, A, 'rPr') ?? copy.insertBefore(doc.createElementNS(A, 'a:rPr'), copy.firstChild);
        props.setAttribute('sz', String(Math.round(size * 0.8)));
      }
      run.before(copy);
    }
    run.remove();
  }
}

// Text in shapes that aren't placeholders takes its defaults from the
// presentation's default text style, but pptxtojson uses the master's "other"
// style instead, so the default style's levels are written into each shape
function applyDefaultTextStyle(doc: Document, defaultTextStyle: Element | null) {
  if (!defaultTextStyle) return;
  for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
    const txBody = child(sp, P, 'txBody');
    if (!txBody || placeholderOf(sp)) continue;
    let lstStyle = child(txBody, A, 'lstStyle');
    if (!lstStyle) {
      lstStyle = doc.createElementNS(A, 'a:lstStyle');
      const bodyPr = child(txBody, A, 'bodyPr');
      if (bodyPr) bodyPr.after(lstStyle);
      else txBody.prepend(lstStyle);
    }
    for (let level = 1; level <= 9; level++) {
      const own = child(lstStyle, A, `lvl${level}pPr`);
      const fallback = child(defaultTextStyle, A, `lvl${level}pPr`);
      if (own || !fallback) continue;
      // Levels go in order
      const next = Array.from(lstStyle.children).find((c) => /^lvl\dpPr$/.test(c.localName) && Number(c.localName[3]) > level);
      lstStyle.insertBefore(doc.importNode(fallback, true), next ?? null);
    }
  }
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

      applyCaps(para, chain);

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

function markTabs(doc: Document) {
  for (const text of Array.from(doc.getElementsByTagNameNS(A, 't'))) {
    if (text.textContent?.includes('\t')) text.textContent = text.textContent.replace(/\t/g, TAB);
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

// Newer features are stored as <mc:AlternateContent> with a fallback for older
// readers. pptxtojson only understands it around equations and groups, and
// crashes on it elsewhere (Mac PowerPoint wraps picture fills in it, for
// example), so everything else is replaced by its fallback.
function resolveAlternateContent(doc: Document) {
  for (const alternate of Array.from(doc.getElementsByTagNameNS(MC, 'AlternateContent')).reverse()) {
    const choice = child(alternate, MC, 'Choice');
    // pptxtojson draws equations from their fallback picture itself
    if (choice?.getElementsByTagNameNS(A14, 'm').length) continue;
    const fallback = child(alternate, MC, 'Fallback');
    alternate.replaceWith(...Array.from(fallback?.childNodes ?? []));
  }
}

// pptxtojson ignores the formatting of fields (like slide numbers) in
// paragraphs that have no other runs, so fields become plain runs. Slide
// numbers on slides get the slide's number; on layouts and masters they keep
// the ‹#› placeholder, which layoutSlide fills in for each slide.
function convertFields(doc: Document, slideNumber: number | undefined) {
  for (const field of Array.from(doc.getElementsByTagNameNS(A, 'fld'))) {
    const run = doc.createElementNS(A, 'a:r');
    const rPr = child(field, A, 'rPr');
    const text = child(field, A, 't') ?? doc.createElementNS(A, 'a:t');
    if (field.getAttribute('type') === 'slidenum') text.textContent = slideNumber === undefined ? '‹#›' : String(slideNumber);
    if (rPr) run.append(rPr);
    run.append(text);
    field.replaceWith(run);
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

const COLOR_ELEMENTS = ['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'];

// The theme colors a part uses: its master's color map, unless the part overrides it
function colorThemeOf(doc: Document, theme: Document | null, master: Document | null): ColorTheme {
  const colors = readColorTheme(theme, master);
  const override = doc.getElementsByTagNameNS(A, 'overrideClrMapping')[0];
  for (const attr of Array.from(override?.attributes ?? [])) colors.map[attr.name] = attr.value;
  return colors;
}

// pptxtojson ignores some color modifiers (the hue and saturation offsets
// SmartArt uses) and applies tint and shade in the wrong color space (Office
// mixes in linear light, which makes the classic subtitle gray #898989), so
// colors with modifiers are resolved here
function resolveColorModifiers(doc: Document, colors: ColorTheme) {
  for (const el of Array.from(doc.getElementsByTagNameNS(A, '*'))) {
    if (!COLOR_ELEMENTS.includes(el.localName) || !el.firstElementChild || el.getAttribute('val') === 'phClr') continue;
    const color = resolveColor(el, colors);
    if (!color) continue;
    const resolved = doc.createElementNS(A, 'a:srgbClr');
    resolved.setAttribute('val', toHex(color));
    if (color.a < 1) {
      const alpha = doc.createElementNS(A, 'a:alpha');
      alpha.setAttribute('val', String(Math.round(color.a * 100000)));
      resolved.append(alpha);
    }
    el.replaceWith(resolved);
  }
}

const FILLS = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'];
const BEFORE_LINE = ['xfrm', 'custGeom', 'prstGeom', ...FILLS];

// Inserts a child into <p:spPr> after the elements the schema puts before it
function insertInSpPr(spPr: Element, el: Element, after: string[]) {
  const previous = Array.from(spPr.children).filter((c) => after.includes(c.localName)).pop();
  if (previous) previous.after(el);
  else spPr.prepend(el);
}

// Shapes can take their fill, outline and effects from the theme through
// <p:style> references. pptxtojson reads only part of that, so the references
// are written out on the shapes:
// - index 0 means none, but pptxtojson fills and outlines those shapes anyway
//   (connectors drawn as filled triangles, for example)
// - outlines without a width are drawn invisible, while PowerPoint uses the
//   width of the theme's line style, and outlines that are only in the style
//   lose its color
// - theme shadows (effect styles) are ignored
function applyShapeStyles(doc: Document, theme: Document | null) {
  const themeLines = Array.from(theme?.getElementsByTagNameNS(A, 'lnStyleLst')[0]?.children ?? []);
  const themeEffects = Array.from(theme?.getElementsByTagNameNS(A, 'effectStyleLst')[0]?.children ?? []);
  for (const style of Array.from(doc.getElementsByTagNameNS(P, 'style'))) {
    const shape = style.parentElement;
    const spPr = child(shape, P, 'spPr');
    if (!shape || !spPr) continue;
    const index = (name: string) => Number(child(style, A, name)?.getAttribute('idx') ?? 0);
    const hasFill = Array.from(spPr.children).some((c) => FILLS.includes(c.localName));
    if (!hasFill && (index('fillRef') === 0 || shape.localName === 'cxnSp')) insertInSpPr(spPr, doc.createElementNS(A, 'a:noFill'), ['xfrm', 'custGeom', 'prstGeom']);
    let line = child(spPr, A, 'ln');
    if (!line) {
      line = doc.createElementNS(A, 'a:ln');
      if (index('lnRef') === 0) line.append(doc.createElementNS(A, 'a:noFill'));
      insertInSpPr(spPr, line, BEFORE_LINE);
    }
    // The style's line color, with its modifiers (pptxtojson drops those)
    const lineColor = child(style, A, 'lnRef')?.firstElementChild;
    if (index('lnRef') > 0 && lineColor && !Array.from(line.children).some((c) => c.localName.endsWith('Fill'))) {
      const fill = doc.createElementNS(A, 'a:solidFill');
      fill.append(doc.importNode(lineColor, true));
      line.prepend(fill);
    }
    const effect = themeEffects[index('effectRef') - 1];
    const effects = effect && child(effect, A, 'effectLst');
    if (effects && !child(spPr, A, 'effectLst') && !child(spPr, A, 'effectDag') && child(effects, A, 'outerShdw')) {
      // Theme effects use the style's color as their placeholder color (phClr)
      const copy = doc.importNode(effects, true) as Element;
      const color = child(style, A, 'effectRef')?.firstElementChild;
      for (const placeholder of Array.from(copy.getElementsByTagNameNS(A, 'schemeClr')).filter((c) => c.getAttribute('val') === 'phClr')) {
        if (color) placeholder.replaceWith(doc.importNode(color, true));
      }
      insertInSpPr(spPr, copy, [...BEFORE_LINE, 'ln']);
    }
  }

  for (const line of Array.from(doc.getElementsByTagNameNS(A, 'ln'))) {
    if (line.parentElement?.localName !== 'spPr' || line.hasAttribute('w') || child(line, A, 'noFill')) continue;
    const shape = line.parentElement.parentElement;
    const styleIndex = Number(path(shape, [P, 'style'], [A, 'lnRef'])?.getAttribute('idx') ?? 0);
    const hasFill = Array.from(line.children).some((c) => c.localName.endsWith('Fill'));
    if (!styleIndex && !hasFill) continue;
    line.setAttribute('w', themeLines[styleIndex - 1]?.getAttribute('w') ?? '9525');
  }
}

// Patches the presentation for pptxtojson; returns the number of each slide
export async function preparePptx(zip: JSZip): Promise<{ slideNumbers: number[] }> {
  const cache = new Map<string, Promise<Document | null>>();
  const load = (file: string | null) => {
    if (!file) return Promise.resolve(null);
    if (!cache.has(file)) {
      cache.set(
        file,
        readXml(zip, file).then((doc) => {
          if (doc) resolveAlternateContent(doc);
          return doc;
        })
      );
    }
    return cache.get(file)!;
  };
  const slideNumbers = await orderSlides(zip);
  const presentation = await load('ppt/presentation.xml');
  const defaultTextStyle = presentation && path(presentation.documentElement, [P, 'defaultTextStyle']);

  const slideFiles = Object.keys(zip.files).filter((name) => SLIDE_FILE.test(name));
  await arrangeBackgroundShapes(zip, load, slideFiles);

  // Slides, layouts, masters and SmartArt drawings, with the theme and master each one uses
  const parts = new Map<string, { theme: Document | null; themeFile: string | null; master: Document | null }>();
  const styled = new Set<Document>();
  for (const slideFile of slideFiles) {
    const layoutFile = await relatedFile(zip, slideFile, '/slideLayout');
    const masterFile = layoutFile && (await relatedFile(zip, layoutFile, '/slideMaster'));
    const themeFile = masterFile && (await relatedFile(zip, masterFile, '/theme'));
    const [slide, layout, master, theme] = await Promise.all([slideFile, layoutFile, masterFile, themeFile].map(load));
    for (const doc of [slide, layout, master]) {
      if (doc && !styled.has(doc)) applyDefaultTextStyle(doc, defaultTextStyle);
      if (doc) styled.add(doc);
    }
    if (slide) addBullets(slide, layout, master, defaultTextStyle);
    const diagrams = await relatedFiles(zip, slideFile, '/diagramDrawing');
    for (const file of [slideFile, layoutFile, masterFile, ...diagrams]) {
      if (file && !parts.has(file)) parts.set(file, { theme, themeFile, master });
    }
  }

  const slides: Document[] = [];
  const images = new ImageBaker(zip, await slideSize(zip));
  for (const [file, { theme, themeFile, master }] of parts) {
    const doc = await load(file);
    if (!doc) continue;
    const slideIndex = SLIDE_FILE.test(file) ? Number(file.match(/(\d+)\.xml$/)![1]) - 1 : -1;
    convertFields(doc, slideIndex >= 0 ? slideNumbers[slideIndex] ?? slideIndex + 1 : undefined);
    markLineBreaks(doc);
    markTabs(doc);
    replaceEmbeddedObjects(doc);
    applyShapeStyles(doc, theme);
    await resolveBackgroundRef(zip, file, doc, themeFile, theme);
    const colors = colorThemeOf(doc, theme, master);
    resolveColorModifiers(doc, colors);
    await images.bake(file, doc, colors);
    zip.file(file, serialize(doc));
    if (SLIDE_FILE.test(file)) slides.push(doc);
  }
  const first = parts.values().next().value;
  await prepareTableStyles(zip, slides, first?.theme ?? null, first ? readColorTheme(first.theme, first.master) : DEFAULT_THEME);
  return { slideNumbers };
}
