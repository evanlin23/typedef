import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString, type PDFObject, type PDFPage } from 'pdf-lib';

// Clickable links in PDFs: writing them for converted slides, and keeping
// links between pages working when pages are copied into another PDF.

export interface Link {
  rect: [number, number, number, number]; // In PDF coordinates
  // A URL, or a page in the same PDF (zero-based)
  target: { uri: string } | { page: number };
}

// Adds link annotations to pages; `links[i]` are the links on page i
export function writeLinks(doc: PDFDocument, links: Link[][]) {
  const pages = doc.getPages();
  links.forEach((pageLinks, index) => {
    for (const link of pageLinks) {
      const target = link.target;
      if ('page' in target && !pages[target.page]) continue;
      const annotation = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: link.rect,
        Border: [0, 0, 0],
        ...('uri' in target
          ? { A: { Type: 'Action', S: 'URI', URI: PDFString.of(target.uri) } }
          : { Dest: [pages[target.page].ref, 'XYZ', null, null, null] }),
      });
      pages[index].node.addAnnot(doc.context.register(annotation));
    }
  });
}

// pdf-lib copies whatever a link's destination refers to, so a link to
// another page would drag a disconnected copy of that page along (and point
// at it). Before copying, internal links get the page number instead, and
// after copying they're pointed at the copied pages.
const PAGE_KEY = PDFName.of('IoctlTargetPage');

const textOf = (obj: PDFObject | undefined) => (obj instanceof PDFString || obj instanceof PDFHexString ? obj.decodeText() : obj instanceof PDFName ? obj.decodeText() : undefined);

// Looks a name up in a name tree (the catalog's /Names /Dests)
function lookupNameTree(doc: PDFDocument, node: PDFDict | undefined, name: string, depth = 0): PDFObject | undefined {
  if (!node || depth > 32) return undefined;
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (names) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      if (textOf(names.lookup(i)) === name) return names.lookup(i + 1);
    }
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
  for (let i = 0; kids && i < kids.size(); i++) {
    const kid = kids.lookup(i, PDFDict);
    const limits = kid.lookupMaybe(PDFName.of('Limits'), PDFArray);
    if (limits) {
      const [low, high] = [textOf(limits.lookup(0)), textOf(limits.lookup(1))];
      if (low !== undefined && high !== undefined && (name < low || name > high)) continue;
    }
    const found = lookupNameTree(doc, kid, name, depth + 1);
    if (found) return found;
  }
  return undefined;
}

// The page a destination (explicit or named) points to
function destinationPage(doc: PDFDocument, dest: PDFObject | undefined, pageIndex: Map<string, number>): number | undefined {
  if (dest instanceof PDFRef) dest = doc.context.lookup(dest);
  if (dest instanceof PDFArray) {
    const page = dest.get(0);
    return page instanceof PDFRef ? pageIndex.get(page.toString()) : undefined;
  }
  const name = textOf(dest);
  if (name === undefined) return undefined;
  const catalog = doc.catalog;
  let target = lookupNameTree(doc, catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.lookupMaybe(PDFName.of('Dests'), PDFDict), name);
  target ??= catalog.lookupMaybe(PDFName.of('Dests'), PDFDict)?.get(PDFName.of(name));
  if (target instanceof PDFRef) target = doc.context.lookup(target);
  // A named destination is an array, or a dictionary with the array in /D
  if (target instanceof PDFDict) target = target.get(PDFName.of('D'));
  return target instanceof PDFArray ? destinationPage(doc, target, pageIndex) : undefined;
}

function* linkAnnotations(page: PDFPage) {
  const annots = page.node.Annots();
  for (let i = 0; annots && i < annots.size(); i++) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (annot?.get(PDFName.of('Subtype'))?.toString() === '/Link') yield annot;
  }
}

// Replaces the destinations of a document's internal links with page numbers
export function detachInternalLinks(doc: PDFDocument) {
  const pageIndex = new Map(doc.getPages().map((page, i) => [page.ref.toString(), i]));
  for (const page of doc.getPages()) {
    for (const annot of linkAnnotations(page)) {
      const action = annot.lookupMaybe(PDFName.of('A'), PDFDict);
      const isGoTo = action?.get(PDFName.of('S'))?.toString() === '/GoTo';
      const dest = annot.get(PDFName.of('Dest')) ?? (isGoTo ? action!.get(PDFName.of('D')) : undefined);
      if (!dest) continue;
      const target = destinationPage(doc, dest, pageIndex);
      annot.delete(PDFName.of('Dest'));
      if (isGoTo) annot.delete(PDFName.of('A'));
      // Links to pages that can't be found are dropped rather than left broken
      if (target !== undefined) annot.set(PAGE_KEY, PDFNumber.of(target));
    }
  }
}

// Points internal links on copied pages at the pages they were copied to
export function reattachInternalLinks(pages: PDFPage[]) {
  for (const page of pages) {
    for (const annot of linkAnnotations(page)) {
      const target = annot.lookupMaybe(PAGE_KEY, PDFNumber)?.asNumber();
      if (target === undefined) continue;
      annot.delete(PAGE_KEY);
      if (pages[target]) annot.set(PDFName.of('Dest'), page.doc.context.obj([pages[target].ref, 'XYZ', null, null, null]));
    }
  }
}
