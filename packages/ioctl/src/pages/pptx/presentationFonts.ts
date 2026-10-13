export interface PresentationFont {
  filename: string;
  data: Uint8Array<ArrayBuffer>;
}

export async function loadPresentationFonts(files: File[]): Promise<PresentationFont[]> {
  if (files.length > 32 || files.reduce((size, file) => size + file.size, 0) > 64 * 1024 * 1024) {
    throw new Error('Select at most 32 font files, totaling no more than 64 MB.');
  }
  const fonts: PresentationFont[] = [];
  for (const [index, file] of files.entries()) {
    if (!/\.(ttf|otf|ttc)$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      throw new Error(`"${file.name}" must be a TTF, OTF or TTC font under 20 MB.`);
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const signature = new TextDecoder().decode(data.subarray(0, 4));
    if (!(data.length >= 12 && ((data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0) || signature === 'OTTO' || signature === 'true' || signature === 'ttcf'))) {
      throw new Error(`"${file.name}" is not a readable TTF, OTF or TTC font.`);
    }
    // Original filenames cannot overwrite bundled fonts or escape the font directory.
    fonts.push({ filename: `presentation-${index}.${file.name.split('.').pop()!.toLowerCase()}`, data });
  }
  return fonts;
}
