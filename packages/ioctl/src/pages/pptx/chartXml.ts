import type JSZip from 'jszip';
import { readColorTheme, resolveFill, schemeColor, type ColorTheme } from './drawingColor';
import { formatNumber } from './numberFormat';
import type { Rgba } from './painter';

// Reads chart parts (ppt/charts/chartN.xml) into what drawChart needs.
// pptxtojson only extracts the data series; titles, labels, axis settings,
// fonts and colors come from here.

export interface TextStyle {
  size: number;
  bold: boolean;
  italic: boolean;
  color: Rgba;
  font: string;
}

// Missing color or width means automatic
export interface LineStyle {
  color?: Rgba;
  width?: number;
  dash?: number[];
}

// undefined: automatic (Office picks it); null: none
export type Paint = Rgba | null | undefined;
export type Stroke = LineStyle | null | undefined;

export interface ChartTitle {
  text: string;
  style: TextStyle;
}

export interface DataLabels {
  showValue: boolean;
  showPercent: boolean;
  showCategory: boolean;
  showSeries: boolean;
  separator: string;
  position?: string;
  formatCode?: string;
  style: TextStyle;
  deleted: Set<number>;
}

export interface Marker {
  symbol: string;
  size: number;
  fill: Paint;
  line: Stroke;
}

export interface Series {
  index: number;
  name: string;
  categories: string[];
  values: (number | null)[];
  xValues: (number | null)[];
  bubbleSizes: (number | null)[];
  formatCode: string;
  fill: Paint;
  line: Stroke;
  pointFills: Map<number, Paint>;
  marker?: Marker;
  labels: DataLabels | null;
  smooth: boolean;
}

export type GroupType = 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'radar';

export interface ChartGroup {
  type: GroupType;
  horizontal: boolean;
  grouping: string;
  varyColors: boolean;
  gapWidth: number;
  overlap: number;
  holeSize: number;
  firstSliceAngle: number;
  showMarkers: boolean;
  style: string; // scatterStyle or radarStyle
  bubbleScale: number;
  series: Series[];
  axisIds: string[];
}

export interface Axis {
  id: string;
  kind: 'cat' | 'val' | 'date' | 'ser';
  deleted: boolean;
  position: string;
  reversed: boolean;
  min?: number;
  max?: number;
  majorUnit?: number;
  formatCode?: string; // When not linked to the data
  majorGridlines: Stroke | false;
  line: Stroke;
  tickLabels: string;
  majorTickMark: string;
  style: TextStyle;
  rotation: number; // Label rotation in degrees
  title: ChartTitle | null;
  crossAxis: string;
  crosses: string;
  crossBetween?: string;
}

export interface ManualLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  inner: boolean;
}

export interface Legend {
  position: string;
  overlay: boolean;
  style: TextStyle;
  deleted: Set<number>;
  layout?: ManualLayout;
}

export interface ChartSpec {
  title: ChartTitle | null;
  groups: ChartGroup[];
  axes: Map<string, Axis>;
  legend: Legend | null;
  plotLayout?: ManualLayout;
  areaFill: Paint;
  areaLine: Stroke;
  plotFill: Paint;
  plotLine: Stroke;
  // Pictures filling the chart area or plot area, as data URLs
  areaPicture?: string;
  plotPicture?: string;
  styleNumber: number;
  theme: ColorTheme;
  base: TextStyle;
}

// A chart on a slide, with its frame size for matching it to pptxtojson's element
export interface ChartFrame {
  width: number;
  height: number;
  spec: ChartSpec;
}

const EMU_PER_PT = 12700;

const kids = (el: Element | null | undefined, name: string) => Array.from(el?.children ?? []).filter((c) => c.localName === name);
const kid = (el: Element | null | undefined, name: string) => Array.from(el?.children ?? []).find((c) => c.localName === name) ?? null;
const at = (el: Element | null | undefined, ...names: string[]) => names.reduce<Element | null | undefined>((cur, name) => kid(cur, name), el) ?? null;
const val = (el: Element | null | undefined, name: string) => kid(el, name)?.getAttribute('val') ?? undefined;
const flag = (el: Element | null | undefined, name: string, fallback = false) => {
  const v = val(el, name);
  // A boolean element with no val attribute means true
  if (v === undefined) return kid(el, name) ? true : fallback;
  return v === '1' || v === 'true';
};
const num = (el: Element | null | undefined, name: string) => {
  const v = val(el, name);
  return v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v);
};

