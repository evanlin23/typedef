import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cloudConvertToPdf } from './cloudConvert';

const PDF = new TextEncoder().encode('%PDF-test');
const input = new Uint8Array([1, 2, 3]);
const pending = { data: { id: 'job-123', status: 'waiting', tasks: [
  { name: 'upload', status: 'waiting', result: { form: {
    url: 'https://upload.cloudconvert.com/signed', parameters: { signature: 'upload-signature', max_file_size: 100 },
  } } },
] } };
const finished = { data: { id: 'job-123', status: 'finished', tasks: [
  { name: 'download', status: 'finished', result: { files: [{ filename: 'slides.pdf', url: 'https://storage.cloudconvert.com/signed.pdf' }] } },
] } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function success() {
  fetchMock.mockResolvedValueOnce(json(pending))
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(json(finished))
    .mockResolvedValueOnce(new Response(PDF))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
}

it('uploads only to the signed form, authenticates only API calls, downloads the PDF and removes the job', async () => {
  success();
  const result = cloudConvertToPdf(input, 'lecture.pptx', ' private-key ');
  await vi.advanceTimersByTimeAsync(1_000);
  expect(Array.from(await result)).toEqual(Array.from(PDF));
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'https://api.cloudconvert.com/v2/jobs', 'https://upload.cloudconvert.com/signed',
    'https://api.cloudconvert.com/v2/jobs/job-123', 'https://storage.cloudconvert.com/signed.pdf',
    'https://api.cloudconvert.com/v2/jobs/job-123',
  ]);
  const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(request.tasks.convert).toEqual({ operation: 'convert', input: 'upload', input_format: 'pptx', output_format: 'pdf' });
  const upload = fetchMock.mock.calls[1][1]!;
  expect(upload.headers).toBeUndefined();
  expect((upload.body as FormData).get('signature')).toBe('upload-signature');
  expect(((upload.body as FormData).get('file') as File).name).toBe('lecture.pptx');
  expect(fetchMock.mock.calls[3][1]?.headers).toBeUndefined();
  for (const n of [0, 2, 4]) expect(fetchMock.mock.calls[n][1]?.headers).toMatchObject({ Authorization: 'Bearer private-key' });
  for (const [, options] of fetchMock.mock.calls) expect(options).toMatchObject({ credentials: 'omit', redirect: 'error' });
  expect(fetchMock.mock.calls[4][1]?.method).toBe('DELETE');
});

it('rejects missing keys and oversized presentations without making a request', async () => {
  await expect(cloudConvertToPdf(input, 'slides.pptx', '')).rejects.toThrow('API key');
  await expect(cloudConvertToPdf(new Uint8Array(50 * 1024 * 1024 + 1), 'slides.pptx', 'key')).rejects.toThrow('50 MB');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('reports depleted credits without leaking service responses and allows the next queued file', async () => {
  fetchMock.mockResolvedValueOnce(json({ message: 'private-key sensitive-response' }, 402));
  const failure = expect(cloudConvertToPdf(input, 'slides.pptx', 'private-key')).rejects.toThrow('no conversion credits');
  await failure;
  success();
  const next = cloudConvertToPdf(input, 'slides.pptx', 'private-key');
  await vi.advanceTimersByTimeAsync(1_000);
  expect(Array.from(await next)).toEqual(Array.from(PDF));
});

it('refuses untrusted upload addresses before sending any document bytes', async () => {
  const job = structuredClone(pending);
  job.data.tasks[0].result.form.url = 'https://upload.cloudconvert.com.evil.example/upload';
  fetchMock.mockResolvedValueOnce(json(job)).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(cloudConvertToPdf(input, 'slides.pptx', 'key')).rejects.toThrow('unsupported file address');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE');
});

it('reports failed conversion jobs and still requests remote cleanup', async () => {
  fetchMock.mockResolvedValueOnce(json(pending)).mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(json({ data: { ...pending.data, status: 'error' } }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const outcome = expect(cloudConvertToPdf(input, 'slides.pptx', 'key')).rejects.toThrow('could not convert');
  await vi.advanceTimersByTimeAsync(1_000);
  await outcome;
  expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[1]?.method).toBe('DELETE');
});

it('rejects an HTML download instead of returning a misleading PDF', async () => {
  success();
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(json(pending)).mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(json(finished)).mockResolvedValueOnce(new Response('<html>failure</html>'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const outcome = expect(cloudConvertToPdf(input, 'slides.pptx', 'key')).rejects.toThrow('did not return a PDF');
  await vi.advanceTimersByTimeAsync(1_000);
  await outcome;
});

it('cancels a polling conversion and deletes its remote job', async () => {
  const controller = new AbortController();
  fetchMock.mockResolvedValueOnce(json(pending)).mockImplementationOnce(async () => {
    controller.abort(new Error('Cancelled'));
    return new Response(null, { status: 201 });
  }).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(cloudConvertToPdf(input, 'slides.pptx', 'key', undefined, controller.signal)).rejects.toThrow('Cancelled');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
});

it('bounds time spent on hung requests', async () => {
  fetchMock.mockImplementationOnce(async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
  }));
  const outcome = expect(cloudConvertToPdf(input, 'slides.pptx', 'key')).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(300_000);
  await outcome;
});
