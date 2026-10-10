import type { Border, Element as SlideElement, Shape as ShapeElement, Slide, Table as TableElement, Text as TextElement } from 'pptxtojson';
import { cssFontStack, familyFor } from './fonts';
import { BULLET_END, BULLET_START, CELL_END, CELL_START, LINE_BREAK, SPACING_SCALE, TAB, VERTICAL_TEXT } from './preprocess';
import { isSymbolFont, symbolFontToUnicode } from './symbolFont';
import { adjustValues, presetGeometry } from './presetGeometry';

// Lays out a slide's text (text boxes, shape text, tables) as absolutely
// positioned DOM, so the browser does the line breaking and alignment. Only
// geometry and text are laid out here; drawSlide draws everything, measuring
// where the browser put each word. All lengths from pptxtojson are in points.
// Rotation is left out because drawSlide applies it in the PDF.

export interface SlideLayout {
  root: HTMLElement;
  // The positioned box of each element that has text (and of groups, which contain them)
  nodes: Map<SlideElement, HTMLElement>;
}

// PowerPoint only breaks lines between words (spaces) and after dashes, but
// browsers also break after characters like "/" or between ">" and "<". A
// zero-width word joiner between all other adjacent characters prevents that.
export const WORD_JOINER = '\u2060';
const BREAK_AFTER = /[-\u2010-\u2014]/;
// Scripts written without spaces, where lines can break between any characters
const NO_SPACES_SCRIPT = /[\u0E00-\u0FFF\u1000-\u109F\u1100-\u11FF\u1780-\u17FF\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u{20000}-\u{2FFFF}]/u;
const MARKER = /[\uE000-\uE0FF]/;

const shouldJoin = (char: string, next: string) =>
  !/\s/.test(char) && !/\s/.test(next) &&
  !BREAK_AFTER.test(char) &&
  !NO_SPACES_SCRIPT.test(char) && !NO_SPACES_SCRIPT.test(next) &&
  !MARKER.test(char) && !MARKER.test(next);

function joinWords(text: string) {
  const chars = Array.from(text);
  return chars.map((char, i) => (i + 1 < chars.length && shouldJoin(char, chars[i + 1]) ? char + WORD_JOINER : char)).join('');
}

// Words can also span differently styled runs (separate text nodes)
function joinAcrossNodes(nodes: globalThis.Text[]) {
  nodes.forEach((node, i) => {
    const prev = nodes[i - 1];
    if (!prev || !node.data || prev.parentElement?.closest('p') !== node.parentElement?.closest('p')) return;
    const last = Array.from(prev.data).pop();
    const first = Array.from(node.data)[0];
    if (last && last !== WORD_JOINER && shouldJoin(last, first)) node.data = WORD_JOINER + node.data;
  });
}

const pt = (n: number) => `${n}pt`;

// The value preprocessing added to a shape's name after a marker
const nameMarker = (name: string | undefined, marker: string) => name?.match(new RegExp(`${marker}([^\uE000-\uE0FF]*)`))?.[1];
// Scales a CSS length like "0.2em" or "6pt"
const scaleLength = (length: string, scale: number) => length.replace(/^[\d.]+/, (n) => String(parseFloat(n) * scale));

type Box = { left: number; top: number; width: number; height: number };

export function textNodesIn(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: globalThis.Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as globalThis.Text);
  return nodes;
}

function positioned(el: Box) {
  const node = document.createElement('div');
  Object.assign(node.style, { position: 'absolute', left: pt(el.left), top: pt(el.top), width: pt(el.width), height: pt(el.height) });
  return node;
}

function cssBorder(border: Partial<Border> | undefined) {
  if (!border?.borderWidth) return '';
  return `${pt(border.borderWidth)} ${border.borderType} ${border.borderColor}`;
}

// Lays out a bullet marker inserted by preparePptx in the paragraph's hanging indent
function renderBullet(node: globalThis.Text) {
  const start = node.data.indexOf(BULLET_START);
  const end = node.data.indexOf(BULLET_END, start);
  if (start === -1 || end === -1) return;
  const marker = node.splitText(start);
  marker.splitText(end - start + 1);

  const bullet = document.createElement('span');
  bullet.textContent = marker.data.slice(1, -1);
  const hangingIndent = -parseFloat(node.parentElement?.closest('p')?.style.textIndent || '0');
  Object.assign(bullet.style, { display: 'inline-block', textIndent: '0' });
  if (hangingIndent > 0) bullet.style.minWidth = pt(hangingIndent);
  else bullet.style.marginRight = '0.5em';
  marker.replaceWith(bullet);
}

