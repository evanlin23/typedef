import { MAX_HOSTED_INPUT } from './conversionBackend';

const API = 'https://api.cloudconvert.com/v2';
const MAX_OUTPUT = 200 * 1024 * 1024;
const TIMEOUT = 300_000;

interface Task {
  name: string;
  status: string;
  result?: {
    form?: { url: string; parameters: Record<string, string | number> };
    files?: { url: string; filename: string }[];
  };
}
interface Job { id: string; status: string; tasks: Task[] }

function serviceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !url.hostname.endsWith('.cloudconvert.com')) {
    throw new Error('CloudConvert returned an unsupported file address.');
  }
  return url.href;
}

async function check(response: Response, authenticated = true): Promise<Response> {
  if (response.ok) return response;
  // Do not echo service response bodies, signed URLs, or credentials into UI/logs.
  if (response.status === 401 || response.status === 403) throw new Error(authenticated
    ? 'CloudConvert rejected the API key. Check task.read and task.write permissions.'
    : 'CloudConvert rejected the file transfer. The signed file address may have expired.');
  if (response.status === 402) throw new Error('CloudConvert has no conversion credits available. Check your free allowance.');
  if (response.status === 429) throw new Error('CloudConvert is limiting requests. Wait before trying again.');
  throw new Error(`CloudConvert request failed (HTTP ${response.status}).`);
}

async function jobResponse(response: Response): Promise<Job> {
  const { data } = await (await check(response)).json() as { data: Job };
  if (!data || typeof data.id !== 'string' || !/^[\w-]+$/.test(data.id) || !Array.isArray(data.tasks)) {
    throw new Error('CloudConvert returned an invalid job response.');
  }
  return data;
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1_000);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function pdfBytes(response: Response) {
  await check(response, false);
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_OUTPUT) throw new Error('CloudConvert PDF exceeds the 200 MB download limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('CloudConvert returned an empty download.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_OUTPUT) throw new Error('CloudConvert PDF exceeds the 200 MB download limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') throw new Error('CloudConvert did not return a PDF.');
  return data;
}

// Serialize hosted jobs as well as local conversions. Failed jobs do not poison
// the queue. Credentials are passed per operation and never persisted.
let queue: Promise<unknown> = Promise.resolve();
export function cloudConvertToPdf(input: Uint8Array<ArrayBuffer>, filename: string, apiKey: string,
  onProgress?: (message: string) => void, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const operation = queue.then(() => convert(input, filename, apiKey, onProgress, signal));
  queue = operation.catch(() => undefined);
  return operation;
}

async function convert(input: Uint8Array<ArrayBuffer>, filename: string, apiKey: string,
  onProgress?: (message: string) => void, parentSignal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const key = apiKey.trim();
  if (!key) throw new Error('Enter your CloudConvert API key before selecting presentations.');
  if (input.length > MAX_HOSTED_INPUT) throw new Error('CloudConvert uploads are limited to 50 MB in this app.');
  parentSignal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('CloudConvert conversion timed out.')), TIMEOUT);
  const signal = controller.signal;
  const headers = { Authorization: `Bearer ${key}` };
  let jobId: string | undefined;
  try {
    onProgress?.('Creating CloudConvert job…');
    let job = await jobResponse(await fetch(`${API}/jobs`, {
      method: 'POST', signal, credentials: 'omit', redirect: 'error',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: {
        upload: { operation: 'import/upload' },
        convert: { operation: 'convert', input: 'upload', input_format: 'pptx', output_format: 'pdf' },
        download: { operation: 'export/url', input: 'convert' },
      } }),
    }));
    jobId = job.id;
    const form = job.tasks.find((task) => task.name === 'upload')?.result?.form;
    if (!form || !form.parameters) throw new Error('CloudConvert did not provide an upload form.');
    const upload = new FormData();
    for (const [name, value] of Object.entries(form.parameters)) upload.append(name, String(value));
    upload.append('file', new Blob([input]), filename);
    onProgress?.('Uploading presentation to CloudConvert…');
    // Signed storage requests receive no API key, cookies, or other credentials.
    await check(await fetch(serviceUrl(form.url), { method: 'POST', body: upload, signal, credentials: 'omit', redirect: 'error' }), false);
    onProgress?.('Converting on CloudConvert…');
    while (job.status !== 'finished') {
      if (job.status === 'error' || job.tasks.some((task) => task.status === 'error')) {
        throw new Error('CloudConvert could not convert this presentation. Check the job in your CloudConvert account.');
      }
      await pause(signal);
      job = await jobResponse(await fetch(`${API}/jobs/${jobId}`, { headers, signal, credentials: 'omit', redirect: 'error' }));
      if (job.id !== jobId) throw new Error('CloudConvert returned a result for a different job.');
    }
    const files = job.tasks.find((task) => task.name === 'download')?.result?.files;
    if (!files || files.length !== 1 || !files[0].filename.toLowerCase().endsWith('.pdf')) {
      throw new Error('CloudConvert did not provide one converted PDF.');
    }
    onProgress?.('Downloading converted PDF…');
    return await pdfBytes(await fetch(serviceUrl(files[0].url), { signal, credentials: 'omit', redirect: 'error' }));
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof TypeError) throw new Error('Could not reach CloudConvert. Check your connection and whether the service allows browser requests.');
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abort);
    if (jobId) {
      // Best effort only: local success must not be discarded if cleanup fails.
      // CloudConvert's retention policy still applies to remote copies.
      await fetch(`${API}/jobs/${jobId}`, {
        method: 'DELETE', headers, credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    }
  }
}
