// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const bootstrap = readFileSync(new URL('../../../scripts/office.worker.js', import.meta.url), 'utf8');
interface Module { noInitialRun?: boolean; preRun?: (() => void) | (() => void)[] }

function environment(module: Module, initialWorkers = 4) {
  const workers = Array.from({ length: initialWorkers }, () => ({}));
  const allocate = vi.fn(() => workers.push({}));
  let workersAtStartup = 0;
  const context = createContext({
    URL, location: { href: 'https://example.com/ioctl/libreoffice/office.worker.js' },
    onmessage: () => undefined, Module: module,
    PThread: { unusedWorkers: workers, allocateUnusedWorker: allocate },
    importScripts: (...urls: string[]) => {
      if (!urls.some((url) => url.endsWith('/soffice.js'))) return;
      const callbacks = module.preRun;
      for (const callback of Array.isArray(callbacks) ? callbacks : callbacks ? [callbacks] : []) callback();
      // The loader consumes the populated pool before executing native imports.
      workersAtStartup = workers.length;
    },
  });
  runInContext(bootstrap, context);
  return { context, allocate, startupWorkers: () => workersAtStartup };
}

it('populates the thread pool before native startup and suppresses duplicate soffice startup', () => {
  const module: Module = {};
  const env = environment(module);
  runInContext("importScripts('https://example.com/ioctl/libreoffice/soffice.js')", env.context);
  expect(env.startupWorkers()).toBe(16);
  expect(env.allocate).toHaveBeenCalledTimes(12);
  expect(module.noInitialRun).toBe(true);
});

it.each(['function', 'array'])('preserves an existing %s preRun hook and an already larger pool', (kind) => {
  const callback = vi.fn();
  const env = environment({ preRun: kind === 'function' ? callback : [callback] }, 20);
  runInContext("importScripts('https://example.com/ioctl/libreoffice/soffice.js')", env.context);
  expect(callback).toHaveBeenCalledOnce();
  expect(env.startupWorkers()).toBe(20);
  expect(env.allocate).not.toHaveBeenCalled();
});