function renderLineBreaks(node: globalThis.Text) {
  for (let index = node.data.indexOf(LINE_BREAK); index !== -1; index = node.data.indexOf(LINE_BREAK)) {
    node = node.splitText(index);
    node.data = node.data.slice(1);
    node.before(document.createElement('br'));
  }
}

// fontScale and spacingScale: how much autofit shrinks the text and the spacing
function renderTextContent(html: string, fontScale = 1, spacingScale = 1) {
  const content = document.createElement('div');
  content.innerHTML = html;
  for (const p of content.querySelectorAll('p')) {
    p.style.marginTop ||= '0';
    p.style.marginBottom ||= '0';
  }
  // PowerPoint leaves out the space before the first paragraph
  const first = content.querySelector('p');
  if (first) first.style.marginTop = '0';
  for (const el of content.querySelectorAll<HTMLElement>('[style]')) {
    const { style } = el;
    // pptxtojson@2.2.0 makes percentage paragraph spacing 100x too large (20% becomes 20em)
    if (style.marginTop.endsWith('em')) style.marginTop = `${parseFloat(style.marginTop) / 100}em`;
    if (style.marginBottom.endsWith('em')) style.marginBottom = `${parseFloat(style.marginBottom) / 100}em`;
    if (fontScale !== 1 && style.fontSize.endsWith('pt')) style.fontSize = pt(parseFloat(style.fontSize) * fontScale);
    if (spacingScale !== 1) {
      // Proportional line spacing shrinks, and so does the space between paragraphs
      if (style.lineHeight && !Number.isNaN(Number(style.lineHeight))) style.lineHeight = String(Number(style.lineHeight) * spacingScale);
      style.marginTop = scaleLength(style.marginTop, spacingScale);
      style.marginBottom = scaleLength(style.marginBottom, spacingScale);
    }
    // PowerPoint kerns text from 12pt up (the kern="1200" default templates set)
    if (style.fontSize.endsWith('pt')) style.fontKerning = parseFloat(style.fontSize) >= 12 ? 'normal' : 'none';
    if (style.verticalAlign === 'super' || style.verticalAlign === 'sub') {
      // PowerPoint shrinks superscripts and subscripts to 2/3 size, and raises them
      // 30% or lowers them 25% of the text size (pptxtojson only says which). Like
      // other text, they make their line taller when they stick out.
      const offset = style.verticalAlign === 'super' ? 0.3 : -0.25;
      const size = style.fontSize.endsWith('pt') ? parseFloat(style.fontSize) : null;
      style.verticalAlign = size ? pt(size * offset) : `${offset / 0.66}em`;
      style.fontSize = size ? pt(size * 0.66) : '0.66em';
      el.dataset.script = '';
    }
    if (isSymbolFont(style.fontFamily)) {
      for (const node of textNodesIn(el)) node.data = symbolFontToUnicode(node.data, style.fontFamily);
      style.fontFamily = 'Times New Roman';
    }
    if (style.fontFamily) style.fontFamily = cssFontStack(familyFor(style.fontFamily.split(',')[0]));
  }
  for (const p of content.querySelectorAll('p')) {
    // CSS makes every line at least as tall as its paragraph's own font (the
    // inherited default), while PowerPoint sizes lines by their text alone. The
    // paragraph gets the font of its smallest text, so it never makes a line taller.
    const sized = Array.from(p.querySelectorAll<HTMLElement>('[style]')).filter((el) => el.style.fontSize.endsWith('pt'));
    // Percentage spacing is relative to the paragraph's text, not the font size it gets below
    const largest = Math.max(0, ...sized.map((el) => parseFloat(el.style.fontSize)));
    for (const side of ['marginTop', 'marginBottom'] as const) {
      if (largest && p.style[side].endsWith('em')) p.style[side] = pt(parseFloat(p.style[side]) * largest);
    }
    const smallest = sized.reduce<HTMLElement | null>((min, el) => (!min || parseFloat(el.style.fontSize) < parseFloat(min.style.fontSize) ? el : min), null);
    if (smallest) {
      p.style.fontSize = smallest.style.fontSize;
      p.style.fontFamily = smallest.closest<HTMLElement>('[style*="font-family"]')?.style.fontFamily ?? '';
    }
  }
  // Links take their color and underline from the run (preprocessing gives them the theme's link color)
  for (const anchor of content.querySelectorAll('a')) Object.assign(anchor.style, { color: 'inherit', textDecoration: 'inherit' });
  for (const node of textNodesIn(content)) {
    // pptxtojson writes every space as &nbsp;, which would stop lines from wrapping
    node.data = joinWords(node.data.replace(/\u00a0/g, ' ').split(TAB).join('\t'));
    renderBullet(node);
  }
  for (const node of textNodesIn(content)) renderLineBreaks(node);
  // A line break at the end of a paragraph starts an empty line, which CSS leaves out
  for (const br of content.querySelectorAll('br')) {
    const p = br.closest('p');
    if (!p) continue;
    const after = document.createRange();
    after.setStartAfter(br);
    after.setEnd(p, p.childNodes.length);
    if (!after.toString()) br.after(' ');
  }
  joinAcrossNodes(textNodesIn(content));
  return content;
}