const DASHES: Record<string, number[]> = {
  dash: [4, 3], sysDash: [3, 1], dot: [1, 1], sysDot: [1, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], sysDashDot: [3, 1, 1, 1],
  lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDotDot: [3, 1, 1, 1, 1, 1],
};

function readFill(spPr: Element | null, theme: ColorTheme): Paint {
  if (!spPr) return undefined;
  if (kid(spPr, 'noFill')) return null;
  const fill = kid(spPr, 'solidFill') ?? kid(spPr, 'gradFill') ?? kid(spPr, 'pattFill');
  return fill ? resolveFill(fill, theme) ?? undefined : undefined;
}

function readLine(spPr: Element | null, theme: ColorTheme): Stroke {
  const ln = kid(spPr, 'ln');
  if (!ln) return undefined;
  if (kid(ln, 'noFill')) return null;
  const color = resolveFill(kid(ln, 'solidFill') ?? kid(ln, 'gradFill'), theme) ?? undefined;
  const w = ln.getAttribute('w');
  const width = w ? Number(w) / EMU_PER_PT : undefined;
  return { color, width, dash: DASHES[val(ln, 'prstDash') ?? ''] };
}

function readTextStyle(txPr: Element | null, parent: TextStyle, theme: ColorTheme, minorFont: string): TextStyle {
  const p = kid(txPr, 'p');
  const props = at(p, 'pPr', 'defRPr') ?? at(p, 'r', 'rPr') ?? at(p, 'endParaRPr');
  if (!props) return parent;
  const sz = props.getAttribute('sz');
  const b = props.getAttribute('b');
  const i = props.getAttribute('i');
  const typeface = kid(props, 'latin')?.getAttribute('typeface');
  return {
    size: sz ? Number(sz) / 100 : parent.size,
    bold: b === null ? parent.bold : b === '1' || b === 'true',
    italic: i === null ? parent.italic : i === '1' || i === 'true',
    color: resolveFill(kid(props, 'solidFill'), theme) ?? parent.color,
    font: typeface ? (typeface.startsWith('+') ? minorFont : typeface) : parent.font,
  };
}

function readRichText(rich: Element | null) {
  return kids(rich, 'p')
    .map((p) => Array.from(p.children).map((r) => (r.localName === 'r' || r.localName === 'fld' ? kid(r, 't')?.textContent ?? '' : r.localName === 'br' ? '\n' : '')).join(''))
    .join('\n');
}

function readTitle(title: Element | null, fallbackText: string | null, parent: TextStyle, theme: ColorTheme, minorFont: string): ChartTitle | null {
  if (!title) return null;
  const rich = at(title, 'tx', 'rich');
  const style = readTextStyle(rich ?? kid(title, 'txPr'), parent, theme, minorFont);
  const text = rich ? readRichText(rich) : at(title, 'tx', 'strRef', 'strCache', 'pt', 'v')?.textContent ?? fallbackText;
  return text ? { text, style } : null;
}

function readLayout(layout: Element | null): ManualLayout | undefined {
  const manual = kid(layout, 'manualLayout');
  if (!manual || val(manual, 'xMode') !== 'edge' || val(manual, 'yMode') !== 'edge') return undefined;
  const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((name) => num(manual, name));
  if (x === undefined || y === undefined) return undefined;
  return { x, y, w: w ?? 0, h: h ?? 0, inner: val(manual, 'layoutTarget') === 'inner' };
}

