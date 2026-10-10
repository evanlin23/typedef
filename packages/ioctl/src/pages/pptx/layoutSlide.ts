import type { Border, Element as SlideElement, Shape as ShapeElement, Slide, Table as TableElement, Text as TextElement } from 'pptxtojson';
import { cssFontStack, familyFor } from './fonts';
import { BULLET_END, BULLET_START, LINE_BREAK, TAB } from './preprocess';
import { isSymbolFont, symbolFontToUnicode } from './symbolFont';
import { presetTextInsets } from './textRect';

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

function renderTextContent(html: string, fontScale = 1) {
  const content = document.createElement('div');
  content.innerHTML = html;
  for (const p of content.querySelectorAll('p')) {
    p.style.marginTop ||= '0';
    p.style.marginBottom ||= '0';
  }
  for (const el of content.querySelectorAll<HTMLElement>('[style]')) {
    const { style } = el;
    // pptxtojson@2.2.0 makes percentage paragraph spacing 100x too large (20% becomes 20em)
    if (style.marginTop.endsWith('em')) style.marginTop = `${parseFloat(style.marginTop) / 100}em`;
    if (style.marginBottom.endsWith('em')) style.marginBottom = `${parseFloat(style.marginBottom) / 100}em`;
    if (fontScale !== 1 && style.fontSize.endsWith('pt')) style.fontSize = pt(parseFloat(style.fontSize) * fontScale);
    if (style.verticalAlign === 'super' || style.verticalAlign === 'sub') {
      // PowerPoint shrinks superscripts/subscripts, and they shouldn't push lines apart
      style.fontSize = style.fontSize.endsWith('pt') ? pt(parseFloat(style.fontSize) * 0.66) : '0.66em';
      style.lineHeight = '0';
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
    const smallest = sized.reduce<HTMLElement | null>((min, el) => (!min || parseFloat(el.style.fontSize) < parseFloat(min.style.fontSize) ? el : min), null);
    if (smallest) {
      p.style.fontSize = smallest.style.fontSize;
      p.style.fontFamily = smallest.closest<HTMLElement>('[style*="font-family"]')?.style.fontFamily ?? '';
    }
  }
  for (const node of textNodesIn(content)) {
    // pptxtojson writes every space as &nbsp;, which would stop lines from wrapping
    node.data = joinWords(node.data.replace(/\u00a0/g, ' ').split(TAB).join('\t'));
    renderBullet(node);
  }
  for (const node of textNodesIn(content)) renderLineBreaks(node);
  joinAcrossNodes(textNodesIn(content));
  return content;
}

function renderTextBody(el: TextElement | ShapeElement) {
  const inset = el.textInset ?? { l: 7.2, t: 3.6, r: 7.2, b: 3.6 };
  const area = el.type === 'shape' ? presetTextInsets(el.shapType, el.width, el.height, el.keypoints) : { left: 0, top: 0, right: 0, bottom: 0 };
  const body = document.createElement('div');
  Object.assign(body.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: { mid: 'center', down: 'flex-end' }[el.vAlign] ?? 'flex-start',
    padding: `${pt(inset.t + area.top)} ${pt(inset.r + area.right)} ${pt(inset.b + area.bottom)} ${pt(inset.l + area.left)}`,
    whiteSpace: el.wrap === false ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
    lineHeight: '1.2',
    // PowerPoint's default tab stops are an inch apart
    tabSize: '72pt',
  });
  if (el.type === 'text' && el.isVertical) body.style.writingMode = 'vertical-rl';
  body.append(renderTextContent(el.content, el.autoFit?.fontScale ? el.autoFit.fontScale / 100 : 1));
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
    for (const cell of row) {
      if (cell.hMerge || cell.vMerge) continue;
      const td = tr.insertCell();
      if (cell.colSpan) td.colSpan = cell.colSpan;
      if (cell.rowSpan) td.rowSpan = cell.rowSpan;
      Object.assign(td.style, {
        padding: '3.6pt 7.2pt',
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
      td.append(renderTextContent(cell.text));
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
    // The PDF places glyphs by their advance widths alone, so the layout must too
    fontKerning: 'none',
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
