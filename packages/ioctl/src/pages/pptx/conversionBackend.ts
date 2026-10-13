export const MAX_HOSTED_INPUT = 50 * 1024 * 1024;

export type ConversionBackend =
  | { kind: 'browser' }
  | { kind: 'cloudconvert'; apiKey: string };

export interface ConversionOptions {
  backend?: ConversionBackend;
  signal?: AbortSignal;
}
