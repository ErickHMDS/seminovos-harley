import "server-only";
import { after } from "next/server";
import { config } from "./config";

/**
 * Cache dos dados das planilhas (em memória do servidor), no modelo "mostra o que tem e atualiza por trás":
 * - até `cacheSegundos` (60 s): devolve o que está guardado;
 * - depois disso, até 10 min: devolve na hora o que está guardado e busca a versão nova em segundo plano
 *   (a próxima tela já vem atualizada) — ninguém espera o Google para trocar de aba;
 * - acima de 10 min (ou após uma gravação, que chama invalidate): busca e espera.
 */
type Entry = { at: number; promise: Promise<unknown>; ok: boolean; atualizando?: boolean };
// guardado em globalThis para ser o mesmo entre páginas e ações (o Next pode carregar o módulo mais de uma vez)
const g = globalThis as unknown as { __seminovosCache?: Map<string, Entry> };
const store = (g.__seminovosCache ??= new Map<string, Entry>());

const MAX_VELHO_MS = 10 * 60 * 1000;

function buscar<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry: Entry = { at: Date.now(), promise: Promise.resolve(), ok: false };
  const promise = load().then(
    (v) => { entry.ok = true; return v; },
    (err) => { if (store.get(key) === entry) store.delete(key); throw err; },
  );
  entry.promise = promise;
  store.set(key, entry);
  return promise;
}

/** Mantém o servidor vivo até a atualização em segundo plano terminar (Vercel). */
export function emSegundoPlano(p: Promise<unknown>) {
  const seguro = p.catch(() => {});
  try { after(() => seguro); } catch { /* fora de uma requisição: a promessa segue sozinha */ }
}

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  const idade = hit ? Date.now() - hit.at : Infinity;
  if (hit && idade < config.cacheSegundos * 1000) return hit.promise as Promise<T>;
  if (hit && hit.ok && idade < MAX_VELHO_MS) {
    if (!hit.atualizando) {
      hit.atualizando = true;
      const velho = hit.promise;
      // busca a versão nova; se falhar, continua servindo a antiga
      const nova = load().then(
        (v) => { if (store.get(key) === hit) store.set(key, { at: Date.now(), promise: Promise.resolve(v), ok: true }); },
        () => { hit.atualizando = false; },
      );
      emSegundoPlano(nova);
      return velho as Promise<T>;
    }
    return hit.promise as Promise<T>;
  }
  return buscar(key, load);
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
