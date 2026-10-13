import { expect, it } from 'vitest';
import { loadPresentationFonts } from './presentationFonts';

const sfnt = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const font = (name: string, data = sfnt, size = data.length) => ({
  name, size, arrayBuffer: async () => data.slice().buffer,
}) as File;

it('keeps font bytes unchanged while assigning safe, unique filenames', async () => {
  const result = await loadPresentationFonts([font('../Georgia.TTF'), font('Georgia.ttf')]);
  expect(result.map(({ filename }) => filename)).toEqual(['presentation-0.ttf', 'presentation-1.ttf']);
  expect(result.map(({ data }) => Array.from(data))).toEqual([Array.from(sfnt), Array.from(sfnt)]);
});

it('rejects webfonts, invalid font headers and oversized selections', async () => {
  await expect(loadPresentationFonts([font('font.woff')])).rejects.toThrow('TTF, OTF or TTC');
  await expect(loadPresentationFonts([font('font.ttf', new Uint8Array(12))])).rejects.toThrow('not a readable');
  await expect(loadPresentationFonts([font('font.ttf', sfnt, 21 * 1024 * 1024)])).rejects.toThrow('under 20 MB');
  await expect(loadPresentationFonts(Array.from({ length: 33 }, () => font('font.ttf')))).rejects.toThrow('at most 32');
  await expect(loadPresentationFonts(Array.from({ length: 4 }, () => font('font.ttf', sfnt, 17 * 1024 * 1024)))).rejects.toThrow('64 MB');
});
