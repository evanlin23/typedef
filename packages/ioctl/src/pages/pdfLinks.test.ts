import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFString, type PDFPage } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { detachInternalLinks, reattachInternalLinks, writeLinks } from './pdfLinks';

const links = (page: PDFPage) => {
  const annots = page.node.Annots();
  return Array.from({ length: annots?.size() ?? 0 }, (_, i) => annots!.lookup(i, PDFDict));
};
const destPage = (annot: PDFDict) => (annot.lookup(PDFName.of('Dest'), PDFArray).get(0) as PDFRef).toString();

async function threePages() {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([100, 100]);
  return doc;
}

describe('writeLinks', () => {
  it('adds web links and links to pages', async () => {
    const doc = await threePages();
    writeLinks(doc, [[{ rect: [0, 0, 10, 10], target: { page: 2 } }], [{ rect: [0, 0, 10, 10], target: { uri: 'https://example.com/' } }], []]);
    const [first, second] = doc.getPages();
    expect(destPage(links(first)[0])).toBe(doc.getPage(2).ref.toString());
    const action = links(second)[0].lookup(PDFName.of('A'), PDFDict);
    expect(action.lookup(PDFName.of('URI'), PDFString).decodeText()).toBe('https://example.com/');
  });
});

describe('detachInternalLinks and reattachInternalLinks', () => {
  it('keeps links between pages working when the pages are copied', async () => {
    const source = await threePages();
    writeLinks(source, [[{ rect: [0, 0, 10, 10], target: { page: 2 } }], [], []]);
    // A named destination for the second page, linked from the third
    const dests = source.context.obj({ Names: [PDFString.of('second'), [source.getPage(1).ref, 'Fit']] });
    source.catalog.set(PDFName.of('Names'), source.context.obj({ Dests: dests }));
    source.getPage(2).node.addAnnot(source.context.register(source.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], Dest: PDFString.of('second') })));

    const target = await PDFDocument.create();
    target.addPage([50, 50]);
    detachInternalLinks(source);
    const copied = await target.copyPages(source, [0, 1, 2]);
    for (const page of copied) target.addPage(page);
    reattachInternalLinks(copied);

    expect(target.getPageCount()).toBe(4);
    expect(destPage(links(copied[0])[0])).toBe(copied[2].ref.toString());
    expect(destPage(links(copied[2])[0])).toBe(copied[1].ref.toString());
    expect(links(copied[0])[0].has(PDFName.of('IoctlTargetPage'))).toBe(false);
  });
});