function renderTextBody(el: TextElement | ShapeElement) {
  const inset = el.textInset ?? { l: 7.2, t: 3.6, r: 7.2, b: 3.6 };
  // Text goes in the shape's text rectangle (the inside of an ellipse, the shaft of an arrow, ...)
  const area = (el.type === 'shape' && presetGeometry(el.shapType, el.width, el.height, adjustValues(el.keypoints))?.textInsets) || { left: 0, top: 0, right: 0, bottom: 0 };
  // Padding on each side: [top, right, bottom, left]
  let padding = [inset.t + area.top, inset.r + area.right, inset.b + area.bottom, inset.l + area.left];
  let box = { left: 0, top: 0, width: el.width, height: el.height };
  // Vertical text is laid out horizontally in the box turned a quarter turn
  // (centered on the box), and drawSlide rotates it into place
  const direction = nameMarker(el.name, VERTICAL_TEXT);
  const spacingScale = Number(nameMarker(el.name, SPACING_SCALE)) || 1;
  const rotation = direction ? (direction === 'vert270' ? -90 : 90) : 0;
  if (rotation) {
    box = { left: (el.width - el.height) / 2, top: (el.height - el.width) / 2, width: el.height, height: el.width };
    const [t, r, b, l] = padding;
    // The edges move with the rotation: turned clockwise, the box's left side is the shape's top
    padding = rotation === 90 ? [r, b, l, t] : [l, t, r, b];
  }
  const body = document.createElement('div');
  if (rotation) body.dataset.rotate = String(rotation);
  Object.assign(body.style, {
    position: 'absolute',
    left: pt(box.left),
    top: pt(box.top),
    width: pt(box.width),
    height: pt(box.height),
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: { mid: 'center', down: 'flex-end' }[el.vAlign] ?? 'flex-start',
    padding: padding.map(pt).join(' '),
    whiteSpace: el.wrap === false ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
    lineHeight: String(1.2 * spacingScale),
    // PowerPoint's default tab stops are an inch apart
    tabSize: '72pt',
  });
  body.append(renderTextContent(el.content, el.autoFit?.fontScale ? el.autoFit.fontScale / 100 : 1, spacingScale));
  return body;
}

function renderTable(el: TableElement) {
  const node = positioned(el);
  const table = document.createElement('table');
  Object.assign(table.style, { borderCollapse: 'collapse', tableLayout: 'fixed', width: pt(el.colWidths.reduce((sum, w) => sum + w, 0)) });
  table.style.borderTop = cssBorder(el.borders.top);
  table.style.borderBottom = cssBorder(el.borders.bottom);
  table.style.borderLeft = cssBorder(el.borders.left);
  table.style.borderRight = cssBorder(el.borders.right);
  const colgroup = document.createElement('colgroup');
  for (const width of el.colWidths) {
    const col = document.createElement('col');
    col.style.width = pt(width);
    colgroup.append(col);
  }
  table.append(colgroup);

  el.data.forEach((row, rowIndex) => {
    const tr = table.insertRow();
    tr.style.height = pt(el.rowHeights[rowIndex] ?? 0);
    let column = 0;
    for (const cell of row) {
      const columnIndex = column++;
      if (cell.hMerge || cell.vMerge) continue;
      const td = tr.insertCell();
      if (cell.colSpan) td.colSpan = cell.colSpan;
      if (cell.rowSpan) td.rowSpan = cell.rowSpan;
      // Margins and text direction, from the marker preprocessing put at the start of the text
      let text = cell.text;
      let margins = [7.2, 3.6, 7.2, 3.6]; // left, top, right, bottom
      let direction = '';
      const marker = text.match(new RegExp(`${CELL_START}([^${CELL_END}]*)${CELL_END}`));
      if (marker) {
        text = text.replace(marker[0], '');
        const parts = marker[1].split(',');
        margins = parts.slice(0, 4).map(Number);
        direction = parts[4] ?? '';
      }
      const [ml, mt, mr, mb] = margins;
      Object.assign(td.style, {
        padding: `${pt(mt)} ${pt(mr)} ${pt(mb)} ${pt(ml)}`,
        verticalAlign: { mid: 'middle', down: 'bottom' }[cell.vAlign] ?? 'top',
        background: cell.fillColor ?? '',
        color: cell.fontColor ?? '',
        fontWeight: cell.fontBold ? 'bold' : '',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        lineHeight: '1.2',
        borderTop: cssBorder(cell.borders.top),
        borderBottom: cssBorder(cell.borders.bottom),
        borderLeft: cssBorder(cell.borders.left),
        borderRight: cssBorder(cell.borders.right),
      });
      const content = renderTextContent(text);
      if (direction) {
        // Vertical text is laid out across the turned cell and rotated when drawn
        const span = (sizes: number[], from: number, count: number) => sizes.slice(from, from + count).reduce((sum, v) => sum + v, 0);
        const width = span(el.colWidths, columnIndex, cell.colSpan ?? 1);
        const height = span(el.rowHeights, rowIndex, cell.rowSpan ?? 1);
        const rotation = direction === 'vert270' ? -90 : 90;
        const turned = document.createElement('div');
        turned.dataset.rotate = String(rotation);
        Object.assign(turned.style, {
          position: 'absolute',
          left: pt((width - height) / 2),
          top: pt((height - width) / 2),
          width: pt(height),
          height: pt(width),
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { mid: 'center', down: 'flex-end' }[cell.vAlign] ?? 'flex-start',
          // Turned clockwise, the content's left side is the cell's top
          padding: (rotation === 90 ? [mr, mb, ml, mt] : [ml, mt, mr, mb]).map(pt).join(' '),
        });
        turned.append(content);
        Object.assign(td.style, { position: 'relative', padding: '0' });
        td.append(turned);
      } else {
        td.append(content);
      }
    }
  });
  node.append(table);
  return node;
}

