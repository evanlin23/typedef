// Static hosts cannot always set COOP/COEP. Wait for the service worker to
// control the page before reloading; reloading at "updatefound" is too early.
export async function prepareBrowserIsolation(): Promise<boolean> {
  const key = 'ioctl-isolation-reloaded';
  if (globalThis.crossOriginIsolated) {
    try { sessionStorage.removeItem(key); } catch { /* storage can be disabled */ }
    return true;
  }
  if (!globalThis.isSecureContext || !('serviceWorker' in navigator)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onController: (() => void) | undefined;
  try {
    const registration = navigator.serviceWorker.register(`${import.meta.env.BASE_URL}coi-serviceworker.js`);
    const controlled = registration.then(async () => {
      if (navigator.serviceWorker.controller) return;
      await new Promise<void>((resolve) => {
        onController = () => resolve();
        navigator.serviceWorker.addEventListener('controllerchange', onController, { once: true });
        if (navigator.serviceWorker.controller) resolve();
      });
    });
    await Promise.race([
      controlled,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Browser isolation setup timed out')), 10_000); }),
    ]);
    if (navigator.serviceWorker.controller && sessionStorage.getItem(key) !== '1') {
      sessionStorage.setItem(key, '1');
      location.reload();
      return false;
    }
  } catch (error) {
    // Other tools still work if browser policy blocks service workers/storage.
    console.warn('Could not enable browser isolation:', error);
  } finally {
    clearTimeout(timer);
    if (onController) navigator.serviceWorker.removeEventListener('controllerchange', onController);
  }
  return true;
}