// Point values from a cache or literal (<c:numCache>, <c:strCache>, <c:numLit>, ...)
function readPoints(cache: Element | null) {
  const count = num(cache, 'ptCount') ?? 0;
  const points: (string | null)[] = Array.from({ length: count }, () => null);
  for (const pt of kids(cache, 'pt')) {
    const idx = Number(pt.getAttribute('idx'));
    if (idx >= 0 && idx < 100000) points[idx] = kid(pt, 'v')?.textContent ?? null;
  }
  return { points, formatCode: kid(cache, 'formatCode')?.textContent ?? 'General' };
}

function dataSource(el: Element | null) {
  const ref = kid(el, 'numRef') ?? kid(el, 'strRef') ?? kid(el, 'multiLvlStrRef');
  const cache = ref
    ? kid(ref, 'numCache') ?? kid(ref, 'strCache') ?? kid(kid(ref, 'multiLvlStrCache'), 'lvl') ?? null
    : kid(el, 'numLit') ?? kid(el, 'strLit');
  if (ref && kid(ref, 'multiLvlStrCache')) {
    // Multi-level categories: the first level is the innermost labels
    const levels = kid(ref, 'multiLvlStrCache');
    const { points } = readPoints(kid(levels, 'lvl'));
    const count = num(levels, 'ptCount') ?? points.length;
    return { points: Array.from({ length: count }, (_, i) => points[i] ?? null), formatCode: 'General', numeric: false };
  }
  return { ...readPoints(cache), numeric: !!cache && (cache.localName === 'numCache' || cache.localName === 'numLit') };
}

const toNumbers = (points: (string | null)[]) => points.map((p) => (p === null || p === '' || Number.isNaN(Number(p)) ? null : Number(p)));

function readDataLabels(dLbls: Element | null, parent: DataLabels | null, base: TextStyle, theme: ColorTheme, minorFont: string): DataLabels | null {
  if (!dLbls) return parent;
  if (flag(dLbls, 'delete')) return null;
  const deleted = new Set<number>(parent?.deleted);
  for (const dLbl of kids(dLbls, 'dLbl')) {
    if (flag(dLbl, 'delete')) deleted.add(Number(val(dLbl, 'idx')));
  }
  const labels: DataLabels = {
    showValue: flag(dLbls, 'showVal', parent?.showValue),
    showPercent: flag(dLbls, 'showPercent', parent?.showPercent),
    showCategory: flag(dLbls, 'showCatName', parent?.showCategory),
    showSeries: flag(dLbls, 'showSerName', parent?.showSeries),
    separator: kid(dLbls, 'separator')?.textContent ?? parent?.separator ?? ', ',
    position: val(dLbls, 'dLblPos') ?? parent?.position,
    formatCode: parent?.formatCode,
    style: readTextStyle(kid(dLbls, 'txPr'), parent?.style ?? base, theme, minorFont),
    deleted,
  };
  const numFmt = kid(dLbls, 'numFmt');
  if (numFmt && numFmt.getAttribute('sourceLinked') !== '1') labels.formatCode = numFmt.getAttribute('formatCode') ?? undefined;
  return labels.showValue || labels.showPercent || labels.showCategory || labels.showSeries ? labels : null;
}

const GROUP_TYPES: Record<string, GroupType> = {
  barChart: 'bar', bar3DChart: 'bar', lineChart: 'line', line3DChart: 'line', stockChart: 'line', areaChart: 'area', area3DChart: 'area',
  pieChart: 'pie', pie3DChart: 'pie', ofPieChart: 'pie', doughnutChart: 'doughnut', scatterChart: 'scatter', bubbleChart: 'bubble', radarChart: 'radar',
};

