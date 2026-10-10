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
// - empty paragraphs get a space, so they take the size of their paragraph mark
// - placeholders inherit from the master's placeholder of their type, and text
//   with only an East Asian font inherits its Latin font
// - markup-compatibility alternatives are resolved to their fallback content
// - embedded objects, like MathType equations, are replaced by their preview picture
// - fills, outlines and shadows that shapes take from the theme are written out
// - colors with modifiers (tints, shades, hue offsets) are resolved
// - picture effects (recoloring, tiling) are baked into new images
// - all-caps and small-caps text is capitalized
// - text rotated a quarter turn, autofit's spacing reduction, and table cell
//   margins are passed on to the layout
// The markers are private-use characters that renderSlide turns back into markup.
export const BULLET_START = '\uE000';
export const BULLET_END = '\uE001';
export const LINE_BREAK = '\uE002';
export const TAB = '\uE003';
// Added to the names of shapes with vertical text, followed by the direction
export const VERTICAL_TEXT = '\uE010';
// Added to the names of shapes whose autofit shrinks line and paragraph spacing,
// followed by the fraction of the spacing that's left (like 0.9)
export const SPACING_SCALE = '\uE013';
// Around a table cell's margins and text direction, at the start of its text
export const CELL_START = '\uE011';
export const CELL_END = '\uE012';

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

// PowerPoint matches a slide's placeholders to the master's by type, but
// pptxtojson tries the index first, so a body placeholder with index 3 got the
// master's footer (index 3), and a second content placeholder (index 2, no
// type) the master's date. Master placeholders other than the body lose their
// index, and content placeholders on slides are marked as body text.
function matchPlaceholdersByType(slide: Document, layout: Document | null, master: Document | null) {
  for (const sp of Array.from(slide.getElementsByTagNameNS(P, 'sp'))) {
    const ph = path(sp, [P, 'nvSpPr'], [P, 'nvPr'], [P, 'ph']);
    if (!ph || ph.hasAttribute('type')) continue;
    const layoutType = placeholderOf(findPlaceholder(layout, placeholderOf(sp)!, true) ?? sp)?.type ?? 'obj';
    if (layoutType === 'obj' || layoutType === 'body') ph.setAttribute('type', 'body');
  }
  for (const ph of Array.from(master?.getElementsByTagNameNS(P, 'ph') ?? [])) {
    if (!['body', 'obj'].includes(ph.getAttribute('type') ?? 'obj')) ph.removeAttribute('idx');
  }
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

const EMU_PER_PT = 12700;

// pptxtojson ignores table cell margins and vertical text, so they're added
// to the start of each cell's text ("left,top,right,bottom,direction" in
// points) for layoutSlide to read
function markTableCells(doc: Document) {
  for (const cell of Array.from(doc.getElementsByTagNameNS(A, 'tc'))) {
    const tcPr = child(cell, A, 'tcPr');
    const firstParagraph = path(cell, [A, 'txBody'], [A, 'p']);
    if (!tcPr || !firstParagraph) continue;
    const margin = (name: string, fallback: number) => Number(tcPr.getAttribute(name) ?? fallback) / EMU_PER_PT;
    const margins = [margin('marL', 91440), margin('marT', 45720), margin('marR', 91440), margin('marB', 45720)];
    const vert = tcPr.getAttribute('vert');
    const direction = vert && VERTICAL_DIRECTIONS.includes(vert) ? vert : '';
    if (!direction && margins.join() === '7.2,3.6,7.2,3.6') continue;
    // Styled like the first run, so it doesn't change the line's height
    const firstRun = Array.from(firstParagraph.children).find((c) => c.localName === 'r');
    const run = doc.createElementNS(A, 'a:r');
    const rPr = child(firstRun, A, 'rPr') ?? child(firstParagraph, A, 'endParaRPr');
    if (rPr) {
      const copy = doc.createElementNS(A, 'a:rPr');
      for (const attr of Array.from(rPr.attributes)) copy.setAttribute(attr.name, attr.value);
      run.append(copy);
    }
    const text = doc.createElementNS(A, 'a:t');
    text.textContent = `${CELL_START}${margins.map((m) => Math.round(m * 100) / 100).join(',')},${direction}${CELL_END}`;
    run.append(text);
    const pPr = child(firstParagraph, A, 'pPr');
    if (pPr) pPr.after(run);
    else firstParagraph.prepend(run);
  }
}

const VERTICAL_DIRECTIONS = ['vert', 'vert270', 'eaVert', 'wordArtVert', 'wordArtVertRtl', 'mongolianVert'];

// Text rotated a quarter turn (bodyPr vert="vert" or "vert270", here or on
// the placeholder it inherits from) is laid out horizontally and rotated when
// drawn. pptxtojson only knows East Asian vertical text, so the direction is
// passed on in the shape's name and the text is marked horizontal.
function markVerticalText(doc: Document, layout: Document | null, master: Document | null) {
  for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
    const bodyPr = path(sp, [P, 'txBody'], [A, 'bodyPr']);
    const cNvPr = path(sp, [P, 'nvSpPr'], [P, 'cNvPr']);
    if (!bodyPr || !cNvPr || (cNvPr.getAttribute('name') ?? '').includes(VERTICAL_TEXT)) continue;
    const ph = placeholderOf(sp);
    const inherited = ph ? [findPlaceholder(layout, ph, true), findPlaceholder(master, ph, false)].map((s) => path(s, [P, 'txBody'], [A, 'bodyPr'])?.getAttribute('vert')) : [];
    const direction = [bodyPr.getAttribute('vert'), ...inherited].find((v) => v);
    if (!direction || !VERTICAL_DIRECTIONS.includes(direction)) continue;
    cNvPr.setAttribute('name', `${cNvPr.getAttribute('name') ?? ''}${VERTICAL_TEXT}${direction}`);
    bodyPr.setAttribute('vert', 'horz');
  }
}

