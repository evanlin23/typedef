// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { canReadDeviceFonts, readDeviceOfficeFonts } from './deviceFonts';
import { loadPresentationFonts } from './presentationFonts';
afterEach(() => vi.unstubAllGlobals());

it('reads only original Office families and retains TTC collections', async () => {
  const unrelated = vi.fn();
  vi.stubGlobal('queryLocalFonts', async () => [
    { family: 'Georgia', postscriptName: 'Georgia', blob: async () => new Blob([new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]) },
    { family: 'Cambria Math', postscriptName: 'CambriaMath', blob: async () => new Blob(['ttcf00000000']) },
    { family: 'Other Font', postscriptName: 'Other', blob: unrelated },
  ]);
  expect(canReadDeviceFonts()).toBe(true);
  const fonts = await readDeviceOfficeFonts();
  expect(fonts.map((font) => font.name)).toEqual(['Georgia.ttf', 'CambriaMath.ttc']);
  expect(await loadPresentationFonts(fonts)).toHaveLength(2);
  expect(unrelated).not.toHaveBeenCalled();
});

it('reports denied access and missing Office fonts without silently changing fonts', async () => {
  vi.stubGlobal('queryLocalFonts', async () => { throw new Error('Denied'); });
  await expect(readDeviceOfficeFonts()).rejects.toThrow('Font access was not allowed');
  vi.stubGlobal('queryLocalFonts', async () => []);
  await expect(readDeviceOfficeFonts()).rejects.toThrow('No common Office fonts');
});