function readSeries(ser: Element, groupLabels: DataLabels | null, base: TextStyle, theme: ColorTheme, minorFont: string, type: GroupType): Series {
  const spPr = kid(ser, 'spPr');
  const cat = dataSource(kid(ser, 'cat') ?? kid(ser, 'xVal'));
  const values = dataSource(kid(ser, 'val') ?? kid(ser, 'yVal'));
  const tx = kid(ser, 'tx');
  const name = at(tx, 'strRef', 'strCache', 'pt', 'v')?.textContent ?? kid(tx, 'v')?.textContent ?? `Series ${(num(ser, 'idx') ?? 0) + 1}`;
  const categories = cat.points.map((p) => (p === null ? '' : cat.numeric && !Number.isNaN(Number(p)) ? formatNumber(Number(p), cat.formatCode) : p));
  const pointFills = new Map<number, Paint>();
  for (const dPt of kids(ser, 'dPt')) pointFills.set(Number(val(dPt, 'idx')), readFill(kid(dPt, 'spPr'), theme));
  const markerEl = kid(ser, 'marker');
  return {
    index: num(ser, 'idx') ?? 0,
    name,
    categories,
    values: toNumbers(values.points),
    xValues: type === 'scatter' || type === 'bubble' ? toNumbers(cat.points) : [],
    bubbleSizes: toNumbers(dataSource(kid(ser, 'bubbleSize')).points),
    formatCode: values.formatCode,
    fill: readFill(spPr, theme),
    line: readLine(spPr, theme),
    pointFills,
    marker: markerEl
      ? { symbol: val(markerEl, 'symbol') ?? 'auto', size: num(markerEl, 'size') ?? 5, fill: readFill(kid(markerEl, 'spPr'), theme), line: readLine(kid(markerEl, 'spPr'), theme) }
      : undefined,
    labels: readDataLabels(kid(ser, 'dLbls'), groupLabels, base, theme, minorFont),
    smooth: flag(ser, 'smooth'),
  };
}

function readAxis(el: Element, base: TextStyle, theme: ColorTheme, minorFont: string): Axis {
  const kind = el.localName.replace('Ax', '') as Axis['kind'];
  const scaling = kid(el, 'scaling');
  const numFmt = kid(el, 'numFmt');
  const gridlines = kid(el, 'majorGridlines');
  const style = readTextStyle(kid(el, 'txPr'), base, theme, minorFont);
  const rot = at(el, 'txPr', 'bodyPr')?.getAttribute('rot');
  return {
    id: val(el, 'axId') ?? '',
    kind,
    deleted: flag(el, 'delete'),
    position: val(el, 'axPos') ?? 'b',
    reversed: val(scaling, 'orientation') === 'maxMin',
    min: num(scaling, 'min'),
    max: num(scaling, 'max'),
    majorUnit: num(el, 'majorUnit'),
    formatCode: numFmt && numFmt.getAttribute('sourceLinked') !== '1' ? numFmt.getAttribute('formatCode') ?? undefined : undefined,
    majorGridlines: gridlines ? readLine(kid(gridlines, 'spPr'), theme) : false,
    line: readLine(kid(el, 'spPr'), theme),
    tickLabels: val(el, 'tickLblPos') ?? 'nextTo',
    majorTickMark: val(el, 'majorTickMark') ?? 'cross',
    style,
    // Only rotations Office writes explicitly; -5400000 is vertical text
    rotation: rot && Number(rot) > -5400001 && Number(rot) < 5400001 ? Number(rot) / 60000 : 0,
    title: readTitle(kid(el, 'title'), null, { ...style, bold: true }, theme, minorFont),
    crossAxis: val(el, 'crossAx') ?? '',
    crosses: val(el, 'crosses') ?? 'autoZero',
    crossBetween: val(el, 'crossBetween'),
  };
}