// PowerPoint's autofit shrinks line and paragraph spacing (lnSpcReduction) as
// well as text, and pptxtojson only reads the text shrinking
function markSpacingReduction(doc: Document) {
  for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
    const value = path(sp, [P, 'txBody'], [A, 'bodyPr'], [A, 'normAutofit'])?.getAttribute('lnSpcReduction');
    const cNvPr = path(sp, [P, 'nvSpPr'], [P, 'cNvPr']);
    if (!value || !cNvPr) continue;
    // In thousandths of a percent, or a percentage like "10%"
    const reduction = value.endsWith('%') ? parseFloat(value) / 100 : Number(value) / 100000;
    if (!(reduction > 0 && reduction < 1)) continue;
    cNvPr.setAttribute('name', `${cNvPr.getAttribute('name') ?? ''}${SPACING_SCALE}${Math.round((1 - reduction) * 100000) / 100000}`);
  }
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
    // A shape's style (<p:style><a:fontRef>) sets its text color and font, above the default text style
    const fontRef = path(sp, [P, 'style'], [A, 'fontRef']);
    for (let level = 1; level <= 9; level++) {
      const own = child(lstStyle, A, `lvl${level}pPr`);
      const fallback = child(defaultTextStyle, A, `lvl${level}pPr`);
      if (own || !fallback) continue;
      const copy = doc.importNode(fallback, true) as Element;
      const defaults = child(copy, A, 'defRPr');
      if (fontRef && defaults) {
        for (const c of Array.from(defaults.children)) {
          const setByStyle = c.localName.endsWith('Fill') ? !!fontRef.firstElementChild : ['latin', 'ea', 'cs'].includes(c.localName) && fontRef.getAttribute('idx') !== 'none';
          if (setByStyle) c.remove();
        }
      }
      // Levels go in order
      const next = Array.from(lstStyle.children).find((c) => /^lvl\dpPr$/.test(c.localName) && Number(c.localName[3]) > level);
      lstStyle.insertBefore(copy, next ?? null);
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

// pptxtojson takes a run's font from its Latin font or else its East Asian
// one, so text whose properties name only an East Asian font (common in decks
// made on Japanese systems) got that font instead of inheriting the Latin one
function dropEastAsianOnlyFonts(doc: Document) {
  for (const props of Array.from(doc.getElementsByTagNameNS(A, '*')).filter((el) => ['rPr', 'defRPr', 'endParaRPr'].includes(el.localName))) {
    const eastAsian = child(props, A, 'ea');
    if (eastAsian && !child(props, A, 'latin')) eastAsian.remove();
  }
}

function markTabs(doc: Document) {
  for (const text of Array.from(doc.getElementsByTagNameNS(A, 't'))) {
    if (text.textContent?.includes('\t')) text.textContent = text.textContent.replace(/\t/g, TAB);
  }
}

// pptxtojson gives empty paragraphs the first level's font size, while
// PowerPoint sizes them by their end-of-paragraph properties or their level.
// A space lets pptxtojson size them like text. Text that's all empty paragraphs
// is left alone (it shows nothing), except in table cells, where it sets the
// row height.
function fillEmptyParagraphs(doc: Document) {
  const isText = (el: Element) => el.namespaceURI === A && ['r', 'fld', 'br'].includes(el.localName);
  for (const body of Array.from(doc.getElementsByTagNameNS('*', 'txBody'))) {
    const paragraphs = Array.from(body.children).filter((el) => el.namespaceURI === A && el.localName === 'p');
    const empty = paragraphs.filter((para) => !Array.from(para.children).some(isText));
    if (empty.length === paragraphs.length && body.parentElement?.localName !== 'tc') continue;
    for (const para of empty) {
      const end = child(para, A, 'endParaRPr');
      const props = doc.createElementNS(A, 'a:rPr');
      // The space shouldn't be underlined, struck out or highlighted
      for (const attr of Array.from(end?.attributes ?? [])) if (attr.name !== 'u' && attr.name !== 'strike') props.setAttribute(attr.name, attr.value);
      for (const el of Array.from(end?.children ?? [])) if (el.localName !== 'highlight') props.append(el.cloneNode(true));
      const text = doc.createElementNS(A, 'a:t');
      text.textContent = ' ';
      const run = doc.createElementNS(A, 'a:r');
      run.append(props, text);
      if (end) end.before(run);
      else para.append(run);
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

const HYPERLINK_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
// pptxtojson only keeps web links on shapes, and drops slide jumps. Other link
// targets are passed through it inside this (never resolvable) web address.
export const LINK_PREFIX = 'https://ioctl.invalid/link?to=';

// Link targets: a URL, "slide:N" for a slide, or "jump:nextslide" and similar
async function prepareLinks(zip: JSZip, file: string, doc: Document) {
  for (const link of Array.from(doc.getElementsByTagNameNS(A, 'hlinkClick'))) {
    const action = link.getAttribute('action') ?? '';
    const id = link.getAttributeNS(R, 'id');
    let target: string | null = null;
    if (action.startsWith('ppaction://hlinkshowjump?jump=')) {
      target = `jump:${action.slice(action.indexOf('=') + 1)}`;
    } else if (id) {
      const rel = await relationship(zip, file, id);
      const slide = rel && !rel.external && rel.target.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      if (slide) target = `slide:${slide[1]}`;
      else if (rel?.external && /^(https?|mailto|ftp):/i.test(rel.target)) target = rel.target;
    }
    if (!target) {
      // Program, macro and file links don't work in a PDF
      link.removeAttributeNS(R, 'id');
      continue;
    }
    if (!/^https?:/i.test(target)) {
      link.setAttributeNS(R, 'r:id', await addRelationship(zip, file, HYPERLINK_REL, LINK_PREFIX + encodeURIComponent(target), true));
    }
    // PowerPoint shows linked text underlined in the theme's link color,
    // unless the link is set to keep the text's own color
    const rPr = link.parentElement;
    const keepsColor = Array.from(link.getElementsByTagName('*')).some((el) => el.localName === 'hlinkClr' && el.getAttribute('val') === 'tx');
    if (rPr?.localName === 'rPr' && !keepsColor) {
      for (const fill of Array.from(rPr.children).filter((c) => c.localName.endsWith('Fill'))) fill.remove();
      const fill = doc.createElementNS(A, 'a:solidFill');
      const color = doc.createElementNS(A, 'a:schemeClr');
      color.setAttribute('val', 'hlink');
      fill.append(color);
      // Fills come before the fonts and links in a run's properties
      rPr.insertBefore(fill, Array.from(rPr.children).find((c) => !['ln'].includes(c.localName)) ?? null);
      if (!rPr.hasAttribute('u')) rPr.setAttribute('u', 'sng');
    }
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
// Theme styles use a placeholder color (phClr) that the referring shape
// supplies; the placeholder's own modifiers apply on top of that color
function fillPlaceholderColor(doc: Document, el: Element, color: Element | null | undefined) {
  if (!color) return;
  for (const placeholder of Array.from(el.getElementsByTagNameNS(A, 'schemeClr')).filter((c) => c.getAttribute('val') === 'phClr')) {
    const resolved = doc.importNode(color, true) as Element;
    for (const modifier of Array.from(placeholder.children)) resolved.append(modifier);
    placeholder.replaceWith(resolved);
  }
}

function applyShapeStyles(doc: Document, theme: Document | null) {
  const themeLines = Array.from(theme?.getElementsByTagNameNS(A, 'lnStyleLst')[0]?.children ?? []);
  const themeEffects = Array.from(theme?.getElementsByTagNameNS(A, 'effectStyleLst')[0]?.children ?? []);
  const themeFills = Array.from(theme?.getElementsByTagNameNS(A, 'fillStyleLst')[0]?.children ?? []);
  const themeBackgroundFills = Array.from(theme?.getElementsByTagNameNS(A, 'bgFillStyleLst')[0]?.children ?? []);
  for (const style of Array.from(doc.getElementsByTagNameNS(P, 'style'))) {
    const shape = style.parentElement;
    const spPr = child(shape, P, 'spPr');
    if (!shape || !spPr) continue;
    const index = (name: string) => Number(child(style, A, name)?.getAttribute('idx') ?? 0);
    const hasFill = Array.from(spPr.children).some((c) => FILLS.includes(c.localName));
    const fillIndex = index('fillRef');
    if (!hasFill && (fillIndex === 0 || shape.localName === 'cxnSp')) insertInSpPr(spPr, doc.createElementNS(A, 'a:noFill'), ['xfrm', 'custGeom', 'prstGeom']);
    // The theme's fill style (often a gradient); pptxtojson only uses the style's color
    const themeFill = !hasFill && fillIndex > 0 ? (fillIndex >= 1001 ? themeBackgroundFills[fillIndex - 1001] : themeFills[fillIndex - 1]) : undefined;
    if (themeFill && ['solidFill', 'gradFill', 'pattFill'].includes(themeFill.localName) && shape.localName !== 'cxnSp') {
      const copy = doc.importNode(themeFill, true) as Element;
      fillPlaceholderColor(doc, copy, child(style, A, 'fillRef')?.firstElementChild);
      insertInSpPr(spPr, copy, ['xfrm', 'custGeom', 'prstGeom']);
    }
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
      fillPlaceholderColor(doc, copy, child(style, A, 'effectRef')?.firstElementChild);
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
    if (slide) markVerticalText(slide, layout, master);
    if (slide) matchPlaceholdersByType(slide, layout, master);
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
    await prepareLinks(zip, file, doc);
    markTableCells(doc);
    // Slides were done above, with their placeholders
    if (!SLIDE_FILE.test(file)) markVerticalText(doc, null, null);
    markSpacingReduction(doc);
    markLineBreaks(doc);
    markTabs(doc);
    fillEmptyParagraphs(doc);
    dropEastAsianOnlyFonts(doc);
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
