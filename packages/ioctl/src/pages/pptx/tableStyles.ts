// PowerPoint's 74 built-in table styles. Tables refer to their style by ID,
// and files often don't include the definitions of built-in styles (PowerPoint
// knows them), so they're generated here for pptxtojson.
//
// The style IDs are the ones Microsoft publishes for the built-in styles. Each
// family colors the parts of a table (header row, banded rows, ...) with the
// style's accent color, or with a text/background color for the style without one.

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

type Family = 'themed1' | 'themed2' | 'light1' | 'light2' | 'light3' | 'medium1' | 'medium2' | 'medium3' | 'medium4' | 'dark1' | 'dark2';
const FAMILY_NAMES: Record<Family, string> = {
  themed1: 'Themed Style 1', themed2: 'Themed Style 2', light1: 'Light Style 1', light2: 'Light Style 2', light3: 'Light Style 3',
  medium1: 'Medium Style 1', medium2: 'Medium Style 2', medium3: 'Medium Style 3', medium4: 'Medium Style 4', dark1: 'Dark Style 1', dark2: 'Dark Style 2',
};

// Style ID -> family and accent number (0 for the style without an accent)
const STYLE_IDS: Record<string, [Family, number]> = {};
const register = (family: Family, ids: string[], accents = [0, 1, 2, 3, 4, 5, 6]) =>
  ids.forEach((id, i) => (STYLE_IDS[`{${id}}`] = [family, accents[i]]));
