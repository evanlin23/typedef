import { officeEngine } from './officeEngine';
import { isPptx } from './fileTypes';
import JSZip from 'jszip';
import { loadPresentationFonts } from './presentationFonts';

// Files stay in the worker's memory. There is no upload or rendering fallback.
export async function pptxToPdf(file: File, onProgress?: (message: string) => void, fontFiles: File[] = []): Promise<Uint8Array<ArrayBuffer>> {
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
  const fonts = await loadPresentationFonts(fontFiles);
  return new Uint8Array(await officeEngine.convert(input, onProgress, fonts));
}
