type Pending = { resolve: (v: Float32Array) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker !== null) return worker;
  worker = new Worker(new URL("./embedder.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<{ id: number; vector?: Float32Array; error?: string }>) => {
    const { id, vector, error } = event.data;
    const waiting = pending.get(id);
    pending.delete(id);
    if (vector !== undefined) waiting?.resolve(vector);
    else waiting?.reject(new Error(error ?? "embedding failed"));
  };
  // A worker that can't start would otherwise leave every caller waiting, and block a later try.
  worker.onerror = (event) => {
    event.preventDefault();
    for (const waiting of pending.values()) waiting.reject(new Error(event.message || "the embedding worker failed"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Loads the model on first use, so nobody pays for it until they search by meaning. */
export function embed(text: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text });
  });
}
