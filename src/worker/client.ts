// The main thread side of the worker. call('analyze', {...}) returns a Promise.

import type { Api } from './api';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: Record<string, unknown>) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { id: number; ok?: boolean; result?: unknown; error?: string; progress?: Record<string, unknown> };
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.progress) {
        p.onProgress?.(msg.progress);
        return;
      }
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
  }
  return worker;
}

type Args<M extends keyof Api> = Parameters<Api[M]>[0];
type Result<M extends keyof Api> = Awaited<ReturnType<Api[M]>>;

export function call<M extends keyof Api>(
  method: M,
  args: Args<M>,
  onProgress?: (p: Record<string, unknown>) => void,
): Promise<Result<M>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    getWorker().postMessage({ id, method, args });
  });
}

/** For features added later that are registered with extendApi. */
export function callAny<T>(method: string, args: unknown, onProgress?: (p: Record<string, unknown>) => void): Promise<T> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    getWorker().postMessage({ id, method, args });
  });
}
