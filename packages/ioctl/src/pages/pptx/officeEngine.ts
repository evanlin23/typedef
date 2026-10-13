// Classic worker protocol pinned to @matbee/libreoffice-converter 2.7.2.
// Own the worker so a crashed/timed-out WASM runtime can be terminated.
import type { PresentationFont } from './presentationFonts';
interface OfficeMessage {
  type: 'loaded' | 'ready' | 'result' | 'error' | 'progress';
  id?: number;
  data?: Uint8Array;
  error?: string;
  progress?: { percent: number; message: string };
}
type Progress = (message: string) => void;
const INITIALIZE_TIMEOUT = 300_000;
const CONVERT_TIMEOUT = 120_000;
const ASSET_PATH = `${import.meta.env.BASE_URL}libreoffice/`;

class OfficeEngine {
  private worker: Worker | undefined;
  private ready: Promise<void> | undefined;
  private nextId = 0;
  private progress: Progress | undefined;
  private loadTimer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private requests = new Map<number, {
    resolve: (data?: Uint8Array) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private loadReject: ((error: Error) => void) | undefined;

  convert(input: Uint8Array, onProgress?: Progress, fonts: PresentationFont[] = []): Promise<Uint8Array> {
    // Both tools share this queue, including across routes. Each presentation
    // gets a fresh runtime: upstream posts the PDF before native document
    // destruction, which can hang and prevent the next request from starting.
    const operation = this.queue.then(async () => {
      this.progress = onProgress;
      try {
        this.assertSupported();
        this.progress?.('Loading conversion engine (first download is about 80 MB)…');
        await this.initialize(fonts);
        this.progress?.('Converting presentation…');
        const data = await this.request('convert', {
          inputData: input, inputExt: 'pptx', outputFormat: 'pdf',
        }, CONVERT_TIMEOUT, [input.buffer as ArrayBuffer]);
        if (!data || new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
          throw new Error('The conversion engine did not return a PDF.');
        }
        return data;
      } finally {
        this.progress = undefined;
        this.reset();
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private assertSupported() {
    if (!globalThis.isSecureContext || !globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      throw new Error('PowerPoint conversion needs a secure, isolated browser tab. Reload this page, or use a current desktop browser. You can also export a PDF from PowerPoint and combine it here.');
    }
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
      throw new Error('This browser does not support the PowerPoint conversion engine.');
    }
  }

  private initialize(fonts: PresentationFont[]): Promise<void> {
    if (this.ready) return this.ready;
    const worker = new Worker(new URL(`${ASSET_PATH}office.worker.js`, location.href));
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      this.loadReject = reject;
      this.loadTimer = setTimeout(() => this.reset(new Error('The conversion engine took too long to load. Please try again.')), INITIALIZE_TIMEOUT);
      worker.onmessage = (event: MessageEvent<OfficeMessage>) => {
        const message = event.data;
        if (message.type === 'loaded') {
          clearTimeout(this.loadTimer);
          const url = (file: string) => new URL(`${ASSET_PATH}${file}`, location.href).href;
          void this.request('init', {
            sofficeJs: url('soffice.js'), sofficeWasm: url('soffice.wasm.gz'),
            sofficeData: url('soffice.data.gz'), sofficeWorkerJs: url('soffice.worker.js'),
            // Upstream warns progress interception can break stream compilation.
            enableProgressTracking: false,
            // Upstream installs these before LibreOffice's initial font scan.
            // Copy rather than transfer: another file can reuse the same fonts.
            fonts,
          }, INITIALIZE_TIMEOUT).then(() => {
            this.loadReject = undefined;
            resolve();
          }, reject);
        } else if (message.type === 'progress') {
          if (message.progress) this.progress?.(message.progress.message);
        } else if (message.id !== undefined) {
          const pending = this.requests.get(message.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.requests.delete(message.id);
          if (message.type === 'error') pending.reject(new Error(message.error || 'Could not convert this presentation.'));
          else pending.resolve(message.data);
        }
      };
      worker.onerror = () => this.reset(new Error('The conversion engine stopped unexpectedly. Please try again.'));
      worker.onmessageerror = () => this.reset(new Error('Could not read the conversion engine response. Please try again.'));
    });
    return this.ready;
  }

  private request(type: string, payload: Record<string, unknown>, timeout: number, transfer: Transferable[] = []) {
    return new Promise<Uint8Array | undefined>((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.reset(new Error('PowerPoint conversion timed out. Please try again, or export this presentation as PDF in PowerPoint.')), timeout);
      this.requests.set(id, { resolve, reject, timer });
      try {
        if (!this.worker) throw new Error('The conversion engine is unavailable.');
        this.worker.postMessage({ type, id, ...payload }, transfer);
      } catch (error) {
        clearTimeout(timer);
        this.requests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private reset(error = new Error('The conversion engine was released.')) {
    clearTimeout(this.loadTimer);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
    this.loadReject?.(error);
    this.loadReject = undefined;
    for (const pending of this.requests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.requests.clear();
  }
}
export const officeEngine = new OfficeEngine();
