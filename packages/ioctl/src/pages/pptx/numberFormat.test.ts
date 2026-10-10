import { describe, expect, it } from 'vitest';
import { formatGeneral, formatNumber } from './numberFormat';

describe('formatGeneral', () => {
  it('shows up to 10 significant digits without float noise', () => {
    expect(formatGeneral(0.1 + 0.2)).toBe('0.3');
    expect(formatGeneral(1234.5)).toBe('1234.5');
    expect(formatGeneral(-7)).toBe('-7');
  });

  it('switches to scientific notation for very large and small values', () => {
    expect(formatGeneral(1.5e12)).toBe('1.5E+12');
    expect(formatGeneral(2e-10)).toBe('2E-10');
  });
});

describe('formatNumber', () => {
  it.each([
    [3.14159, '0.0', '3.1'],
    [3.14159, '0.00', '3.14'],
    [1234567.8, '#,##0', '1,234,568'],
    [0.256, '0%', '26%'],
    [0.256, '0.00%', '25.60%'],
    [1234.5, '"$"#,##0.00', '$1,234.50'],
    [12345, '0.00E+00', '1.23E+04'],
    [42, '0"%"', '42%'],
    [12345, '#,##0,"K"', '12K'],
    [0.5, '#.##', '.5'],
    [7, '000', '007'],
    [1234.5, '[$€-407]#,##0.00', '€1,234.50'],
  ])('formats %s with %s as %s', (value, format, expected) => {
    expect(formatNumber(value, format)).toBe(expected);
  });

  it('uses the negative and zero sections', () => {
    expect(formatNumber(-5, '0;(0)')).toBe('(5)');
    expect(formatNumber(-5, '0.0')).toBe('-5.0');
    expect(formatNumber(0, '0;-0;"zero"')).toBe('zero');
  });

  it('formats serial dates and times', () => {
    // 45000 is 2023-03-15
    expect(formatNumber(45000, 'm/d/yyyy')).toBe('3/15/2023');
    expect(formatNumber(45000, 'yyyy-mm-dd')).toBe('2023-03-15');
    expect(formatNumber(45000, 'mmm-yy')).toBe('Mar-23');
    expect(formatNumber(45000, 'dddd, mmmm d')).toBe('Wednesday, March 15');
    expect(formatNumber(45000.75, 'h:mm AM/PM')).toBe('6:00 PM');
    expect(formatNumber(45000.5, 'hh:mm:ss')).toBe('12:00:00');
  });
});
