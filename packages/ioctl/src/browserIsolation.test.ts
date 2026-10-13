import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prepareBrowserIsolation } from './browserIsolation';

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('crossOriginIsolated', false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('waits for service worker control before reloading, and delays app startup', async () => {
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue({}), controller: null as object | null,
  });
  const reload = vi.fn();
  vi.stubGlobal('navigator', { serviceWorker });
  vi.stubGlobal('location', { reload });
  const startup = prepareBrowserIsolation();
  await Promise.resolve();
  await Promise.resolve();
  expect(reload).not.toHaveBeenCalled();
  serviceWorker.controller = {};
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  expect(await startup).toBe(false);
  expect(reload).toHaveBeenCalledOnce();
});

it('does not reload indefinitely when browser policy prevents isolation', async () => {
  sessionStorage.setItem('ioctl-isolation-reloaded', '1');
  const reload = vi.fn();
  vi.stubGlobal('navigator', { serviceWorker: Object.assign(new EventTarget(), {
    register: vi.fn().mockResolvedValue({}), controller: {},
  }) });
  vi.stubGlobal('location', { reload });
  expect(await prepareBrowserIsolation()).toBe(true);
  expect(reload).not.toHaveBeenCalled();
});

it('keeps other tools available when service worker registration is denied', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal('navigator', { serviceWorker: Object.assign(new EventTarget(), {
    register: vi.fn().mockRejectedValue(new Error('blocked')), controller: null,
  }) });
  expect(await prepareBrowserIsolation()).toBe(true);
  vi.restoreAllMocks();
});
