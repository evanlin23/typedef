import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFHexString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { familyFor, kernedText, type Face } from './fonts';

describe('familyFor', () => {
  it('picks a stand-in with the same character widths', () => {
    expect(familyFor('Calibri')).toBe('carlito');
    expect(familyFor('Consolas')).toBe('inconsolata');
    expect(familyFor('Courier New')).toBe('mono');
    expect(familyFor('Times New Roman')).toBe('serif');
    expect(familyFor('Segoe UI')).toBe('sans');
  });
});

describe('kernedText', () => {
  it('moves kerned pairs closer, as TJ adjustments', async () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fonts/LiberationSans-Regular.ttf')));
    const face: Face = { key: 'sans', family: 'sans', bold: false, italic: false, bytes, font: fontkit.create(bytes) as Face['font'] };
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(bytes, { subset: true });
    // "AV" is a kerned pair; positive TJ numbers move the next character left
    const items = kernedText(face, font, 'AV');
    expect(items).toHaveLength(3);
    expect(items[0]).toBeInstanceOf(PDFHexString);
    expect(items[1]).toBeGreaterThan(0);
    // Text without kerned pairs stays in one piece
    expect(kernedText(face, font, 'mm')).toHaveLength(1);
  });
});
