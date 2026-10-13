interface DeviceFont {
  family: string;
  postscriptName: string;
  blob: () => Promise<Blob>;
}
type FontWindow = typeof globalThis & { queryLocalFonts?: () => Promise<DeviceFont[]> };
const officeFamilies = new Set(['arial', 'calibri', 'cambria', 'cambria math', 'georgia', 'times new roman']);

export const canReadDeviceFonts = () => typeof (globalThis as FontWindow).queryLocalFonts === 'function';

// Called directly from a button click: the browser asks for local font access.
// Read only common original Office families, not the entire system font library.
export async function readDeviceOfficeFonts(): Promise<File[]> {
  const query = (globalThis as FontWindow).queryLocalFonts;
  if (!query) throw new Error('This browser cannot read installed fonts. Select font files instead.');
  let available: DeviceFont[];
  try { available = await query.call(globalThis); }
  catch { throw new Error('Font access was not allowed. You can select font files instead.'); }
  const matching = available.filter((font) => officeFamilies.has(font.family.toLowerCase()));
  if (matching.length === 0) throw new Error('No common Office fonts were found on this device. You can select font files instead.');
  if (matching.length > 32) throw new Error('More than 32 Office fonts were found. Select the font files your slides use instead.');
  const files: File[] = [];
  for (const font of matching) {
    const blob = await font.blob();
    const signature = new TextDecoder().decode(await blob.slice(0, 4).arrayBuffer());
    const extension = signature === 'OTTO' ? 'otf' : signature === 'ttcf' ? 'ttc' : 'ttf';
    files.push(new File([blob], `${font.postscriptName}.${extension}`));
  }
  return files;
}
