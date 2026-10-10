import type {
  Border,
  Element as SlideElement,
  Fill,
  Image as ImageElement,
  LineEnd,
  Shape as ShapeElement,
  Slide,
  Table as TableElement,
  Text as TextElement,
} from 'pptxtojson';
import { wmfToSvg } from './metafile';
import { BULLET_END, BULLET_START, LINE_BREAK } from './preprocess';
import { isSymbolFont, symbolFontToUnicode } from './symbolFont';

// Renders a slide parsed by pptxtojson into absolutely positioned DOM. All
// lengths from pptxtojson are in points, so the slide is laid out in pt units.

const SVG_NS = 'http://www.w3.org/2000/svg';
const pt = (n: number) => `${n}pt`;

const WMF_IMAGE = /^data:image\/(x-)?wmf/i;
// Other image formats browsers can't decode
const UNSUPPORTED_IMAGE = /^data:image\/(x-)?(emf|tiff)/i;

const LINE_END_SIZES = { sm: 2, med: 3, lg: 5 };
const MARKER_PATHS: Record<string, string> = {
  diamond: 'M0,5 L5,0 L10,5 L5,10 Z',
  stealth: 'M0,0 L10,5 L0,10 L3,5 Z',
  triangle: 'M0,0 L10,5 L0,10 Z',
};

let nextSvgId = 0;

type Box = { left: number; top: number; width: number; height: number; rotate?: number };
type Picture = Box & Partial<Border> & Partial<Pick<ImageElement, 'rect' | 'geom' | 'isFlipH' | 'isFlipV'>> & { base64: string };

function textNodesIn(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: globalThis.Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as globalThis.Text);
  return nodes;
}

function positioned(el: Box, tag = 'div') {
  const node = document.createElement(tag);
  Object.assign(node.style, { position: 'absolute', left: pt(el.left), top: pt(el.top), width: pt(el.width), height: pt(el.height) });
  if (el.rotate) node.style.transform = `rotate(${el.rotate}deg)`;
  return node;
}

function svgElement(tag: string, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function withFallbackFonts(family: string) {
  if (/courier|consolas|mono|lucida console|menlo/i.test(family)) return `${family}, "Courier New", monospace`;
  if (/times|cambria|georgia|garamond|palatino|book antiqua|serif/i.test(family)) return `${family}, "Times New Roman", serif`;
  return `${family}, Arial, Helvetica, sans-serif`;
}

function cssBackground(fill: Fill | null | undefined) {
  switch (fill?.type) {
    case 'color':
      return fill.value;
    case 'image':
      return `url("${fill.value.base64}") center / 100% 100% no-repeat`;
    case 'gradient': {
      const stops = fill.value.colors.map((stop) => `${stop.color} ${stop.pos || '0%'}`).join(', ');
      return fill.value.path === 'line' ? `linear-gradient(${fill.value.rot + 90}deg, ${stops})` : `radial-gradient(${stops})`;
    }
    case 'pattern':
      return fill.value.foregroundColor;
    default:
      return '';
  }
}

function svgPaint(defs: SVGDefsElement, fill: Fill | null | undefined) {
  if (!fill) return 'none';
  if (fill.type === 'color') return fill.value;
  if (fill.type === 'pattern') return fill.value.foregroundColor;
  const id = `pptx-fill-${nextSvgId++}`;
  if (fill.type === 'gradient') {
    const isLinear = fill.value.path === 'line';
    const gradient = svgElement(isLinear ? 'linearGradient' : 'radialGradient', { id });
    if (isLinear) gradient.setAttribute('gradientTransform', `rotate(${fill.value.rot}, 0.5, 0.5)`);
    for (const stop of fill.value.colors) gradient.append(svgElement('stop', { offset: stop.pos || '0%', 'stop-color': stop.color }));
    defs.append(gradient);
  } else {
    const pattern = svgElement('pattern', { id, width: 1, height: 1, patternContentUnits: 'objectBoundingBox' });
    pattern.append(svgElement('image', { href: fill.value.base64, width: 1, height: 1, preserveAspectRatio: 'none' }));
    defs.append(pattern);
  }
  return `url(#${id})`;
}

function svgMarker(defs: SVGDefsElement, end: LineEnd | undefined, color: string) {
  if (!end || end.type === 'none') return null;
  const id = `pptx-marker-${nextSvgId++}`;
  const marker = svgElement('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: 5,
    refY: 5,
    markerWidth: LINE_END_SIZES[end.length ?? 'med'],
    markerHeight: LINE_END_SIZES[end.width ?? 'med'],
    orient: 'auto-start-reverse',
  });
  if (end.type === 'oval') marker.append(svgElement('circle', { cx: 5, cy: 5, r: 5, fill: color }));
  else if (end.type === 'arrow') marker.append(svgElement('path', { d: 'M0,0 L10,5 L0,10', fill: 'none', stroke: color, 'stroke-width': 2 }));
  else marker.append(svgElement('path', { d: MARKER_PATHS[end.type] ?? MARKER_PATHS.triangle, fill: color }));
  defs.append(marker);
  return `url(#${id})`;
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
  bullet.dataset.decorative = '';
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
    if (style.fontFamily) style.fontFamily = withFallbackFonts(style.fontFamily);
  }
  for (const node of textNodesIn(content)) {
    // pptxtojson writes every space as &nbsp;, which would stop lines from wrapping
    node.data = node.data.replace(/\u00a0/g, ' ');
    renderBullet(node);
  }
  for (const node of textNodesIn(content)) renderLineBreaks(node);
  return content;
}

