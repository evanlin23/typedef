// Formats numbers with Excel number format codes ("0.0%", "#,##0", "m/d/yyyy",
// ...), as used by chart labels. Covers the common subset: digit placeholders,
// thousands separators and scaling, percentages, scientific notation, literal
// text, and dates.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Splits a format code into sections at semicolons outside quotes
function sections(code: string) {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '"') quoted = !quoted;
    if (c === '\\' && !quoted) {
      current += c + (code[++i] ?? '');
      continue;
    }
    if (c === ';' && !quoted) {
      parts.push(current);
      current = '';
    } else current += c;
  }
  parts.push(current);
  return parts;
}

// Excel's General format: up to 10 significant digits
export function formatGeneral(value: number) {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e11 || abs < 1e-9) {
    const [mantissa, exponent] = value.toExponential(5).split('e');
    const exp = Number(exponent);
    return `${String(Number(mantissa))}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  return String(Number(value.toPrecision(10)));
}

// Turns a section into tokens: literal text, or the format characters themselves
function tokenize(section: string) {
  const tokens: { literal: boolean; text: string }[] = [];
  for (let i = 0; i < section.length; i++) {
    const c = section[i];
    if (c === '"') {
      const end = section.indexOf('"', i + 1);
      const stop = end === -1 ? section.length : end;
      tokens.push({ literal: true, text: section.slice(i + 1, stop) });
      i = stop;
    } else if (c === '\\') {
      tokens.push({ literal: true, text: section[++i] ?? '' });
    } else if (c === '_') {
      // Space as wide as the next character
      tokens.push({ literal: true, text: ' ' });
      i++;
    } else if (c === '*') {
      // Repeat-to-fill isn't meaningful in a label
      i++;
    } else if (c === '[') {
      const end = section.indexOf(']', i);
      const inner = section.slice(i + 1, end === -1 ? section.length : end);
      // [$€-407] is a currency symbol; [Red] and [>=100] are colors and conditions
      const currency = inner.match(/^\$([^-]*)/);
      if (currency) tokens.push({ literal: true, text: currency[1] });
      i = end === -1 ? section.length : end;
    } else {
      tokens.push({ literal: false, text: c });
    }
  }
  return tokens;
}

const isDateFormat = (tokens: { literal: boolean; text: string }[]) =>
  tokens.some((t) => !t.literal && /[ymdhs]/i.test(t.text)) && !tokens.some((t) => !t.literal && /[0#?]/.test(t.text));

const DATE_CODE = /AM\/PM|A\/P|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|./gi;

function formatDate(serial: number, tokens: { literal: boolean; text: string }[]) {
  // Serial dates count days from 1899-12-30 (Excel's 1900 date system)
  const date = new Date(Math.round((serial - 25569) * 86400000));
  // Split the format characters into date codes, keeping literal text as is
  const parts: { literal: boolean; text: string }[] = [];
  let code = '';
  const flush = () => {
    for (const match of code.matchAll(DATE_CODE)) parts.push({ literal: false, text: match[0] });
    code = '';
  };
  for (const token of tokens) {
    if (token.literal) {
      flush();
      parts.push(token);
    } else code += token.text;
  }
  flush();

  const codes = parts.map((p) => (p.literal ? '' : p.text.toLowerCase()));
  const hasAmPm = codes.some((c) => c === 'am/pm' || c === 'a/p');
  const hours = date.getUTCHours();
  return parts
    .map((part, i) => {
      if (part.literal) return part.text;
      const lower = codes[i];
      const two = (n: number) => String(n).padStart(2, '0');
      switch (lower) {
        case 'yyyy':
          return String(date.getUTCFullYear());
        case 'yy':
          return two(date.getUTCFullYear() % 100);
        case 'mmmmm':
          return MONTHS[date.getUTCMonth()][0];
        case 'mmmm':
          return MONTHS[date.getUTCMonth()];
        case 'mmm':
          return MONTHS[date.getUTCMonth()].slice(0, 3);
        case 'mm':
        case 'm': {
          // "m" right after hours or before seconds means minutes
          const previous = codes.slice(0, i).reverse().find((c) => /^[a-z]/.test(c));
          const next = codes.slice(i + 1).find((c) => /^[a-z]/.test(c));
          const n = previous?.startsWith('h') || next?.startsWith('s') ? date.getUTCMinutes() : date.getUTCMonth() + 1;
          return lower === 'mm' ? two(n) : String(n);
        }
        case 'dddd':
          return DAYS[date.getUTCDay()];
        case 'ddd':
          return DAYS[date.getUTCDay()].slice(0, 3);
        case 'dd':
          return two(date.getUTCDate());
        case 'd':
          return String(date.getUTCDate());
        case 'hh':
        case 'h': {
          const h = hasAmPm ? hours % 12 || 12 : hours;
          return lower === 'hh' ? two(h) : String(h);
        }
        case 'ss':
          return two(date.getUTCSeconds());
        case 's':
          return String(date.getUTCSeconds());
        case 'am/pm':
          return hours < 12 ? 'AM' : 'PM';
        case 'a/p':
          return hours < 12 ? 'A' : 'P';
        default:
          return part.text;
      }
    })
    .join('');
}

function formatNumberSection(value: number, tokens: { literal: boolean; text: string }[]) {
  const code = tokens.filter((t) => !t.literal).map((t) => t.text).join('');
  if (/general/i.test(code)) {
    return tokens.map((t) => (t.literal ? t.text : '')).join('') + formatGeneral(value);
  }
  const percents = (code.match(/%/g) ?? []).length;
  value *= 100 ** percents;

  // The numeric part runs from the first to the last digit placeholder
  const chars = tokens.flatMap((t) => (t.literal ? [{ literal: true, text: t.text }] : [...t.text].map((c) => ({ literal: false, text: c }))));
  const isDigit = (c: { literal: boolean; text: string }) => !c.literal && /[0#?]/.test(c.text);
  const first = chars.findIndex(isDigit);
  if (first === -1) return tokens.map((t) => t.text).join('');
  let last = chars.length - 1;
  while (!isDigit(chars[last])) last--;
  // Allow "." and "E+00" inside the numeric part
  let end = last + 1;
  // Trailing commas scale by 1000 each
  let scale = 0;
  while (end < chars.length && !chars[end].literal && chars[end].text === ',') {
    scale++;
    end++;
  }
  value /= 1000 ** scale;
  const numeric = chars.slice(first, last + 1).filter((c) => !c.literal).map((c) => c.text).join('');
  const [mantissaCode, exponentCode] = numeric.split(/[eE][+-]/);
  const [intCode, fracCode = ''] = mantissaCode.split('.');
  const decimals = (fracCode.match(/[0#?]/g) ?? []).length;
  const minDecimals = (fracCode.match(/0/g) ?? []).length;
  const minInt = (intCode.match(/0/g) ?? []).length;
  const grouping = /[0#?],[0#?]/.test(intCode);

  let body: string;
  if (exponentCode !== undefined) {
    let exp = value === 0 ? 0 : Math.floor(Math.log10(Math.abs(value)));
    let mantissa = Math.abs(value) / 10 ** exp;
    if (Number(mantissa.toFixed(decimals)) >= 10) {
      mantissa /= 10;
      exp++;
    }
    const sign = /E\+/i.test(numeric) || exp < 0 ? (exp < 0 ? '-' : '+') : '';
    body = `${trimDecimals(mantissa.toFixed(decimals), minDecimals)}E${sign}${String(Math.abs(exp)).padStart((exponentCode.match(/0/g) ?? []).length, '0')}`;
  } else {
    const fixed = trimDecimals(Math.abs(value).toFixed(decimals), minDecimals);
    const [whole, frac] = fixed.split('.');
    let int = whole === '0' && minInt === 0 ? '' : whole;
    int = int.padStart(minInt, '0');
    if (grouping) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    body = frac ? `${int}.${frac}` : int;
  }

  const before = chars.slice(0, first).map((c) => (c.literal || c.text !== ',' ? c.text : '')).join('');
  const after = chars.slice(end).map((c) => c.text).join('');
  return `${before}${body}${after}`;
}

function trimDecimals(text: string, minDecimals: number) {
  if (!text.includes('.')) return text;
  const [int, digits] = text.split('.');
  let frac = digits;
  while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.slice(0, -1);
  return frac ? `${int}.${frac}` : int;
}

export function formatNumber(value: number, formatCode = 'General') {
  if (!Number.isFinite(value)) return '';
  const parts = sections(formatCode || 'General');
  let section = parts[0];
  let negative = value < 0;
  if (value < 0 && parts.length > 1) {
    // The negative section shows the magnitude; it has its own sign if any
    section = parts[1];
    negative = false;
  } else if (value === 0 && parts.length > 2) {
    section = parts[2];
  }
  const tokens = tokenize(section);
  if (isDateFormat(tokens)) return formatDate(value, tokens);
  const text = formatNumberSection(Math.abs(value), tokens);
  return negative && /[1-9]/.test(text) ? `-${text}` : text;
}
