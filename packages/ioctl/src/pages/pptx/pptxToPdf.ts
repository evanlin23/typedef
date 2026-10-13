import { officeEngine } from './officeEngine';
import { isPptx } from './fileTypes';
import JSZip from 'jszip';
import { MAX_HOSTED_INPUT, type ConversionOptions } from './conversionBackend';

export async function pptxToPdf(file: File, onProgress?: (message: string) => void,
  { backend = { kind: 'browser' }, signal }: ConversionOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  signal?.throwIfAborted();
  if (backend.kind === 'cloudconvert' && !backend.apiKey.trim()) {
    throw new Error('Enter your CloudConvert API key before selecting presentations.');
  }
  if (backend.kind === 'cloudconvert' && file.size > MAX_HOSTED_INPUT) {
    throw new Error('CloudConvert uploads are limited to 50 MB in this app.');
  }
  if (!isPptx(file)) throw new Error('Please select a .pptx presentation.');
  const input = new Uint8Array(await file.arrayBuffer());
  if (input.length === 0) throw new Error(`"${file.name}" is empty.`);
  // LibreOffice detects formats independently of the extension. Reject damaged
  // or renamed text/Word files instead of returning an unrelated document PDF.
  try {
    const zip = await JSZip.loadAsync(input);
    const types = await zip.file('[Content_Types].xml')?.async('text');
    const xml = types ? new DOMParser().parseFromString(types, 'application/xml') : undefined;
    const presentation = xml && Array.from(xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Override')).find((part) =>
      part.getAttribute('ContentType') === 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
    const part = presentation?.getAttribute('PartName')?.replace(/^\//, '');
    if (!part || !zip.file(part)) throw new Error('Missing presentation part');
  } catch {
    throw new Error(`"${file.name}" is not a readable PPTX presentation. It may be damaged or password-protected. Export it as PDF from PowerPoint instead.`);
  }
  signal?.throwIfAborted();
  if (backend.kind === 'cloudconvert') {
    const { cloudConvertToPdf } = await import('./cloudConvert');
    return cloudConvertToPdf(input, file.name, backend.apiKey, onProgress, signal);
  }
  return new Uint8Array(await officeEngine.convert(input, onProgress));
}
