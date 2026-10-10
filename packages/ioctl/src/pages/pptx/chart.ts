import type { PDFFont } from 'pdf-lib';
import type { Chart } from 'pptxtojson';
import type { Axis, ChartFrame, ChartGroup, ChartSpec, DataLabels, Marker, Series, Stroke, TextStyle } from './chartXml';
import { modify, schemeColor } from './drawingColor';
import type { DrawContext } from './drawSlide';
import { familyFor, loadFace } from './fonts';
import { formatNumber } from './numberFormat';
import type { Painter, Rgba } from './painter';
import { ellipsePath, rectPath } from './svgPath';

// Draws charts as vector graphics, the way PowerPoint lays out its default
// chart elements: title, legend, axes with automatic scales, gridlines, data
// series and data labels. Bar, line, area, pie, doughnut, scatter, bubble and
// radar charts are supported (3D charts are drawn flat).

type Rect = { left: number; top: number; right: number; bottom: number };
type Align = 'left' | 'center' | 'right';

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
// Office's automatic axis and gridline color
const AXIS_GRAY: Rgba = { r: 0.525, g: 0.525, b: 0.525, a: 1 };
const PAD = 7;
const TICK = 4;
const AUTO_MARKERS = ['diamond', 'square', 'triangle', 'x', 'star', 'circle', 'plus', 'dash', 'dot'];
// Variations of the accent colors for series beyond the sixth
const CYCLE_VARIATIONS: [string, number][][] = [[], [['lumMod', 0.6]], [['lumMod', 0.8], ['lumOff', 0.2]], [['lumMod', 0.8]], [['lumMod', 0.6], ['lumOff', 0.4]], [['lumMod', 0.5]]];

interface Label {
  text: string;
  style: TextStyle;
  font: PDFFont;
  width: number;
}

// Picks the chart frame read from the slide that matches pptxtojson's chart element
function takeFrame(frames: ChartFrame[], chart: Chart) {
  const matching = frames.findIndex((f) => Math.abs(f.width - chart.width) < 1 && Math.abs(f.height - chart.height) < 1);
  return frames.splice(matching === -1 ? 0 : matching, 1)[0] as ChartFrame | undefined;
}

class ChartDrawer {
  private ctx: DrawContext;
  private spec: ChartSpec;
  private painter: Painter;
  private fonts = new Map<string, Promise<PDFFont>>();

  constructor(ctx: DrawContext, spec: ChartSpec) {
    this.ctx = ctx;
    this.spec = spec;
    this.painter = ctx.painter;
  }