function renderTextBody(el: TextElement | ShapeElement) {
  const inset = el.textInset ?? { l: 7.2, t: 3.6, r: 7.2, b: 3.6 };
  const body = document.createElement('div');
  Object.assign(body.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: { mid: 'center', down: 'flex-end' }[el.vAlign] ?? 'flex-start',
    padding: `${pt(inset.t)} ${pt(inset.r)} ${pt(inset.b)} ${pt(inset.l)}`,
    whiteSpace: el.wrap === false ? 'pre' : 'pre-wrap',
    overflowWrap: 'break-word',
    lineHeight: '1.2',
  });
  if (el.type === 'text' && el.isVertical) body.style.writingMode = 'vertical-rl';
  body.append(renderTextContent(el.content, el.autoFit?.fontScale ? el.autoFit.fontScale / 100 : 1));
  return body;
}

function renderText(el: TextElement) {
  const node = positioned(el);
  node.style.background = cssBackground(el.fill);
  if (el.borderWidth) node.style.outline = cssBorder(el);
  if (el.shadow) node.style.filter = `drop-shadow(${pt(el.shadow.h)} ${pt(el.shadow.v)} ${pt(el.shadow.blur)} ${el.shadow.color})`;
  if (el.content) node.append(renderTextBody(el));
  return node;
}

function renderShape(el: ShapeElement) {
  const node = positioned(el);
  if (el.path) {
    const viewBox = el.pathViewBox ?? { x: 0, y: 0, width: el.width, height: el.height };
    const svg = svgElement('svg', {
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
      preserveAspectRatio: 'none',
      width: '100%',
      height: '100%',
      overflow: 'visible',
    });
    Object.assign(svg.style, { position: 'absolute', inset: '0', display: 'block', transform: `scale(${el.isFlipH ? -1 : 1}, ${el.isFlipV ? -1 : 1})` });
    if (el.shadow) svg.style.filter = `drop-shadow(${pt(el.shadow.h)} ${pt(el.shadow.v)} ${pt(el.shadow.blur)} ${el.shadow.color})`;
    const defs = svgElement('defs') as SVGDefsElement;
    const shape = svgElement('path', {
      d: el.path,
      fill: el.strokeOnly ? 'none' : svgPaint(defs, el.fill),
      stroke: el.borderWidth ? el.borderColor : 'none',
      'stroke-width': el.borderWidth,
    });
    if (el.borderType !== 'solid' && el.borderStrokeDasharray !== '0') shape.setAttribute('stroke-dasharray', el.borderStrokeDasharray);
    const markerStart = el.borderWidth && svgMarker(defs, el.headEnd, el.borderColor);
    const markerEnd = el.borderWidth && svgMarker(defs, el.tailEnd, el.borderColor);
    if (markerStart) shape.setAttribute('marker-start', markerStart);
    if (markerEnd) shape.setAttribute('marker-end', markerEnd);
    svg.append(defs, shape);
    node.append(svg);
  }
  if (el.content) node.append(renderTextBody(el));
  return node;
}

