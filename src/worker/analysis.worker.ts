// The Web Worker. It runs in a separate thread, so heavy analysis of a
// 300-page book never freezes the spider animation.
// It receives { id, method, args } and answers { id, ok, result } or { id, ok: false, error }.
// While working it can send { id, progress }.

import { api } from './api';

type Req = { id: number; method: string; args: unknown };

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, method, args } = e.data;
  const fn = (api as unknown as Record<string, (a: unknown, p: (x: unknown) => void) => unknown>)[method];
  if (!fn) {
    self.postMessage({ id, ok: false, error: `Unknown method ${method}` });
    return;
  }
  try {
    const result = fn(args, (progress) => self.postMessage({ id, progress }));
    Promise.resolve(result).then(
      (r) => self.postMessage({ id, ok: true, result: r }),
      (err: Error) => self.postMessage({ id, ok: false, error: err?.message ?? String(err) }),
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error)?.message ?? String(err) });
  }
};
