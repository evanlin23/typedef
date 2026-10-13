import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeWorker {
  static instances: FakeWorker[] = [];
  static failNext = false;
  static stall = false;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  messages: { type: string; id: number }[] = [];
  constructor() {
    FakeWorker.instances.push(this);
    queueMicrotask(() => this.onmessage?.({ data: { type: 'loaded' } }));
  }
  postMessage(message: { type: string; id: number }) {
    this.messages.push(message);
    if (FakeWorker.stall) return;
    queueMicrotask(() => {
      if (message.type === 'init') {
        this.onmessage?.({ data: { type: 'ready', id: message.id } });
      } else if (FakeWorker.failNext) {
        FakeWorker.failNext = false;
        this.onmessage?.({ data: { type: 'error', id: message.id, error: 'Damaged presentation' } });
      } else {
        this.onmessage?.({ data: { type: 'result', id: message.id, data: new TextEncoder().encode('%PDF-test') } });
      }
    });
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('crossOriginIsolated', true);
  vi.stubGlobal('Worker', FakeWorker);
  FakeWorker.instances = [];
  FakeWorker.failNext = false;
  FakeWorker.stall = false;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Office engine lifecycle', () => {
  it('serializes concurrent requests from both tools and initializes only once', async () => {
    const { officeEngine } = await import('./officeEngine');
    const results = await Promise.all([officeEngine.convert(new Uint8Array([1])), officeEngine.convert(new Uint8Array([2]))]);
    expect(results).toHaveLength(2);
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].messages.map((m) => m.type)).toEqual(['init', 'convert', 'convert']);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('rejects a failed conversion, then retries the next file in a fresh worker', async () => {
    const { officeEngine } = await import('./officeEngine');
    FakeWorker.failNext = true;
    const first = officeEngine.convert(new Uint8Array([1]));
    const second = officeEngine.convert(new Uint8Array([2]));
    await expect(first).rejects.toThrow('Damaged presentation');
    expect(new TextDecoder().decode(await second)).toBe('%PDF-test');
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('terminates an unresponsive initialization and permits another attempt', async () => {
    const { officeEngine } = await import('./officeEngine');
    FakeWorker.stall = true;
    const failure = expect(officeEngine.convert(new Uint8Array([1]))).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(300_000);
    await failure;
    FakeWorker.stall = false;
    expect(new TextDecoder().decode(await officeEngine.convert(new Uint8Array([2])))).toBe('%PDF-test');
  });

  it('gives an actionable error without starting a worker when isolation is missing', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    const { officeEngine } = await import('./officeEngine');
    await expect(officeEngine.convert(new Uint8Array([1]))).rejects.toThrow('export a PDF from PowerPoint');
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
