import "server-only";
import { config } from "./config";

type Entry = { at: number; promise: Promise<unknown> };
// guardado em globalThis para ser o mesmo entre páginas e ações (o Next pode carregar o módulo mais de uma vez)
const g = globalThis as unknown as { __seminovosCache?: Map<string, Entry> };
const store = (g.__seminovosCache ??= new Map<string, Entry>());

/** Memoriza o resultado por alguns segundos para não estourar a cota da API do Google. */
export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < config.cacheSegundos * 1000) return hit.promise as Promise<T>;
  const promise = load().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { at: Date.now(), promise });
  return promise;
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