register('themed1', ['2D5ABB26-0587-4C30-8999-92F81FD0307C', '3C2FFA5D-87B4-456A-9821-1D502468CF0F', '284E427A-3D55-4303-BF80-6455036E1DE7', '69C7853C-536D-4A76-A0AE-DD22124D55A5', '775DCB02-9BB8-47FD-8907-85C794F793BA', '35758FB7-9AC5-4552-8A53-C91805E547FA', '08FB837D-C827-4EFA-A057-4D05807E0F7C']);
register('themed2', ['5940675A-B579-460E-94D1-54222C63F5DA', 'D113A9D2-9D6B-4929-AA2D-F23B5EE8CBE7', '18603FDC-E32A-4AB5-989C-0864C3EAD2B8', '306799F8-075E-4A3A-A7F6-7FBC6576F1A4', 'E269D01E-BC32-4049-B463-5C60D7B0CCD2', '327F97BB-C833-4FB7-BDE5-3F7075034690', '638B1855-1B75-4FBE-930C-398BA8C253C6']);
register('light1', ['9D7B26C5-4107-4FEC-AEDC-1716B250A1EF', '3B4B98B0-60AC-42C2-AFA5-B58CD77FA1E5', '0E3FDE45-AF77-4B5C-9715-49D594BDF05E', 'C083E6E3-FA7D-4D7B-A595-EF9225AFEA82', 'D27102A9-8310-4765-A935-A1911B00CA55', '5FD0F851-EC5A-4D38-B0AD-8093EC10F338', '68D230F3-CF80-4859-8CE7-A43EE81993B5']);
register('light2', ['7E9639D4-E3E2-4D34-9284-5A2195B3D0D7', '69012ECD-51FC-41F1-AA8D-1B2483CD663E', '72833802-FEF1-4C79-8D5D-14CF1EAF98D9', 'F2DE63D5-997A-4646-A377-4702673A728D', '17292A2E-F333-43FB-9621-5CBBE7FDCDCB', '5A111915-BE36-4E01-A7E5-04B1672EAD32', '912C8C85-51F0-491E-9774-3900AFEF0FD7']);
register('light3', ['616DA210-FB5B-4158-B5E0-FEB733F419BA', 'BC89EF96-8CEA-46FF-86C4-4CE0E7609802', '5DA37D80-6434-44D0-A028-1B22A696006F', '8799B23B-EC83-4686-B30A-512413B5E67A', 'ED083AE6-46FA-4A59-8FB0-9F97EB10719F', 'BDBED569-4797-4DF1-A0F4-6AAB3CD982D8', 'E8B1032C-EA38-4F05-BA0D-38AFFFC7BED3']);
register('medium1', ['793D81CF-94F2-401A-BA57-92F5A7B2D0C5', 'B301B821-A1FF-4177-AEE7-76D212191A09', '9DCAF9ED-07DC-4A11-8D7F-57B35C25682E', '1FECB4D8-DB02-4DC6-A0A2-4F2EBAE1DC90', '1E171933-4619-4E11-9A3F-F7608DF75F80', 'FABFCF23-3B69-468F-B69F-88F6DE6A72F2', '10A1B5D5-9B99-4C35-A422-299274C87663']);
register('medium2', ['073A0DAA-6AF3-43AB-8588-CEC1D06C72B9', '5C22544A-7EE6-4342-B048-85BDC9FD1C3A', '21E4AEA4-8DFA-4A89-87EB-49C32662AFE0', 'F5AB1C69-6EDB-4FF4-983F-18BD219EF322', '00A15C55-8517-42AA-B614-E9B94910E393', '7DF18680-E054-41AD-8BC1-D1AEF772440D', '93296810-A885-4BE3-A3E7-6D5BEEA58F35']);
register('medium3', ['8EC20E35-A176-4012-BC5E-935CFFF8708E', '6E25E649-3F16-4E02-A733-19D2CDBF48F0', '85BE263C-DBD7-4A20-BB59-AAB30ACAA65A', 'EB344D84-9AFB-497E-A393-DC336BA19D2E', 'EB9631B5-78F2-41C9-869B-9F39066F8104', '74C1A8A3-306A-4EB7-A6B1-4F7E0EB9C5D6', '2A488322-F2BA-4B5B-9748-0D474271808F']);
register('medium4', ['D7AC3CCA-C797-4891-BE02-D94E43425B78', '69CF1AB2-1976-4502-BF36-3FF5EA218861', '8A107856-5554-42FB-B03E-39F5DBC370BA', '0505E3EF-67EA-436B-97B2-0124C06EBD24', 'C4B1156A-380E-4F78-BDF5-A606A8083BF9', '22838BEF-8BB2-4498-84A7-C5851F593DF1', '16D9F66E-5EB9-4882-86FB-DCBF35E3C3E4']);
register('dark1', ['E8034E78-7F5D-4C2E-B375-FC64B27BC917', '125E5076-3810-47DD-B79F-674D7AD40C01', '37CE84F3-28C3-443E-9E96-99CF82512B78', 'D03447BB-5D67-496B-8E87-E561075AD55C', 'E929F9F4-4A8F-4326-A1B4-22849713DDAB', '8FD4443E-F989-4FC4-A0C8-D5A2AF1F390B', 'AF606853-7671-496A-8E4F-DF71F8EC918B']);
// Dark Style 2 pairs accents: the header uses the next one
register('dark2', ['5202B0CA-FC54-4496-8BCA-5EF66A818D29', '0660B408-B3CF-4A94-85FC-2B1E0A45F4A2', '91EBBBCC-DAD2-459C-BE2E-F6DE35CF9A28', '46F890A9-2807-4EBB-B81D-B2AA78EC7F39'], [0, 1, 3, 5]);

// Colors are written like "X tint 20": a scheme color (X is the style's
// color), optionally with one modifier in percent. Borders can add "@width" in EMUs.
type Borders = Partial<Record<'left' | 'right' | 'top' | 'bottom' | 'insideH' | 'insideV', string>>;
interface Part {
  fill?: string;
  text?: string;
  bold?: boolean;
  borders?: Borders;
}
type Parts = Partial<Record<'wholeTbl' | 'band1H' | 'band1V' | 'band2V' | 'lastCol' | 'firstCol' | 'lastRow' | 'firstRow', Part>>;

const all = (color: string): Borders => ({ left: color, right: color, top: color, bottom: color, insideH: color, insideV: color });
const box = (color: string): Borders => ({ left: color, right: color, top: color, bottom: color });

