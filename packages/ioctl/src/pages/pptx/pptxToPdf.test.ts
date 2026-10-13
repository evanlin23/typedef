import { beforeEach, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { pptxToPdf } from './pptxToPdf';

const convert = vi.hoisted(() => vi.fn());
vi.mock('./officeEngine', () => ({ officeEngine: { convert } }));
beforeEach(() => convert.mockReset());
const file = (bytes: Uint8Array) => ({ name: 'slides.pptx', arrayBuffer: async () => bytes.slice().buffer }) as File;

it('rejects a renamed text file before downloading or starting LibreOffice', async () => {
  await expect(pptxToPdf(file(new Uint8Array([1, 2, 3])))).rejects.toThrow('not a readable PPTX');
  expect(convert).not.toHaveBeenCalled();
});

it('rejects a Word package with a PPTX extension', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<document/>');
  await expect(pptxToPdf(file(await zip.generateAsync({ type: 'uint8array' })))).rejects.toThrow('not a readable PPTX');
  expect(convert).not.toHaveBeenCalled();
});

it('accepts namespace-prefixed content types and passes original bytes to the engine', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<ct:Types xmlns:ct="http://schemas.openxmlformats.org/package/2006/content-types"><ct:Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></ct:Types>');
  zip.file('ppt/presentation.xml', '<presentation/>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  convert.mockResolvedValue(new TextEncoder().encode('%PDF-valid'));
  await pptxToPdf(file(bytes));
  expect(Array.from(convert.mock.calls[0][0])).toEqual(Array.from(bytes));
});

it('passes selected local fonts to LibreOffice along with the validated presentation', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zip.file('ppt/presentation.xml', '<presentation/>');
  const bytes = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const fontFile = { name: 'local.ttf', size: bytes.length, arrayBuffer: async () => bytes.buffer } as File;
  convert.mockResolvedValue(new TextEncoder().encode('%PDF-valid'));
  await pptxToPdf(file(await zip.generateAsync({ type: 'uint8array' })), undefined, [fontFile]);
  expect(convert.mock.calls[0][2][0].filename).toBe('presentation-0.ttf');
  expect(Array.from(convert.mock.calls[0][2][0].data)).toEqual(Array.from(bytes));
});
