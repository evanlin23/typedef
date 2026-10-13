// Emscripten normally calls soffice main() after onRuntimeInitialized. That
// starts a second office application while LibreOfficeKit is initializing.
// LOK owns startup here; suppress the application entry point using the
// supported Module.noInitialRun option before evaluating the WASM loader.
const importRuntimeScripts = globalThis.importScripts.bind(globalThis);
globalThis.importScripts = (...urls) => {
  if (urls.some((url) => new URL(url, globalThis.location.href).pathname.endsWith('/soffice.js'))) {
    globalThis.Module.noInitialRun = true;
  }
  importRuntimeScripts(...urls);
};
importRuntimeScripts(new URL('browser.worker.js', globalThis.location.href).href);

const dispatch = globalThis.onmessage;
async function decompress(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download the conversion engine (HTTP ${response.status}).`);
  const blob = await response.blob();
  const magic = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  // Some hosts already decompress using Content-Encoding: gzip.
  const stream = magic[0] === 0x1f && magic[1] === 0x8b
    ? blob.stream().pipeThrough(new DecompressionStream('gzip')) : blob.stream();
  return URL.createObjectURL(new Blob([await new Response(stream).blob()], { type: mimeType }));
}
globalThis.onmessage = async (event) => {
  if (event.data.type !== 'init') { dispatch(event); return; }
  try {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot load the conversion engine. Please use a current desktop browser.');
    globalThis.postMessage({ type: 'progress', id: event.data.id, progress: { message: 'Downloading and preparing conversion engine (about 80 MB)…' } });
    const [sofficeWasm, sofficeData] = await Promise.all([
      decompress(event.data.sofficeWasm, 'application/wasm'),
      decompress(event.data.sofficeData, 'application/octet-stream'),
    ]);
    dispatch({ data: { ...event.data, sofficeWasm, sofficeData } });
  } catch (error) {
    globalThis.postMessage({ type: 'error', id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