  // A picture fill, stretched over the area
  async drawPicture(dataUrl: string | undefined, rect: Rect) {
    if (!dataUrl) return;
    const asset = await this.ctx.images.get(dataUrl);
    if (asset.kind === 'image') this.painter.drawImage(asset.image, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
  }

  // Office's automatic color for the nth series (or point, for varied colors)
  autoColor(n: number, count: number): Rgba {
    const style = ((this.spec.styleNumber - 1) % 8) + 1;
    const theme = this.spec.theme;
    if (style === 1) {
      const level = count > 1 ? 0.25 + (0.55 * n) / (count - 1) : 0.4;
      return { r: level, g: level, b: level, a: 1 };
    }
    if (style === 2) {
      const base = schemeColor(`accent${(n % 6) + 1}`, theme);
      const variation = CYCLE_VARIATIONS[Math.floor(n / 6) % CYCLE_VARIATIONS.length];
      return variation.reduce((c, [name, val]) => modify(c, name, val), base);
    }
    // Styles 3-8 use shades of a single accent color, darkest first
    const base = schemeColor(`accent${style - 2}`, theme);
    if (count <= 1) return base;
    const t = n / (count - 1);
    return t < 0.5 ? modify(base, 'shade', 0.5 + t) : modify(base, 'tint', 1 - (t - 0.5));
  }

  seriesColor(group: ChartGroup, series: Series, position: number) {
    return this.autoColor(group.series.length > 1 || !group.varyColors ? series.index : position, group.series.length);
  }

  async label(text: string, style: TextStyle): Promise<Label> {
    const family = familyFor(style.font);
    let face = await loadFace(family, style.bold, style.italic);
    // Fall back to the symbol font for characters the chart's font lacks
    if ([...text].some((c) => !face.font.hasGlyphForCodePoint(c.codePointAt(0)!))) face = await loadFace('symbols', style.bold, false);
    let font = this.fonts.get(face.key);
    if (!font) {
      font = this.ctx.fonts.embed(face);
      this.fonts.set(face.key, font);
    }
    const embedded = await font;
    return { text, style, font: embedded, width: embedded.widthOfTextAtSize(text, style.size) };
  }

  // Word-wraps text to a width; words wider than it stay whole
  async wrap(text: string, style: TextStyle, maxWidth: number, maxLines = Infinity): Promise<Label[]> {
    const lines: Label[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && (await this.label(candidate, style)).width > maxWidth) {
          lines.push(await this.label(line, style));
          line = word;
        } else line = candidate;
      }
      lines.push(await this.label(line, style));
    }
    return lines.slice(0, maxLines);
  }

  // Draws a label with its baseline placed so the text is centered on y (or top-aligned at y)
  draw(label: Label, x: number, y: number, align: Align = 'center', valign: 'middle' | 'top' = 'middle', rotation = 0) {
    const { size, color } = label.style;
    const left = align === 'center' ? -label.width / 2 : align === 'right' ? -label.width : 0;
    const baseline = valign === 'middle' ? size * 0.35 : size * 0.9;
    if (rotation) {
      const radians = (rotation * Math.PI) / 180;
      this.painter.save();
      this.painter.transform(Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), x, y);
      this.painter.drawText(label.font, size, left, baseline, label.font.encodeText(label.text), color);
      this.painter.restore();
    } else {
      this.painter.drawText(label.font, size, x + left, y + baseline, label.font.encodeText(label.text), color);
    }
  }

  stroke(path: string, line: Stroke, fallback: Rgba, width = 0.75) {
    if (line === null) return;
    const w = line?.width ?? width;
    this.painter.drawPath(path, null, line?.color ?? fallback, { width: w, dash: line?.dash?.map((d) => d * w) });
  }

  marker(marker: Marker | undefined, index: number, color: Rgba, x: number, y: number) {
    const symbol = !marker || marker.symbol === 'auto' ? AUTO_MARKERS[index % AUTO_MARKERS.length] : marker.symbol;
    if (symbol === 'none') return;
    const s = marker?.size ?? 5;
    const h = s / 2;
    const fill = marker?.fill === undefined ? color : marker.fill;
    const line = marker?.line === undefined ? { color, width: 0.75 } : marker.line;
    const paths: Record<string, string> = {
      circle: ellipsePath(x - h, y - h, s, s),
      dot: ellipsePath(x - h / 2, y - h / 2, h, h),
      square: rectPath(x - h, y - h, s, s),
      diamond: `M${x},${y - h} L${x + h},${y} L${x},${y + h} L${x - h},${y} Z`,
      triangle: `M${x},${y - h} L${x + h},${y + h} L${x - h},${y + h} Z`,
      dash: rectPath(x - h, y - s / 10, s, s / 5),
    };
    const crossing: Record<string, string> = {
      x: `M${x - h},${y - h} L${x + h},${y + h} M${x - h},${y + h} L${x + h},${y - h}`,
      plus: `M${x - h},${y} L${x + h},${y} M${x},${y - h} L${x},${y + h}`,
      star: `M${x - h},${y - h} L${x + h},${y + h} M${x - h},${y + h} L${x + h},${y - h} M${x},${y - h} L${x},${y + h}`,
    };
    if (crossing[symbol]) {
      this.painter.drawPath(crossing[symbol], null, line?.color ?? fill ?? color, { width: line?.width ?? 0.75 });
      return;
    }
    const path = paths[symbol] ?? paths.square;
    this.painter.drawPath(path, fill ?? null, line === null ? null : line.color ?? color, { width: line?.width ?? 0.75 });
  }

  async dataLabel(labels: DataLabels, series: Series, index: number, value: number, total: number) {
    const parts: string[] = [];
    if (labels.showSeries) parts.push(series.name);
    if (labels.showCategory) parts.push(series.categories[index] ?? String(index + 1));
    if (labels.showValue) parts.push(formatNumber(value, labels.formatCode ?? series.formatCode));
    if (labels.showPercent) parts.push(formatNumber(total ? value / total : 0, labels.formatCode && /%/.test(labels.formatCode) ? labels.formatCode : '0%'));
    return this.wrap(parts.join(labels.separator), labels.style, Infinity);
  }

  drawLines(lines: Label[], x: number, y: number, align: Align = 'center') {
    const lineHeight = lines[0]?.style.size * 1.2 || 0;
    lines.forEach((line, i) => this.draw(line, x, y - ((lines.length - 1) * lineHeight) / 2 + i * lineHeight, align));
  }

  async run(width: number, height: number) {
    const { spec, painter } = this;
    if (spec.areaFill) painter.drawPath(rectPath(0, 0, width, height), spec.areaFill);
    await this.drawPicture(spec.areaPicture, { left: 0, top: 0, right: width, bottom: height });
    if (spec.areaLine) this.stroke(rectPath(0, 0, width, height), spec.areaLine, AXIS_GRAY);

    const region: Rect = { left: PAD, top: PAD, right: width - PAD, bottom: height - PAD };
    if (spec.title) {
      const lines = await this.wrap(spec.title.text, spec.title.style, (width - 2 * PAD) * 0.8);
      const lineHeight = spec.title.style.size * 1.2;
      lines.forEach((line, i) => this.draw(line, width / 2, region.top + i * lineHeight, 'center', 'top'));
      region.top += lines.length * lineHeight + 4;
    }
    await this.drawLegend(region, width, height);

    let plot = region;
    const layout = spec.plotLayout;
    if (layout) plot = { left: layout.x * width, top: layout.y * height, right: (layout.x + layout.w) * width, bottom: (layout.y + layout.h) * height };
    const inner = !!layout?.inner;
    const types = new Set(spec.groups.map((g) => g.type));
    if (types.has('pie') || types.has('doughnut')) return this.drawPie(plot, inner);
    if (types.has('scatter') || types.has('bubble')) return this.drawXY(plot, inner);
    if (types.has('radar')) return this.drawRadar(plot);
    return this.drawCategoryChart(plot, inner);
  }

  async drawLegend(region: Rect, width: number, height: number) {
    const { legend } = this.spec;
    if (!legend) return;
    const groups = this.spec.groups;
    type Entry = { label: Label; color: Rgba; kind: 'box' | 'line'; showLine?: boolean; marker?: Marker; markerIndex: number; showMarker: boolean };
    const entries: Entry[] = [];
    const first = groups[0];
    if (groups.length === 1 && first.varyColors && first.series.length === 1) {
      const series = first.series[0];
      for (const [i, name] of series.categories.entries()) {
        if (legend.deleted.has(i)) continue;
        entries.push({ label: await this.label(name, legend.style), color: series.pointFills.get(i) ?? this.autoColor(i, series.categories.length), kind: 'box', markerIndex: i, showMarker: false });
      }
    } else {
      let i = 0;
      for (const group of groups) {
        const groupEntries: Entry[] = [];
        for (const series of group.series) {
          if (legend.deleted.has(i++)) continue;
          const isLine = group.type === 'line' || group.type === 'scatter' || (group.type === 'radar' && group.style !== 'filled');
          const color = (isLine ? series.line?.color : series.fill) ?? this.seriesColor(group, series, 0);
          const showLine = series.line !== null && !(group.type === 'scatter' && group.style === 'marker');
          const showMarker = (group.type === 'line' && group.showMarkers) || (group.type === 'scatter' && !/^(line|smooth)$/.test(group.style)) || group.style === 'marker';
          groupEntries.push({ label: await this.label(series.name, legend.style), color, kind: isLine ? 'line' : 'box', showLine, marker: series.marker, markerIndex: series.index, showMarker });
        }
        // Side legends list stacked columns and areas top series first, matching the stack
        const stackedUp = (group.grouping === 'stacked' || group.grouping === 'percentStacked') && (group.type === 'area' || (group.type === 'bar' && !group.horizontal));
        if (stackedUp && legend.position !== 't' && legend.position !== 'b') groupEntries.reverse();
        entries.push(...groupEntries);
      }
    }
    if (!entries.length) return;

    const size = legend.style.size;
    const lineHeight = size * 1.25;
    const swatch = (e: Entry) => (e.kind === 'line' ? size * 1.8 : size * 0.6);
    const entryWidth = (e: Entry) => swatch(e) + size * 0.3 + e.label.width;
    const vertical = legend.position === 'r' || legend.position === 'l' || legend.position === 'tr';
    // Rows of entries: one entry per row for side legends, packed for top/bottom
    const maxWidth = region.right - region.left;
    const rows: Entry[][] = [];
    for (const entry of entries) {
      const row = rows[rows.length - 1];
      const rowWidth = row ? row.reduce((sum, e) => sum + entryWidth(e) + size, 0) : 0;
      if (!vertical && row && rowWidth + entryWidth(entry) <= maxWidth) row.push(entry);
      else rows.push([entry]);
    }
    const rowWidths = rows.map((row) => row.reduce((sum, e) => sum + entryWidth(e), 0) + (row.length - 1) * size);
    const boxWidth = Math.min(maxWidth, Math.max(...rowWidths));
    const boxHeight = rows.length * lineHeight;

    let left: number;
    let top: number;
    if (legend.layout) {
      left = legend.layout.x * width;
      top = legend.layout.y * height;
    } else if (legend.position === 'r' || legend.position === 'tr') {
      left = region.right - boxWidth;
      top = legend.position === 'tr' ? region.top : (region.top + region.bottom - boxHeight) / 2;
      if (!legend.overlay) region.right -= boxWidth + PAD;
    } else if (legend.position === 'l') {
      left = region.left;
      top = (region.top + region.bottom - boxHeight) / 2;
      if (!legend.overlay) region.left += boxWidth + PAD;
    } else if (legend.position === 't') {
      left = (region.left + region.right - boxWidth) / 2;
      top = region.top;
      if (!legend.overlay) region.top += boxHeight + 4;
    } else {
      left = (region.left + region.right - boxWidth) / 2;
      top = region.bottom - boxHeight;
      if (!legend.overlay) region.bottom -= boxHeight + 4;
    }

    rows.forEach((row, r) => {
      const y = top + (r + 0.5) * lineHeight;
      let x = vertical ? left : left + (boxWidth - rowWidths[r]) / 2;
      for (const entry of row) {
        const w = swatch(entry);
        if (entry.kind === 'line') {
          if (entry.showLine) this.painter.drawPath(`M${x},${y} L${x + w},${y}`, null, entry.color, { width: 2 });
          if (entry.showMarker) this.marker(entry.marker, entry.markerIndex, entry.color, x + w / 2, y);
        } else {
          this.painter.drawPath(rectPath(x, y - w / 2, w, w), entry.color);
        }
        this.draw(entry.label, x + w + size * 0.3, y, 'left');
        x += entryWidth(entry) + size;
      }
    });
  }

  axesOf(group: ChartGroup) {
    const axes = group.axisIds.map((id) => this.spec.axes.get(id)).filter((a): a is Axis => !!a);
    return { category: axes.find((a) => a.kind !== 'val') ?? axes[0], value: axes.find((a) => a.kind === 'val' && a !== axes[0]) ?? axes.find((a) => a.kind === 'val') };
  }

  // Values a group plots for each series and category, stacked when the grouping says so
  plotted(group: ChartGroup) {
    const stacked = group.grouping === 'stacked' || group.grouping === 'percentStacked';
    const count = Math.max(0, ...group.series.map((s) => s.values.length));
    const totals = Array.from({ length: count }, (_, c) => group.series.reduce((sum, s) => sum + Math.abs(s.values[c] ?? 0), 0));
    const positive = new Array<number>(count).fill(0);
    const negative = new Array<number>(count).fill(0);
    return group.series.map((s) =>
      Array.from({ length: count }, (_, c) => {
        let v = s.values[c];
        if (v === null || v === undefined) return null;
        if (!stacked) return { from: 0, to: v, value: v };
        if (group.grouping === 'percentStacked') v = totals[c] ? v / totals[c] : 0;
        const below = v >= 0 ? positive : negative;
        const from = below[c];
        below[c] += v;
        return { from, to: below[c], value: s.values[c]! };
      })
    );
  }

  async valueLabels(axis: Axis | undefined, ticks: number[], formatCode: string) {
    if (!axis || axis.deleted || axis.tickLabels === 'none') return [];
    return Promise.all(ticks.map((t) => this.label(formatNumber(t, axis.formatCode ?? formatCode), axis.style)));
  }

  async drawAxisTitle(axis: Axis | undefined, x: number, y: number, vertical: boolean) {
    if (!axis?.title || axis.deleted) return;
    const label = await this.label(axis.title.text.replace(/\n/g, ' '), axis.title.style);
    this.draw(label, x, y, 'center', 'middle', vertical ? -90 : 0);
  }

  async drawCategoryChart(area: Rect, inner: boolean) {
    const groups = this.spec.groups.filter((g) => g.type === 'bar' || g.type === 'line' || g.type === 'area');
    if (!groups.length) return false;
    const horizontal = groups.some((g) => g.type === 'bar' && g.horizontal);
    const { category: catAxis, value: valAxis } = this.axesOf(groups[0]);
    const secondaryGroups = groups.filter((g) => this.axesOf(g).value !== valAxis);
    const primaryGroups = groups.filter((g) => !secondaryGroups.includes(g));
    const secondaryAxis = secondaryGroups.length ? this.axesOf(secondaryGroups[0]).value : undefined;

    const allSeries = groups.flatMap((g) => g.series);
    const categoryCount = Math.max(1, ...allSeries.map((s) => Math.max(s.values.length, s.categories.length)));
    const source = allSeries.find((s) => s.categories.some(Boolean));
    const categories = Array.from({ length: categoryCount }, (_, i) => source?.categories[i] ?? String(i + 1));

    const scaleFor = (axisGroups: ChartGroup[], axis: Axis | undefined) => {
      const values = axisGroups.flatMap((g) => this.plotted(g).flat().flatMap((p) => (p ? [p.from, p.to] : [])));
      const percent = axisGroups.some((g) => g.grouping === 'percentStacked');
      const includeZero = axisGroups.some((g) => g.type !== 'line');
      // Fewer steps on short axes, so labels don't crowd
      const length = horizontal ? area.right - area.left : area.bottom - area.top;
      return autoScale(Math.min(...values), Math.max(...values), axis, includeZero, percent, stepsFor(length, axis?.style.size ?? this.spec.base.size));
    };
    const scale = scaleFor(primaryGroups, valAxis);
    const scale2 = secondaryGroups.length ? scaleFor(secondaryGroups, secondaryAxis) : null;
    const percentFormat = (g: ChartGroup[]) => (g.some((x) => x.grouping === 'percentStacked') ? '0%' : g[0]?.series[0]?.formatCode ?? 'General');
    const valueLabels = await this.valueLabels(valAxis, scale.ticks, percentFormat(primaryGroups));
    const valueLabels2 = scale2 ? await this.valueLabels(secondaryAxis, scale2.ticks, percentFormat(secondaryGroups)) : [];
    const valueSize = valAxis?.style.size ?? this.spec.base.size;
    const catStyle = catAxis?.style ?? this.spec.base;
    const showCategories = !!catAxis && !catAxis.deleted && catAxis.tickLabels !== 'none';
    const titleSpace = (axis: Axis | undefined) => (axis?.title && !axis.deleted ? axis.title.style.size * 1.2 + 4 : 0);

    // The plot area inside the axis labels
    const plot = { ...area };
    let catLabels: Label[][] = [];
    let every = 1;
    const valueWidth = Math.max(0, ...valueLabels.map((l) => l.width));
    const valueWidth2 = Math.max(0, ...valueLabels2.map((l) => l.width));
    if (!inner) {
      plot.top += valueSize * 0.6;
      if (horizontal) {
        plot.bottom -= (valueLabels.length ? valueSize * 1.2 + TICK : 0) + titleSpace(valAxis);
        plot.left += titleSpace(catAxis);
        plot.right -= valueWidth / 2;
      } else {
        plot.left += (valueLabels.length ? valueWidth + TICK + 3 : 0) + titleSpace(valAxis);
        plot.right -= valueLabels2.length ? valueWidth2 + TICK + 3 + titleSpace(secondaryAxis) : 4;
      }
    }
    if (showCategories) {
      if (horizontal) {
        catLabels = await Promise.all(categories.map(async (c) => [await this.label(c, catStyle)]));
        if (!inner) plot.left += Math.max(...catLabels.map((l) => l[0].width)) + TICK + 3;
        const band = (plot.bottom - plot.top) / categoryCount;
        every = Math.max(1, Math.ceil((catStyle.size * 1.2) / band));
      } else {
        const band = (plot.right - plot.left) / categoryCount;
        const rotation = catAxis.rotation;
        if (rotation) {
          catLabels = await Promise.all(categories.map(async (c) => [await this.label(c, catStyle)]));
        } else {
          catLabels = await Promise.all(categories.map((c) => this.wrap(c, catStyle, band * 0.95, 3)));
          const widest = Math.max(...catLabels.flat().map((l) => l.width));
          every = Math.max(1, Math.ceil(widest / band));
        }
        const radians = Math.abs((rotation * Math.PI) / 180);
        const labelHeight = rotation
          ? Math.max(...catLabels.map((l) => l[0].width * Math.sin(radians) + catStyle.size * 1.2 * Math.cos(radians)))
          : Math.max(...catLabels.map((l) => l.length)) * catStyle.size * 1.2;
        if (!inner) plot.bottom -= labelHeight + TICK + 2 + titleSpace(catAxis);
      }
    } else if (!inner && !horizontal) plot.bottom -= titleSpace(catAxis);
    if (plot.right - plot.left < 4 || plot.bottom - plot.top < 4) return false;

    if (this.spec.plotFill) this.painter.drawPath(rectPath(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top), this.spec.plotFill);
    await this.drawPicture(this.spec.plotPicture, plot);
    if (this.spec.plotLine) this.stroke(rectPath(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top), this.spec.plotLine, AXIS_GRAY);

    // Axis geometry: u runs along the category axis, v along the value axis
    const catLength = horizontal ? plot.bottom - plot.top : plot.right - plot.left;
    const valLength = horizontal ? plot.right - plot.left : plot.bottom - plot.top;
    const midCat = (valAxis?.crossBetween ?? (groups.every((g) => g.type === 'area') ? 'midCat' : 'between')) === 'midCat';
    const band = catLength / (midCat ? Math.max(1, categoryCount - 1) : categoryCount);
    const catU = (c: number) => {
      const u = midCat ? (categoryCount > 1 ? c * band : catLength / 2) : (c + 0.5) * band;
      return catAxis?.reversed ? catLength - u : u;
    };
    const valueV = (s: typeof scale, axis: Axis | undefined) => (v: number) => {
      const t = (v - s.min) / (s.max - s.min || 1);
      return (axis?.reversed ? 1 - t : t) * valLength;
    };
    const vPrimary = valueV(scale, valAxis);
    const vSecondary = scale2 ? valueV(scale2, secondaryAxis) : vPrimary;
    const point = (u: number, v: number) => (horizontal ? { x: plot.left + v, y: plot.bottom - u } : { x: plot.left + u, y: plot.bottom - v });
    const line = (u1: number, v1: number, u2: number, v2: number) => {
      const a = point(u1, v1);
      const b = point(u2, v2);
      return `M${a.x},${a.y} L${b.x},${b.y}`;
    };

    // Gridlines
    if (valAxis && valAxis.majorGridlines !== false) {
      for (const t of scale.ticks) this.stroke(line(0, vPrimary(t), catLength, vPrimary(t)), valAxis.majorGridlines, AXIS_GRAY);
    }
    if (catAxis && catAxis.majorGridlines !== false) {
      for (let c = 0; c <= categoryCount; c++) {
        const u = midCat ? catU(Math.min(c, categoryCount - 1)) : c * band;
        if (!midCat || c < categoryCount) this.stroke(line(u, 0, u, valLength), catAxis.majorGridlines, AXIS_GRAY);
      }
    }

    // Data series: areas, then bars, then lines on top
    const ordered = [...groups.filter((g) => g.type === 'area'), ...groups.filter((g) => g.type === 'bar'), ...groups.filter((g) => g.type === 'line')];
    const labelJobs: (() => Promise<void>)[] = [];
    for (const group of ordered) {
      const v = secondaryGroups.includes(group) ? vSecondary : vPrimary;
      const s = secondaryGroups.includes(group) ? scale2! : scale;
      const base = v(Math.max(s.min, Math.min(s.max, 0)));
      const plotted = this.plotted(group);
      const stacked = group.grouping === 'stacked' || group.grouping === 'percentStacked';
      const clampV = (value: number) => v(Math.max(s.min, Math.min(s.max, value)));

      if (group.type === 'bar') {
        const n = stacked ? 1 : group.series.length;
        const overlap = Math.max(-1, Math.min(1, group.overlap / 100));
        const barWidth = band / (n - (n - 1) * overlap + group.gapWidth / 100);
        const step = barWidth * (1 - overlap);
        const groupWidth = barWidth + (n - 1) * step;
        group.series.forEach((series, si) => {
          plotted[si].forEach((p, c) => {
            if (!p) return;
            // Series run along the category axis direction (reversed axes flip them too)
            const offset = (stacked ? 0 : si * step) - groupWidth / 2;
            const u = catU(c) + (catAxis?.reversed ? -offset - barWidth : offset);
            const a = clampV(p.from);
            const b = clampV(p.to);
            const corner = point(u, Math.min(a, b));
            const far = point(u + barWidth, Math.max(a, b));
            const path = rectPath(Math.min(corner.x, far.x), Math.min(corner.y, far.y), Math.abs(far.x - corner.x), Math.abs(far.y - corner.y));
            const fill = series.pointFills.has(c) ? series.pointFills.get(c) : series.fill;
            const color = fill === undefined ? this.seriesColor(group, series, c) : fill;
            this.painter.drawPath(path, color, series.line?.color ?? null, { width: series.line?.width ?? 0.75 });
            const labels = series.labels;
            if (labels && !labels.deleted.has(c)) {
              labelJobs.push(async () => {
                const lines = await this.dataLabel(labels, series, c, p.value, 0);
                const lineHeight = labels.style.size * 1.2;
                const extent = horizontal ? Math.max(...lines.map((l) => l.width)) : lines.length * lineHeight;
                const position = labels.position ?? (stacked ? 'ctr' : 'outEnd');
                const sign = Math.sign(b - a) || 1;
                const vAt = position === 'inBase' ? a + (sign * extent) / 2 + sign * 3 : position === 'ctr' ? (a + b) / 2 : position === 'inEnd' ? b - (sign * extent) / 2 - sign * 3 : b + (sign * extent) / 2 + sign * 3;
                const at = point(u + barWidth / 2, vAt);
                this.drawLines(lines, at.x, at.y);
              });
            }
          });
        });
      } else {
        for (const si of group.series.keys()) {
          const series = group.series[si];
          const points = plotted[si].map((p, c) => (p ? { c, from: p.from, to: p.to, value: p.value } : null));
          const auto = this.seriesColor(group, series, 0);
          if (group.type === 'area') {
            const valid = points.filter((p): p is NonNullable<typeof p> => !!p);
            if (valid.length) {
              const top = valid.map((p) => point(catU(p.c), clampV(p.to)));
              const bottom = valid.map((p) => point(catU(p.c), stacked ? clampV(p.from) : base)).reverse();
              const path = `M${[...top, ...bottom].map((q) => `${q.x},${q.y}`).join(' L')} Z`;
              this.painter.drawPath(path, series.fill === undefined ? auto : series.fill, series.line?.color ?? null, { width: series.line?.width ?? 0.75 });
            }
          } else {
            const color = series.line?.color ?? auto;
            // Gaps in the data break the line
            const runs: { x: number; y: number }[][] = [[]];
            for (const p of points) {
              if (p) runs[runs.length - 1].push(point(catU(p.c), clampV(p.to)));
              else if (runs[runs.length - 1].length) runs.push([]);
            }
            if (series.line !== null) {
              const width = series.line?.width ?? 2.25;
              for (const run of runs.filter((r) => r.length > 1)) {
                this.painter.drawPath(series.smooth ? smoothPath(run) : `M${run.map((q) => `${q.x},${q.y}`).join(' L')}`, null, color, { width, dash: series.line?.dash?.map((d) => d * width) });
              }
            }
            if (group.showMarkers) {
              for (const p of points) {
                if (!p) continue;
                const at = point(catU(p.c), clampV(p.to));
                this.marker(series.marker, series.index, color, at.x, at.y);
              }
            }
          }
          const labels = series.labels;
          if (labels) {
            for (const p of points) {
              if (!p || labels.deleted.has(p.c)) continue;
              labelJobs.push(async () => {
                const lines = await this.dataLabel(labels, series, p.c, p.value, 0);
                const at = point(catU(p.c), clampV(group.type === 'area' && stacked ? (p.from + p.to) / 2 : p.to));
                this.drawPositioned(lines, at.x, at.y, labels.position ?? (group.type === 'area' ? 'ctr' : 'r'), series.marker?.size ?? 5);
              });
            }
          }
        }
      }
    }

    // Axis lines and tick marks
    const tickPath = (u: number, v: number, axisAlongU: boolean, mark: string) => {
      if (mark === 'none') return '';
      const outward = mark === 'in' ? 0 : TICK;
      const inward = mark === 'out' ? 0 : TICK;
      return axisAlongU ? line(u, v - outward, u, v + inward) : line(u - outward, v, u + inward, v);
    };
    if (catAxis && !catAxis.deleted) {
      const crossAt = valAxis?.crosses === 'max' ? scale.max : valAxis?.crosses === 'min' ? scale.min : Math.max(scale.min, Math.min(scale.max, 0));
      const v = vPrimary(crossAt);
      this.stroke(line(0, v, catLength, v), catAxis.line, AXIS_GRAY);
      const ticks: string[] = [];
      for (let c = 0; c <= categoryCount; c++) {
        if (midCat && c === categoryCount) break;
        ticks.push(tickPath(midCat ? catU(c) : c * band, v, true, catAxis.majorTickMark));
      }
      if (catAxis.line !== null) this.stroke(ticks.join(' '), catAxis.line, AXIS_GRAY);
    }
    for (const [axis, s, v, at] of [
      [valAxis, scale, vPrimary, 0],
      [secondaryAxis, scale2, vSecondary, catLength],
    ] as const) {
      if (!axis || !s || axis.deleted) continue;
      this.stroke(line(at, 0, at, valLength), axis.line, AXIS_GRAY);
      const mark = at ? ({ out: 'in', in: 'out' } as Record<string, string>)[axis.majorTickMark] ?? axis.majorTickMark : axis.majorTickMark;
      if (axis.line !== null) this.stroke(s.ticks.map((t) => tickPath(at, v(t), false, mark)).join(' '), axis.line, AXIS_GRAY);
    }

    // Axis labels and titles
    valueLabels.forEach((label, i) => {
      const at = point(0, vPrimary(scale.ticks[i]));
      if (horizontal) this.draw(label, at.x, plot.bottom + TICK + 2, 'center', 'top');
      else this.draw(label, at.x - TICK - 3, at.y, 'right');
    });
    valueLabels2.forEach((label, i) => {
      const at = point(catLength, vSecondary(scale2!.ticks[i]));
      this.draw(label, at.x + TICK + 3, at.y, 'left');
    });
    catLabels.forEach((lines, c) => {
      if (c % every) return;
      const at = point(catU(c), 0);
      if (horizontal) {
        this.draw(lines[0], plot.left - TICK - 3, at.y, 'right');
      } else if (catAxis.rotation) {
        // Rotated labels end at the tick
        this.draw(lines[0], at.x, plot.bottom + TICK + 2, catAxis.rotation < 0 ? 'right' : 'left', 'middle', catAxis.rotation);
      } else {
        lines.forEach((l, i) => this.draw(l, at.x, plot.bottom + TICK + 2 + i * catStyle.size * 1.2, 'center', 'top'));
      }
    });
    if (horizontal) {
      await this.drawAxisTitle(valAxis, (plot.left + plot.right) / 2, area.bottom - (valAxis?.title?.style.size ?? 0) * 0.6, false);
      await this.drawAxisTitle(catAxis, area.left + (catAxis?.title?.style.size ?? 0) * 0.6, (plot.top + plot.bottom) / 2, true);
    } else {
      await this.drawAxisTitle(valAxis, area.left + (valAxis?.title?.style.size ?? 0) * 0.6, (plot.top + plot.bottom) / 2, true);
      await this.drawAxisTitle(catAxis, (plot.left + plot.right) / 2, area.bottom - (catAxis?.title?.style.size ?? 0) * 0.6, false);
      await this.drawAxisTitle(secondaryAxis, area.right - (secondaryAxis?.title?.style.size ?? 0) * 0.6, (plot.top + plot.bottom) / 2, true);
    }
    for (const job of labelJobs) await job();
    return true;
  }

  // Data labels next to a point (line, scatter, radar charts)
  drawPositioned(lines: Label[], x: number, y: number, position: string, markerSize: number) {
    const width = Math.max(...lines.map((l) => l.width));
    const height = lines.length * (lines[0]?.style.size ?? 10) * 1.2;
    const gap = markerSize / 2 + 3;
    if (position === 'l') return this.drawLines(lines, x - gap - width / 2, y);
    if (position === 't') return this.drawLines(lines, x, y - gap - height / 2);
    if (position === 'b') return this.drawLines(lines, x, y + gap + height / 2);
    if (position === 'ctr') return this.drawLines(lines, x, y);
    return this.drawLines(lines, x + gap + width / 2, y);
  }

  async drawPie(area: Rect, inner: boolean) {
    const group = this.spec.groups.find((g) => g.type === 'pie' || g.type === 'doughnut')!;
    const rings = group.type === 'doughnut' ? group.series : group.series.slice(0, 1);
    if (!rings.length) return false;
    const labelsOutside = rings.some((s) => s.labels?.position === 'outEnd');
    const margin = inner ? 0 : 4 + (labelsOutside ? (rings[0].labels?.style.size ?? 10) * 2.5 : 0);
    const radius = Math.max(4, Math.min(area.right - area.left, area.bottom - area.top) / 2 - margin);
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const hole = group.type === 'doughnut' ? radius * Math.max(0.1, Math.min(0.9, group.holeSize / 100)) : 0;
    const ringWidth = (radius - hole) / rings.length;
    const labelJobs: (() => Promise<void>)[] = [];

    rings.forEach((series, ring) => {
      const outer = radius - ring * ringWidth;
      const innerRadius = outer - ringWidth;
      const values = series.values.map((v) => Math.max(0, v ?? 0));
      const total = values.reduce((a, b) => a + b, 0);
      if (!total) return;
      let angle = ((group.firstSliceAngle - 90) * Math.PI) / 180;
      values.forEach((v, i) => {
        const sweep = (v / total) * 2 * Math.PI;
        const start = angle;
        angle += sweep;
        if (sweep <= 0) return;
        const fill = series.pointFills.get(i);
        const color = fill === undefined ? (group.varyColors ? this.autoColor(i, values.length) : series.fill ?? this.autoColor(series.index, rings.length)) : fill;
        const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        const large = sweep > Math.PI ? 1 : 0;
        let path: string;
        if (sweep >= 2 * Math.PI - 1e-6) {
          path = ellipsePath(cx - outer, cy - outer, 2 * outer, 2 * outer);
          if (innerRadius > 0) path += ` ${ellipsePath(cx - innerRadius, cy - innerRadius, 2 * innerRadius, 2 * innerRadius)}`;
        } else if (innerRadius > 0) {
          path = `M${p(outer, start)} A${outer},${outer} 0 ${large},1 ${p(outer, angle)} L${p(innerRadius, angle)} A${innerRadius},${innerRadius} 0 ${large},0 ${p(innerRadius, start)} Z`;
        } else {
          path = `M${cx},${cy} L${p(outer, start)} A${outer},${outer} 0 ${large},1 ${p(outer, angle)} Z`;
        }
        const outline = series.line === null ? null : series.line?.color ?? WHITE;
        this.painter.drawPath(path, color, outline, { width: series.line?.width ?? 0.75 }, true);
        const labels = series.labels;
        if (labels && !labels.deleted.has(i)) {
          const mid = start + sweep / 2;
          labelJobs.push(async () => {
            const lines = await this.dataLabel(labels, series, i, series.values[i] ?? 0, total);
            const position = labels.position ?? 'bestFit';
            const lineHeight = labels.style.size * 1.2;
            if (position === 'outEnd') {
              const width = Math.max(...lines.map((l) => l.width));
              const r = outer + 6;
              const x = cx + r * Math.cos(mid);
              const y = cy + r * Math.sin(mid);
              const dx = Math.cos(mid) >= 0 ? width / 2 : -width / 2;
              this.drawLines(lines, x + dx, y + (Math.sin(mid) * lines.length * lineHeight) / 2);
            } else {
              const r = position === 'ctr' ? (outer + innerRadius) / 2 : position === 'inEnd' ? outer * 0.8 : innerRadius > 0 ? (outer + innerRadius) / 2 : outer * 0.65;
              this.drawLines(lines, cx + r * Math.cos(mid), cy + r * Math.sin(mid));
            }
          });
        }
      });
    });
    for (const job of labelJobs) await job();
    return true;
  }

  async drawXY(area: Rect, inner: boolean) {
    const groups = this.spec.groups.filter((g) => g.type === 'scatter' || g.type === 'bubble');
    const ids = groups[0].axisIds;
    const axes = ids.map((id) => this.spec.axes.get(id));
    const xAxis = axes.find((a) => a && (a.position === 'b' || a.position === 't')) ?? axes[0];
    const yAxis = axes.find((a) => a && a !== xAxis) ?? axes[1];
    const allSeries = groups.flatMap((g) => g.series);
    const xsOf = (s: Series) => (s.xValues.some((x) => x !== null) ? s.xValues : s.values.map((_, i) => i + 1));
    const xs = allSeries.flatMap((s) => xsOf(s).filter((x): x is number => x !== null));
    const ys = allSeries.flatMap((s) => s.values.filter((y): y is number => y !== null));
    if (!xs.length || !ys.length) return false;
    const xScale = autoScale(Math.min(...xs), Math.max(...xs), xAxis, false, false, stepsFor(area.right - area.left, xAxis?.style.size ?? this.spec.base.size));
    const yScale = autoScale(Math.min(...ys), Math.max(...ys), yAxis, false, false, stepsFor(area.bottom - area.top, yAxis?.style.size ?? this.spec.base.size));
    const xLabels = await this.valueLabels(xAxis, xScale.ticks, 'General');
    const yLabels = await this.valueLabels(yAxis, yScale.ticks, allSeries[0].formatCode);
    const ySize = yAxis?.style.size ?? this.spec.base.size;
    const xSize = xAxis?.style.size ?? this.spec.base.size;
    const plot = { ...area };
    if (!inner) {
      plot.top += ySize * 0.6;
      plot.left += (yLabels.length ? Math.max(...yLabels.map((l) => l.width)) + TICK + 3 : 0) + (yAxis?.title ? yAxis.title.style.size * 1.2 + 4 : 0);
      plot.bottom -= (xLabels.length ? xSize * 1.2 + TICK + 2 : 0) + (xAxis?.title ? xAxis.title.style.size * 1.2 + 4 : 0);
      plot.right -= Math.max(4, (xLabels[xLabels.length - 1]?.width ?? 0) / 2);
    }
    if (plot.right - plot.left < 4 || plot.bottom - plot.top < 4) return false;
    if (this.spec.plotFill) this.painter.drawPath(rectPath(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top), this.spec.plotFill);
    await this.drawPicture(this.spec.plotPicture, plot);
    const X = (v: number) => {
      const t = (v - xScale.min) / (xScale.max - xScale.min || 1);
      return plot.left + (xAxis?.reversed ? 1 - t : t) * (plot.right - plot.left);
    };
    const Y = (v: number) => {
      const t = (v - yScale.min) / (yScale.max - yScale.min || 1);
      return plot.bottom - (yAxis?.reversed ? 1 - t : t) * (plot.bottom - plot.top);
    };
    if (yAxis && yAxis.majorGridlines !== false) for (const t of yScale.ticks) this.stroke(`M${plot.left},${Y(t)} L${plot.right},${Y(t)}`, yAxis.majorGridlines, AXIS_GRAY);
    if (xAxis && xAxis.majorGridlines !== false) for (const t of xScale.ticks) this.stroke(`M${X(t)},${plot.top} L${X(t)},${plot.bottom}`, xAxis.majorGridlines, AXIS_GRAY);

    const labelJobs: (() => Promise<void>)[] = [];
    for (const group of groups) {
      const sizes = group.series.flatMap((s) => s.bubbleSizes.filter((b): b is number => b !== null && b > 0));
      const maxSize = Math.max(1e-9, ...sizes);
      const maxRadius = (Math.min(plot.right - plot.left, plot.bottom - plot.top) * 0.25 * (group.bubbleScale / 100)) / 2;
      for (const series of group.series) {
        const color = (group.type === 'bubble' ? series.fill : series.line?.color ?? series.marker?.fill) ?? this.seriesColor(group, series, 0);
        const seriesXs = xsOf(series);
        const points = series.values.map((y, i) => (y === null || seriesXs[i] === null ? null : { i, x: X(seriesXs[i]!), y: Y(y), value: y }));
        if (group.type === 'bubble') {
          for (const p of points) {
            const size = p && series.bubbleSizes[p.i];
            if (!p || !size || size <= 0) continue;
            const r = maxRadius * Math.sqrt(size / maxSize);
            const fill = series.pointFills.get(p.i) ?? (series.fill === undefined ? color : series.fill);
            this.painter.drawPath(ellipsePath(p.x - r, p.y - r, 2 * r, 2 * r), fill ?? null, series.line?.color ?? null, { width: series.line?.width ?? 0.75 });
          }
        } else {
          const valid = points.filter((p): p is NonNullable<typeof p> => !!p);
          if (series.line !== null && group.style !== 'marker' && valid.length > 1) {
            const smooth = series.smooth || group.style.startsWith('smooth');
            const width = series.line?.width ?? 2.25;
            this.painter.drawPath(smooth ? smoothPath(valid) : `M${valid.map((q) => `${q.x},${q.y}`).join(' L')}`, null, series.line?.color ?? color, { width, dash: series.line?.dash?.map((d) => d * width) });
          }
          if (group.style !== 'line' && group.style !== 'smooth') for (const p of valid) this.marker(series.marker, series.index, color, p.x, p.y);
        }
        const labels = series.labels;
        if (labels) {
          for (const p of points) {
            if (!p || labels.deleted.has(p.i)) continue;
            labelJobs.push(async () => this.drawPositioned(await this.dataLabel(labels, series, p.i, p.value, 0), p.x, p.y, labels.position ?? 'r', series.marker?.size ?? 5));
          }
        }
      }
    }

    const xCross = Y(Math.max(yScale.min, Math.min(yScale.max, 0)));
    const yCross = X(Math.max(xScale.min, Math.min(xScale.max, 0)));
    if (xAxis && !xAxis.deleted) this.stroke(`M${plot.left},${xCross} L${plot.right},${xCross}`, xAxis.line, AXIS_GRAY);
    if (yAxis && !yAxis.deleted) this.stroke(`M${yCross},${plot.top} L${yCross},${plot.bottom}`, yAxis.line, AXIS_GRAY);
    xLabels.forEach((label, i) => this.draw(label, X(xScale.ticks[i]), plot.bottom + TICK + 2, 'center', 'top'));
    yLabels.forEach((label, i) => this.draw(label, plot.left - TICK - 3, Y(yScale.ticks[i]), 'right'));
    await this.drawAxisTitle(yAxis, area.left + (yAxis?.title?.style.size ?? 0) * 0.6, (plot.top + plot.bottom) / 2, true);
    await this.drawAxisTitle(xAxis, (plot.left + plot.right) / 2, area.bottom - (xAxis?.title?.style.size ?? 0) * 0.6, false);
    for (const job of labelJobs) await job();
    return true;
  }

  async drawRadar(area: Rect) {
    const group = this.spec.groups.find((g) => g.type === 'radar')!;
    const { category: catAxis, value: valAxis } = this.axesOf(group);
    const count = Math.max(1, ...group.series.map((s) => s.values.length));
    const source = group.series.find((s) => s.categories.some(Boolean));
    const style = catAxis?.style ?? this.spec.base;
    const catLabels = await Promise.all(Array.from({ length: count }, (_, i) => this.label(source?.categories[i] ?? String(i + 1), style)));
    const widest = Math.max(...catLabels.map((l) => l.width));
    const radius = Math.max(4, Math.min((area.right - area.left) / 2 - widest - 6, (area.bottom - area.top) / 2 - style.size * 1.5));
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const values = group.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    const scale = autoScale(Math.min(...values), Math.max(...values), valAxis, true, false, stepsFor(radius, valAxis?.style.size ?? style.size));
    const angle = (i: number) => -Math.PI / 2 + (i / count) * 2 * Math.PI;
    const at = (i: number, v: number) => {
      const r = ((v - scale.min) / (scale.max - scale.min || 1)) * radius;
      return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) };
    };
    const ring = (v: number) => `M${Array.from({ length: count }, (_, i) => `${at(i, v).x},${at(i, v).y}`).join(' L')} Z`;
    if (valAxis?.majorGridlines !== false) for (const t of scale.ticks) this.stroke(ring(t), valAxis?.majorGridlines, AXIS_GRAY);
    for (let i = 0; i < count; i++) this.stroke(`M${cx},${cy} L${at(i, scale.max).x},${at(i, scale.max).y}`, catAxis?.line, AXIS_GRAY);
    for (const series of group.series) {
      const color = (group.style === 'filled' ? series.fill : series.line?.color) ?? this.seriesColor(group, series, 0);
      const points = series.values.map((v, i) => at(i, v ?? scale.min));
      const path = `M${points.map((p) => `${p.x},${p.y}`).join(' L')} Z`;
      if (group.style === 'filled') this.painter.drawPath(path, color);
      else if (series.line !== null) this.painter.drawPath(path, null, color, { width: series.line?.width ?? 2.25 });
      if (group.style === 'marker') points.forEach((p) => this.marker(series.marker, series.index, color, p.x, p.y));
    }
    catLabels.forEach((label, i) => {
      const a = angle(i);
      const r = radius + 6;
      const x = cx + r * Math.cos(a);
      const align: Align = Math.abs(Math.cos(a)) < 0.2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
      this.draw(label, x, cy + r * Math.sin(a) + Math.sin(a) * style.size * 0.5, align);
    });
    const valueLabels = await this.valueLabels(valAxis, scale.ticks, group.series[0]?.formatCode ?? 'General');
    valueLabels.forEach((label, i) => this.draw(label, cx - 3, at(0, scale.ticks[i]).y, 'right'));
    return true;
  }
}

