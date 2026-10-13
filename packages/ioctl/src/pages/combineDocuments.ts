import { PDFDocument } from 'pdf-lib';
import { detachInternalLinks, reattachInternalLinks } from './pdfLinks';
import { normalizePageWidths } from './pdfPageSizes';
import { isPptx } from './pptx/fileTypes';
import type { ConversionOptions } from './pptx/conversionBackend';

interface CombineOptions extends ConversionOptions {
  normalizeWidths?: boolean;
  onProgress?: (message: string) => void;
}

export async function combineDocuments(files: File[], { normalizeWidths = false, onProgress, backend, signal }: CombineOptions = {}) {
  if (files.length < 2) throw new Error('Please upload at least two files to combine.');
  const merged = await PDFDocument.create();
  for (const file of files) {
    signal?.throwIfAborted();
    try {
      let bytes: ArrayBuffer | Uint8Array;
      if (isPptx(file)) {
        const { pptxToPdf } = await import('./pptx/pptxToPdf');
        bytes = await pptxToPdf(file, (message) => onProgress?.(`"${file.name}": ${message}`), { backend, signal });
      } else {
        onProgress?.(`Adding "${file.name}"…`);
        bytes = await file.arrayBuffer();
      }
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (source.isEncrypted) throw new Error('This file is encrypted. Export an unencrypted PDF first.');
      if (source.getPageCount() === 0) throw new Error('This file has no pages.');
      detachInternalLinks(source);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      reattachInternalLinks(pages);
    } catch (error) {
      throw new Error(`Could not process "${file.name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (normalizeWidths) normalizePageWidths(merged.getPages());
  return merged.save();
}