function familyParts(family: Family, accent: number): Parts {
  const a = accent ? `accent${accent}` : '';
  switch (family) {
    case 'themed1':
      if (!a) return { wholeTbl: { text: 'tx1' } };
      return {
        wholeTbl: { text: 'dk1', borders: all(a) },
        band1H: { fill: `${a} alpha 40` },
        band1V: { fill: `${a} alpha 40` },
        firstRow: { fill: a, text: 'lt1', borders: { left: a, right: a, top: a, bottom: 'lt1' } },
        lastRow: { borders: box(a) },
        firstCol: { borders: { ...box(a), insideH: a } },
        lastCol: { borders: { ...box(a), insideH: a } },
      };
    case 'themed2':
      if (!a) return { wholeTbl: { borders: { ...box('tx1 tint 50'), insideH: 'tx1', insideV: 'tx1' } } };
      return {
        wholeTbl: { fill: a, text: 'lt1', borders: box(`${a} tint 50`) },
        band1H: { fill: 'lt1 alpha 20' },
        band1V: { fill: 'lt1 alpha 20' },
        firstRow: { text: 'lt1', borders: { bottom: 'lt1' } },
        lastRow: { borders: { top: 'lt1' } },
        firstCol: { borders: { right: 'lt1' } },
        lastCol: { borders: { left: 'lt1' } },
      };
    case 'light1': {
      const x = a || 'tx1';
      return {
        wholeTbl: { text: 'tx1', borders: { top: x, bottom: x } },
        band1H: { fill: `${x} alpha 20` },
        band1V: { fill: `${x} alpha 20` },
        firstRow: { text: 'tx1', borders: { bottom: x } },
        lastRow: { borders: { top: x } },
      };
    }
    case 'light2': {
      const x = a || 'tx1';
      return {
        wholeTbl: { text: 'tx1', borders: box(x) },
        band1H: { borders: { top: x, bottom: x } },
        band1V: { borders: { left: x, right: x } },
        band2V: { borders: { left: x, right: x } },
        firstRow: { fill: x, text: 'bg1' },
        lastRow: { borders: { top: x } },
      };
    }
    case 'light3': {
      const x = a || 'tx1';
      return {
        wholeTbl: { text: 'tx1', borders: all(x) },
        band1H: { fill: `${x} alpha 20` },
        band1V: { fill: `${x} alpha 20` },
        firstRow: { text: x, borders: { bottom: x } },
        lastRow: { borders: { top: x } },
      };
    }
    case 'medium1': {
      const x = a || 'dk1';
      return {
        wholeTbl: { text: 'dk1', fill: 'lt1', borders: { ...box(x), insideH: x } },
        band1H: { fill: `${x} tint 20` },
        band1V: { fill: `${x} tint 20` },
        firstRow: { fill: x, text: 'lt1' },
        lastRow: { fill: 'lt1', borders: { top: x } },
      };
    }
    case 'medium2': {
      const x = a || 'dk1';
      return {
        wholeTbl: { text: 'dk1', fill: `${x} tint 20`, borders: all('lt1') },
        band1H: { fill: `${x} tint 40` },
        band1V: { fill: `${x} tint 40` },
        lastCol: { fill: x, text: 'lt1' },
        firstCol: { fill: x, text: 'lt1' },
        lastRow: { fill: x, text: 'lt1', borders: { top: 'lt1@38100' } },
        firstRow: { fill: x, text: 'lt1', borders: { bottom: 'lt1@38100' } },
      };
    }
    case 'medium3': {
      const x = a || 'dk1';
      return {
        wholeTbl: { text: 'dk1', fill: 'lt1', borders: { top: 'dk1@25400', bottom: 'dk1@25400' } },
        band1H: { fill: 'dk1 tint 20' },
        band1V: { fill: 'dk1 tint 20' },
        lastCol: { fill: x, text: 'lt1' },
        firstCol: { fill: x, text: 'lt1' },
        lastRow: { fill: 'lt1', borders: { top: 'dk1' } },
        firstRow: { fill: x, text: 'lt1', borders: { bottom: 'dk1' } },
      };
    }
    case 'medium4': {
      const x = a || 'dk1';
      return {
        wholeTbl: { text: 'dk1', fill: `${x} tint 20`, borders: all(x) },
        band1H: { fill: `${x} tint 40` },
        band1V: { fill: `${x} tint 40` },
        lastRow: { fill: 'dk1 tint 20', borders: { top: 'dk1' } },
        firstRow: { fill: `${x} tint 20`, text: x },
      };
    }
    case 'dark1': {
      // Darker shades of the accent, or lighter tints of the text color without one
      const x = a ? (n: number) => `${a} shade ${n}` : (n: number) => `dk1 tint ${n}`;
      return {
        wholeTbl: { text: 'lt1', fill: x(20) },
        band1H: { fill: x(40) },
        band1V: { fill: x(40) },
        lastCol: { fill: x(60), borders: { left: 'lt1' } },
        firstCol: { fill: x(60), borders: { right: 'lt1' } },
        lastRow: { fill: a || 'dk1', borders: { top: 'lt1@38100' } },
        firstRow: { fill: 'dk1', text: 'lt1', borders: { bottom: 'lt1@38100' } },
      };
    }
    case 'dark2': {
      const x = a || 'dk1';
      return {
        wholeTbl: { text: 'dk1', fill: `${x} tint 20` },
        band1H: { fill: `${x} tint 40` },
        band1V: { fill: `${x} tint 40` },
        lastRow: { fill: `${x} tint 20`, borders: { top: 'dk1@38100' } },
        firstRow: { fill: accent ? `accent${accent + 1}` : 'dk1', text: 'lt1' },
      };
    }
  }
}

