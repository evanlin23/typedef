export const PDF_ONLY_MESSAGE = 'Only PDF files can be combined. Export PowerPoint presentations as PDF in PowerPoint or Google Slides, then add the PDFs here.';

export function isPdf(file: File): boolean {
  // A presentation must never enter the merge queue, even with a misleading MIME type.
  if (/\.(pptx?|ppsx?|potx?)$/i.test(file.name)) return false;
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