// Excel-style automatic axis scale: includes zero when the data is close to it,
// adds a little headroom, and picks a round major unit giving at most maxSteps steps
export function autoScale(dataMin: number, dataMax: number, axis: Axis | undefined, includeZero: boolean, percent: boolean, maxSteps = 10) {
  let lo = Number.isFinite(dataMin) ? dataMin : 0;
  let hi = Number.isFinite(dataMax) ? dataMax : 1;
  if (lo >= 0 && (includeZero || lo < (hi * 5) / 6)) lo = 0;
  if (hi <= 0 && (includeZero || hi > (lo * 5) / 6)) hi = 0;
  if (percent) {
    lo = Math.max(lo, -1);
    hi = Math.min(Math.max(hi, 0), 1);
  }
  if (axis?.min !== undefined) lo = axis.min;
  if (axis?.max !== undefined) hi = axis.max;
  if (hi <= lo) hi = lo + (lo ? Math.abs(lo) : 1);
  const range = hi - lo;
  const top = axis?.max === undefined && !percent && hi > 0 ? hi + range * 0.05 : hi;
  const bottom = axis?.min === undefined && !percent && lo < 0 ? lo - range * 0.05 : lo;
  let unit = axis?.majorUnit;
  if (!unit || unit <= 0 || (top - bottom) / unit > 1000) {
    unit = 1;
    for (let exponent = Math.floor(Math.log10(top - bottom)) - 2; ; exponent++) {
      const found = [1, 2, 5].map((m) => m * 10 ** exponent).find((u) => (top - bottom) / u <= maxSteps);
      if (found) {
        unit = found;
        break;
      }
    }
  }
  const min = axis?.min ?? Math.floor(bottom / unit + 1e-9) * unit;
  const max = axis?.max ?? Math.ceil(top / unit - 1e-9) * unit;
  const ticks: number[] = [];
  for (let t = min; t <= max + unit * 1e-6 && ticks.length < 1000; t += unit) ticks.push(Number(t.toPrecision(12)));
  return { min, max, unit, ticks };
}

// How many axis steps fit along an axis, leaving room for a label at each
const stepsFor = (length: number, fontSize: number) => Math.max(2, Math.min(10, Math.floor(length / (fontSize * 2))));

// A smooth curve through points (Catmull-Rom splines as cubic Béziers)
function smoothPath(points: { x: number; y: number }[]) {
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    path += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return path;
}

export async function drawChart(ctx: DrawContext, chart: Chart): Promise<boolean> {
  const frame = takeFrame(ctx.charts, chart);
  if (!frame) return false;
  return new ChartDrawer(ctx, frame.spec).run(chart.width, chart.height);
}