export function parseChart(doc: Document, theme: ColorTheme, minorFont: string): ChartSpec | null {
  const space = doc.documentElement;
  const chart = kid(space, 'chart');
  const plotArea = kid(chart, 'plotArea');
  if (!chart || !plotArea) return null;
  const base = readTextStyle(kid(space, 'txPr'), { size: 10, bold: false, italic: false, color: schemeColor('tx1', theme), font: minorFont }, theme, minorFont);

  const groups: ChartGroup[] = [];
  for (const el of Array.from(plotArea.children)) {
    const type = GROUP_TYPES[el.localName];
    if (!type) continue;
    const grouping = val(el, 'grouping') ?? (type === 'bar' ? 'clustered' : 'standard');
    const labels = readDataLabels(kid(el, 'dLbls'), null, base, theme, minorFont);
    const stacked = grouping === 'stacked' || grouping === 'percentStacked';
    groups.push({
      type,
      horizontal: val(el, 'barDir') === 'bar',
      grouping,
      varyColors: flag(el, 'varyColors', type === 'pie' || type === 'doughnut'),
      gapWidth: num(el, 'gapWidth') ?? 150,
      overlap: num(el, 'overlap') ?? (stacked ? 100 : 0),
      holeSize: num(el, 'holeSize') ?? 50,
      firstSliceAngle: num(el, 'firstSliceAng') ?? 0,
      // Line charts show markers unless <c:marker val="0"/>
      showMarkers: el.localName === 'stockChart' ? false : flag(el, 'marker', true),
      style: val(el, 'scatterStyle') ?? val(el, 'radarStyle') ?? '',
      bubbleScale: num(el, 'bubbleScale') ?? 100,
      series: kids(el, 'ser')
        .map((ser) => readSeries(ser, labels, base, theme, minorFont, type))
        .sort((a, b) => a.index - b.index),
      axisIds: kids(el, 'axId').map((a) => a.getAttribute('val') ?? ''),
    });
  }
  if (!groups.some((g) => g.series.length)) return null;

  const axes = new Map<string, Axis>();
  for (const el of Array.from(plotArea.children)) {
    if (/^(cat|val|date|ser)Ax$/.test(el.localName)) {
      const axis = readAxis(el, base, theme, minorFont);
      axes.set(axis.id, axis);
    }
  }

  const allSeries = groups.flatMap((g) => g.series);
  // Without <c:autoTitleDeleted val="0"/>, Office shows no automatic title
  const autoTitleDeleted = flag(chart, 'autoTitleDeleted', true);
  // Charts with a single series are titled with its name unless the title was deleted
  const autoTitle = !autoTitleDeleted && allSeries.length === 1 ? allSeries[0].name : null;
  const titleEl = kid(chart, 'title');
  const titleStyle = { ...base, size: base.size * 1.2, bold: true };
  const title = titleEl
    ? readTitle(titleEl, allSeries.length === 1 ? allSeries[0].name : 'Chart Title', titleStyle, theme, minorFont)
    : autoTitle
      ? { text: autoTitle, style: titleStyle }
      : null;

  const legendEl = kid(chart, 'legend');
  const legend: Legend | null = legendEl
    ? {
        position: val(legendEl, 'legendPos') ?? 'r',
        overlay: flag(legendEl, 'overlay'),
        style: readTextStyle(kid(legendEl, 'txPr'), base, theme, minorFont),
        deleted: new Set(kids(legendEl, 'legendEntry').filter((e) => flag(e, 'delete')).map((e) => Number(val(e, 'idx')))),
        layout: readLayout(kid(legendEl, 'layout')),
      }
    : null;

  // Office 2010 and later also store the chart style in mc:AlternateContent (as 100 + style)
  const styleEl = Array.from(space.getElementsByTagNameNS('*', 'style')).find((s) => s.parentElement === space || s.parentElement?.parentElement?.parentElement === space);
  return {
    title,
    groups,
    axes,
    legend,
    plotLayout: readLayout(kid(plotArea, 'layout')),
    areaFill: readFill(kid(space, 'spPr'), theme),
    areaLine: readLine(kid(space, 'spPr'), theme),
    plotFill: readFill(kid(plotArea, 'spPr'), theme),
    plotLine: readLine(kid(plotArea, 'spPr'), theme),
    styleNumber: Number(styleEl?.getAttribute('val') ?? 2) % 100 || 2,
    theme,
    base,
  };
}

async function readXml(zip: JSZip, file: string) {
  const text = await zip.file(file)?.async('text');
  return text ? new DOMParser().parseFromString(text, 'application/xml') : null;
}

const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff' };