// WMF images (usually equations) are converted to SVG and drawn inline rather
// than as an <img>, so glyphs that reach past the edges aren't clipped
function renderMetafile(el: Picture) {
  let svg: Element | null = null;
  try {
    const bytes = Uint8Array.from(atob(el.base64.slice(el.base64.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    const markup = wmfToSvg(bytes.buffer);
    if (markup) svg = new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('svg');
  } catch {
    // Unreadable files fall through to the placeholder
  }
  if (!svg) return renderPlaceholder(el, 'Image not shown');
  const node = positioned(el);
  const inline = document.importNode(svg, true) as SVGSVGElement;
  Object.assign(inline.style, { position: 'absolute', width: '100%', height: '100%', overflow: 'visible' });
  node.append(inline);
  return node;
}

function renderImage(el: Picture) {
  if (WMF_IMAGE.test(el.base64)) return renderMetafile(el);
  if (!el.base64 || UNSUPPORTED_IMAGE.test(el.base64)) return renderPlaceholder(el, 'Image not shown');
  const node = positioned(el);
  node.style.overflow = 'hidden';
  if (el.geom === 'ellipse') node.style.borderRadius = '50%';
  if (el.geom === 'roundRect') node.style.borderRadius = '8%';
  if (el.borderWidth) node.style.outline = cssBorder(el);

  // rect holds the percentage cropped from each edge of the source image
  const { t = 0, b = 0, l = 0, r = 0 } = el.rect ?? {};
  const img = document.createElement('img');
  img.src = el.base64;
  Object.assign(img.style, {
    position: 'absolute',
    display: 'block',
    maxWidth: 'none',
    width: `${10000 / (100 - l - r)}%`,
    height: `${10000 / (100 - t - b)}%`,
    left: `${(-100 * l) / (100 - l - r)}%`,
    top: `${(-100 * t) / (100 - t - b)}%`,
    transform: `scale(${el.isFlipH ? -1 : 1}, ${el.isFlipV ? -1 : 1})`,
  });
  node.append(img);
  return node;
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

// Marks content that can't be rendered so it isn't silently missing from the PDF
function renderPlaceholder(el: Box, label: string) {
  const node = positioned(el);
  Object.assign(node.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1pt dashed #999',
    color: '#777',
    fontSize: '12pt',
    fontFamily: 'Arial, Helvetica, sans-serif',
  });
  node.textContent = label;
  node.dataset.decorative = '';
  return node;
}

function renderElement(el: SlideElement): HTMLElement | null {
  switch (el.type) {
    case 'text':
      return renderText(el);
    case 'shape':
      return renderShape(el);
    case 'image':
      return renderImage(el);
    case 'table':
      return renderTable(el);
    case 'math':
      return renderImage({ ...el, base64: el.picBase64 });
    case 'group':
    case 'diagram': {
      const node = positioned(el);
      if (el.type === 'group' && (el.isFlipH || el.isFlipV)) {
        node.style.transform += ` scale(${el.isFlipH ? -1 : 1}, ${el.isFlipV ? -1 : 1})`;
      }
      for (const child of el.elements) {
        const childNode = renderElement(child);
        if (childNode) node.append(childNode);
      }
      return node;
    }
    case 'chart':
      return renderPlaceholder(el, 'Chart not shown');
    case 'video':
      return renderPlaceholder(el, 'Video not shown');
    default:
      return null;
  }
}

export function renderSlide(slide: Slide, size: { width: number; height: number }, slideNumber: number) {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'relative',
    overflow: 'hidden',
    width: pt(size.width),
    height: pt(size.height),
    background: cssBackground(slide.fill) || '#fff',
    color: '#000',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '18pt',
    textAlign: 'left',
  });
  for (const el of [...slide.layoutElements, ...slide.elements]) {
    const node = renderElement(el);
    if (node) root.append(node);
  }
  // Slide number fields on layouts contain a ‹#› placeholder instead of the number
  for (const node of textNodesIn(root)) {
    if (node.data.includes('‹#›')) node.data = node.data.split('‹#›').join(String(slideNumber));
  }
  return root;
}