function colorXml(spec: string) {
  const [color, modifier, percent] = spec.split('@')[0].split(' ');
  return `<a:schemeClr val="${color}">${modifier ? `<a:${modifier} val="${Number(percent) * 1000}"/>` : ''}</a:schemeClr>`;
}

function partXml(name: string, part: Part) {
  // Header and total rows and columns are bold in every built-in style
  const bold = ['firstRow', 'lastRow', 'firstCol', 'lastCol'].includes(name);
  const text = part.text || bold ? `<a:tcTxStyle${bold ? ' b="on"' : ''}>${part.text ? colorXml(part.text) : ''}</a:tcTxStyle>` : '';
  const borders = Object.entries(part.borders ?? {})
    .map(([side, spec]) => `<a:${side}><a:ln w="${spec.split('@')[1] ?? 12700}" cmpd="sng"><a:solidFill>${colorXml(spec)}</a:solidFill></a:ln></a:${side}>`)
    .join('');
  const fill = part.fill ? `<a:fill><a:solidFill>${colorXml(part.fill)}</a:solidFill></a:fill>` : '';
  return `<a:${name}>${text}<a:tcStyle><a:tcBdr>${borders}</a:tcBdr>${fill}</a:tcStyle></a:${name}>`;
}

// The definition of a built-in table style, or null if the ID isn't one
export function builtInTableStyle(styleId: string) {
  const entry = STYLE_IDS[styleId.toUpperCase()];
  if (!entry) return null;
  const [family, accent] = entry;
  const parts = familyParts(family, accent);
  const order = ['wholeTbl', 'band1H', 'band1V', 'band2V', 'lastCol', 'firstCol', 'lastRow', 'firstRow'] as const;
  const name = `${FAMILY_NAMES[family]}${accent ? ` - Accent ${accent}` : ''}`;
  return `<a:tblStyle xmlns:a="${A}" styleId="${styleId}" styleName="${name}">${order
    .filter((p) => parts[p])
    .map((p) => partXml(p, parts[p]!))
    .join('')}</a:tblStyle>`;
}