// The pictures filling a chart's area and plot area (parseChart reads color fills)
async function readPictureFills(zip: JSZip, file: string, doc: Document, spec: ChartSpec) {
  const rels = await readRels(zip, file);
  const picture = async (spPr: Element | null) => {
    const id = at(spPr, 'blipFill', 'blip')?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
    const path = id ? rels.get(id)?.path : undefined;
    const data = path ? await zip.file(path)?.async('base64') : undefined;
    return data && `data:${IMAGE_TYPES[path!.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'};base64,${data}`;
  };
  const space = doc.documentElement;
  spec.areaPicture = await picture(kid(space, 'spPr'));
  spec.plotPicture = await picture(at(space, 'chart', 'plotArea', 'spPr'));
}

async function readRels(zip: JSZip, file: string) {
  const dir = file.slice(0, file.lastIndexOf('/'));
  const rels = await readXml(zip, `${dir}/_rels/${file.slice(dir.length + 1)}.rels`);
  const targets = new Map<string, { type: string; path: string }>();
  for (const rel of Array.from(rels?.getElementsByTagNameNS('*', 'Relationship') ?? [])) {
    const target = rel.getAttribute('Target') ?? '';
    const parts = target.startsWith('/') ? target.slice(1).split('/') : [...dir.split('/'), ...target.split('/')];
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.') resolved.push(part);
    }
    targets.set(rel.getAttribute('Id') ?? '', { type: rel.getAttribute('Type') ?? '', path: resolved.join('/') });
  }
  return targets;
}

const relOfType = (rels: Map<string, { type: string; path: string }>, type: string) => Array.from(rels.values()).find((r) => r.type.endsWith(type))?.path;

// Reads the charts on each slide (slideN.xml is the Nth slide), in document order
export async function readCharts(zip: JSZip): Promise<ChartFrame[][]> {
  const result: ChartFrame[][] = [];
  for (let n = 1; zip.file(`ppt/slides/slide${n}.xml`); n++) {
    const file = `ppt/slides/slide${n}.xml`;
    const frames: ChartFrame[] = [];
    result.push(frames);
    const slide = await readXml(zip, file);
    const chartRefs = Array.from(slide?.getElementsByTagNameNS('*', 'chart') ?? []).filter((c) => c.parentElement?.localName === 'graphicData');
    if (!slide || !chartRefs.length) continue;

    const rels = await readRels(zip, file);
    const layoutFile = relOfType(rels, '/slideLayout');
    const masterFile = layoutFile && relOfType(await readRels(zip, layoutFile), '/slideMaster');
    const themeFile = masterFile && relOfType(await readRels(zip, masterFile), '/theme');
    const master = masterFile ? await readXml(zip, masterFile) : null;
    const themeDoc = themeFile ? await readXml(zip, themeFile) : null;
    const theme = readColorTheme(themeDoc, master);
    const minorFont = themeDoc?.getElementsByTagNameNS('*', 'minorFont')[0]?.getElementsByTagNameNS('*', 'latin')[0]?.getAttribute('typeface') ?? 'Calibri';

    for (const ref of chartRefs) {
      const id = ref.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
      const chartFile = rels.get(id)?.path;
      const frame = ref.closest('graphicFrame');
      const ext = frame && at(frame, 'xfrm', 'ext');
      const doc = chartFile ? await readXml(zip, chartFile) : null;
      const spec = doc && parseChart(doc, theme, minorFont);
      if (!spec || !ext) continue;
      await readPictureFills(zip, chartFile!, doc, spec);
      frames.push({ width: Number(ext.getAttribute('cx')) / EMU_PER_PT, height: Number(ext.getAttribute('cy')) / EMU_PER_PT, spec });
    }
  }
  return result;
}

// Charts are drawn from what readCharts reads, so pptxtojson only needs to find
// where they are. Its own chart parsing crashes on some valid charts (scatter
// charts with text x values, for example), so it gets a minimal chart instead.
const STUB_CHART =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:barChart>' +
  '<c:ser><c:val><c:numRef><c:numCache><c:ptCount val="1"/><c:pt idx="0"><c:v>0</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>' +
  '</c:barChart></c:plotArea></c:chart></c:chartSpace>';

export function stubCharts(zip: JSZip) {
  for (const name of Object.keys(zip.files)) {
    if (/^ppt\/charts\/chart[^/]*\.xml$/.test(name)) zip.file(name, STUB_CHART);
  }
}
