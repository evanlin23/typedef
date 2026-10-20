import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib';
import { combineDocuments } from './combineDocuments';
import { writeLinks } from './pdfLinks';

const file = (name: string, bytes: Uint8Array) => ({
  name, type: name.endsWith('.pdf') ? 'application/pdf' : '',
  arrayBuffer: async () => bytes.slice().buffer,
}) as File;

async function pdf(size: [number, number], pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage(size);
  return doc;
}

describe('combineDocuments', () => {
  it('keeps input order, original page sizes, and internal links across file boundaries', async () => {
    const first = await pdf([100, 200]);
    const second = await pdf([720, 405], 2);
    writeLinks(second, [[{ rect: [1, 2, 3, 4], target: { page: 1 } }], []]);
    const result = await PDFDocument.load(await combineDocuments([
      file('first.pdf', await first.save()), file('second.pdf', await second.save()),
    ]));
    expect(result.getPages().map((p) => p.getSize())).toEqual([
      { width: 100, height: 200 }, { width: 720, height: 405 }, { width: 720, height: 405 },
    ]);
    const annotation = result.getPage(1).node.Annots()!.lookup(0, PDFDict);
    const destination = annotation.lookup(PDFName.of('Dest'), PDFArray);
    expect(destination.get(0)).toEqual(result.getPage(2).ref);
  });

  it('scales widths only when explicitly requested', async () => {
    const bytes = await combineDocuments([
      file('small.pdf', await (await pdf([100, 200])).save()),
      file('wide.pdf', await (await pdf([200, 100])).save()),
    ], { normalizeWidths: true });
    const result = await PDFDocument.load(bytes);
    expect(result.getPages().map((p) => p.getSize())).toEqual([
      { width: 200, height: 400 }, { width: 200, height: 100 },
    ]);
  });

  it('rejects presentations even when their MIME type claims to be PDF', async () => {
    const presentation = file('slides.pptx', new Uint8Array([1]));
    presentation.arrayBuffer = () => { throw new Error('Must not read a presentation'); };
    Object.defineProperty(presentation, 'type', { value: 'application/pdf' });
    await expect(combineDocuments([
      presentation, file('notes.pdf', await (await pdf([612, 792])).save()),
    ])).rejects.toThrow('Export PowerPoint presentations as PDF');
  });

  it('fails the whole merge and identifies a damaged source file', async () => {
    await expect(combineDocuments([
      file('valid.pdf', await (await pdf([100, 200])).save()),
      file('damaged.pdf', new Uint8Array([1, 2, 3])),
    ])).rejects.toThrow('Could not process "damaged.pdf"');
  });
});
