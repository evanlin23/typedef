import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { Painter } from './painter';

describe('Painter', () => {
  it('writes slides with more operators than a call can take as arguments', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([100, 100]);
    const painter = new Painter(page, doc);
    // A busy slide (like a detailed vector figure) can have hundreds of thousands
    for (let i = 0; i < 150000; i++) {
      painter.save();
      painter.restore();
    }
    expect(() => painter.finish()).not.toThrow();
    const bytes = await doc.save();
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('places links through the current transformation', async () => {
    const doc = await PDFDocument.create();
    const painter = new Painter(doc.addPage([200, 100]), doc);
    // Drawing coordinates have y going down from the top of the page
    painter.transform(1, 0, 0, 1, 10, 20);
    painter.addLink(0, 0, 30, 10, 'https://example.com/');
    expect(painter.links).toEqual([{ rect: [10, 70, 40, 80], target: 'https://example.com/' }]);
  });
});
