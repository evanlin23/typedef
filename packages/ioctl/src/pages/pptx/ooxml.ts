import type JSZip from 'jszip';

// Helpers for reading and editing the parts of an Office Open XML package

export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
export const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

export const child = (el: Element | null | undefined, ns: string, name: string) =>
  el ? Array.from(el.children).find((c) => c.namespaceURI === ns && c.localName === name) ?? null : null;
export const path = (el: Element | null | undefined, ...names: [string, string][]) =>
  names.reduce<Element | null | undefined>((cur, [ns, name]) => child(cur, ns, name), el) ?? null;

export async function readXml(zip: JSZip, file: string) {
  const text = await zip.file(file)?.async('text');
  return text ? new DOMParser().parseFromString(text, 'application/xml') : null;
}

export const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/'));
export const relsFileOf = (file: string) => `${dirOf(file)}/_rels/${file.slice(dirOf(file).length + 1)}.rels`;

// Resolves a relationship target (relative to `dir`) to a path in the zip
export function resolvePath(dir: string, target: string) {
  const parts = target.startsWith('/') ? target.slice(1).split('/') : [...dir.split('/'), ...target.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

export function relativePath(fromDir: string, to: string) {
  const from = fromDir.split('/');
  const parts = to.split('/');
  let common = 0;
  while (common < from.length && from[common] === parts[common]) common++;
  return [...from.slice(common).map(() => '..'), ...parts.slice(common)].join('/');
}

// Resolves the target of the first relationship of the given type, relative to `file`
export async function relatedFile(zip: JSZip, file: string, type: string) {
  const rels = await readXml(zip, relsFileOf(file));
  const rel = Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? []).find((r) => r.getAttribute('Type')?.endsWith(type));
  const target = rel?.getAttribute('Target');
  return target ? resolvePath(dirOf(file), target) : null;
}

// Resolves the targets of all relationships of the given type, relative to `file`
export async function relatedFiles(zip: JSZip, file: string, type: string) {
  const rels = await readXml(zip, relsFileOf(file));
  return Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? [])
    .filter((r) => r.getAttribute('Type')?.endsWith(type) && r.getAttribute('TargetMode') !== 'External')
    .map((r) => resolvePath(dirOf(file), r.getAttribute('Target') ?? ''));
}

export const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

// Adds a relationship from `file` to `target` (a path in the zip, or a URL if
// external) and returns its ID
export async function addRelationship(zip: JSZip, file: string, type: string, target: string, external = false) {
  const relsFile = relsFileOf(file);
  const rels = (await readXml(zip, relsFile)) ?? new DOMParser().parseFromString(`<Relationships xmlns="${REL}"/>`, 'application/xml');
  const ids = new Set(Array.from(rels.getElementsByTagNameNS(REL, 'Relationship'), (r) => r.getAttribute('Id')));
  let n = 1;
  while (ids.has(`rIdIoctl${n}`)) n++;
  const rel = rels.createElementNS(REL, 'Relationship');
  rel.setAttribute('Id', `rIdIoctl${n}`);
  rel.setAttribute('Type', type);
  rel.setAttribute('Target', external ? target : relativePath(dirOf(file), target));
  if (external) rel.setAttribute('TargetMode', 'External');
  rels.documentElement.append(rel);
  zip.file(relsFile, serialize(rels));
  return `rIdIoctl${n}`;
}

// The zip path a relationship ID of `file` points to
export async function relationshipTarget(zip: JSZip, file: string, id: string) {
  const rels = await readXml(zip, relsFileOf(file));
  const rel = Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? []).find((r) => r.getAttribute('Id') === id);
  if (!rel || rel.getAttribute('TargetMode') === 'External') return null;
  return resolvePath(dirOf(file), rel.getAttribute('Target') ?? '');
}

// A relationship of `file`: its type, and its target as a zip path (or URL if external)
export async function relationship(zip: JSZip, file: string, id: string) {
  const rels = await readXml(zip, relsFileOf(file));
  const rel = Array.from(rels?.getElementsByTagNameNS(REL, 'Relationship') ?? []).find((r) => r.getAttribute('Id') === id);
  if (!rel) return null;
  const external = rel.getAttribute('TargetMode') === 'External';
  const target = rel.getAttribute('Target') ?? '';
  return { type: rel.getAttribute('Type') ?? '', target: external ? target : resolvePath(dirOf(file), target), external };
}