function layoutElement(el: SlideElement, nodes: SlideLayout['nodes']): HTMLElement | null {
  let node: HTMLElement | null = null;
  if ((el.type === 'text' || el.type === 'shape') && el.content) {
    node = positioned(el);
    node.append(renderTextBody(el));
  } else if (el.type === 'table') {
    node = renderTable(el);
  } else if (el.type === 'group' || el.type === 'diagram') {
    node = positioned(el);
    for (const child of el.elements) {
      const childNode = layoutElement(child, nodes);
      if (childNode) node.append(childNode);
    }
  }
  if (node) nodes.set(el, node);
  return node;
}

// PowerPoint puts a line's extra spacing (beyond the height of its text) above
// the text, where CSS splits it above and below. Each paragraph moves down by
// the difference: half the extra spacing of its largest text. This needs the
// laid out slide, with its fonts loaded.
export function placeLineSpacing(root: HTMLElement) {
  const paragraphs = Array.from(root.querySelectorAll('p'));
  const shifts = paragraphs.map((p) => {
    let shift = -Infinity;
    for (const span of p.querySelectorAll<HTMLElement>('span')) {
      // The line's extra spacing goes by its normal text, not superscripts and subscripts
      if (!span.textContent || span.closest('[data-script]')) continue;
      const rect = span.getClientRects()[0];
      const lineHeight = parseFloat(getComputedStyle(span).lineHeight);
      if (rect && Number.isFinite(lineHeight)) shift = Math.max(shift, (lineHeight - rect.height) / 2);
    }
    return Number.isFinite(shift) ? shift : 0;
  });
  paragraphs.forEach((p, i) => {
    if (shifts[i]) Object.assign(p.style, { position: 'relative', top: `${shifts[i]}px` });
  });
}

export function layoutSlide(slide: Slide, size: { width: number; height: number }, slideNumber: number): SlideLayout {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'relative',
    width: pt(size.width),
    height: pt(size.height),
    color: '#000',
    fontFamily: cssFontStack('sans'),
    fontSize: '18pt',
    textAlign: 'left',
    // drawSlide places glyphs with the font's kerning (from 12pt up, see
    // renderTextContent) but no other adjustments, so the layout uses only those
    fontKerning: 'normal',
    fontVariantLigatures: 'none',
    fontSynthesis: 'none',
    textSizeAdjust: 'none',
  });
  const nodes: SlideLayout['nodes'] = new Map();
  for (const el of [...slide.layoutElements, ...slide.elements]) {
    const node = layoutElement(el, nodes);
    if (node) root.append(node);
  }
  // Slide number fields on layouts contain a ‹#› placeholder instead of the number
  const slideNumberField = new RegExp(`‹${WORD_JOINER}?#${WORD_JOINER}?›`, 'g');
  for (const node of textNodesIn(root)) node.data = node.data.replace(slideNumberField, String(slideNumber));
  return { root, nodes };
}
