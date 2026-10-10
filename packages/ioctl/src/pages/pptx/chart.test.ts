import { describe, expect, it } from 'vitest';
import { autoScale } from './chart';
import { parseChart } from './chartXml';
import { DEFAULT_THEME } from './drawingColor';

describe('autoScale', () => {
  it('picks round axis ranges like Excel', () => {
    expect(autoScale(0, 28.6, undefined, true, false)).toMatchObject({ min: 0, max: 35, unit: 5 });
    expect(autoScale(0, 66.2, undefined, true, false)).toMatchObject({ min: 0, max: 70, unit: 10 });
    expect(autoScale(0, 12.2, undefined, false, false)).toMatchObject({ min: 0, max: 14, unit: 2 });
  });

  it('starts line charts at zero only when the data is near it', () => {
    expect(autoScale(9.4, 28.6, undefined, false, false).min).toBe(0);
    expect(autoScale(95, 100, undefined, false, false).min).toBeGreaterThan(0);
  });

  it('covers negative values', () => {
    expect(autoScale(-12, 30, undefined, true, false)).toMatchObject({ min: -15, max: 35 });
  });

  it('runs percent stacked axes from 0 to 100%', () => {
    const scale = autoScale(0, 1, undefined, true, true);
    expect(scale).toMatchObject({ min: 0, max: 1, unit: 0.1 });
    expect(scale.ticks).toHaveLength(11);
  });

  it('uses fewer steps on short axes', () => {
    expect(autoScale(0, 9, undefined, true, false, 3)).toMatchObject({ max: 10, unit: 5 });
  });
});

const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const chartXml = (body: string, chart = '') =>
  new DOMParser().parseFromString(
    `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}"><c:chart>${chart}<c:plotArea>${body}</c:plotArea><c:legend><c:legendPos val="b"/></c:legend></c:chart>` +
      `<c:txPr><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1400"/></a:pPr></a:p></c:txPr></c:chartSpace>`,
    'application/xml'
  );
const series = (name: string, values: number[]) =>
  `<c:ser><c:idx val="0"/><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>${name}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
  `<c:cat><c:strRef><c:strCache><c:ptCount val="${values.length}"/>${values.map((_, i) => `<c:pt idx="${i}"><c:v>Q${i + 1}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>` +
  `<c:val><c:numRef><c:numCache><c:formatCode>0.0</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val></c:ser>`;

describe('parseChart', () => {
  it('reads series, categories, text size and legend', () => {
    const spec = parseChart(chartXml(`<c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>${series('Sales', [1, 2.5, 3])}</c:barChart>`), DEFAULT_THEME, 'Calibri')!;
    expect(spec.groups).toHaveLength(1);
    const [group] = spec.groups;
    expect(group).toMatchObject({ type: 'bar', horizontal: false, grouping: 'stacked', overlap: 100 });
    expect(group.series[0]).toMatchObject({ name: 'Sales', categories: ['Q1', 'Q2', 'Q3'], values: [1, 2.5, 3], formatCode: '0.0' });
    expect(spec.base.size).toBe(14);
    expect(spec.legend?.position).toBe('b');
  });

  it('titles single-series charts only when the automatic title is kept', () => {
    const pie = `<c:pieChart>${series('Spend', [1, 2])}</c:pieChart>`;
    expect(parseChart(chartXml(pie), DEFAULT_THEME, 'Calibri')!.title).toBeNull();
    expect(parseChart(chartXml(pie, '<c:autoTitleDeleted val="0"/>'), DEFAULT_THEME, 'Calibri')!.title?.text).toBe('Spend');
    const titled = '<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>My chart</a:t></a:r></a:p></c:rich></c:tx></c:title>';
    expect(parseChart(chartXml(pie, titled), DEFAULT_THEME, 'Calibri')!.title?.text).toBe('My chart');
  });

  it('returns null for charts without data', () => {
    expect(parseChart(chartXml('<c:barChart/>'), DEFAULT_THEME, 'Calibri')).toBeNull();
  });
});
