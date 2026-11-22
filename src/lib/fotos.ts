import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { addSheet, appendValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { TZ, clean } from "./parse";
import { batchUpdateSheet, reqExcluirLinha, valorSeguro } from "./planilha";
import type { Sessao } from "./sessao";

/**
 * Fotos das motos. O arquivo vai para o Vercel Blob (BLOB_READ_WRITE_TOKEN);
 * o endereço fica na aba "Fotos" da planilha do app (ID | Placa | URL | Ordem | Enviado Em | Enviado Por).
 * Também aceita foto por link (ex.: imagem já publicada no site).
 */
const CABECALHO = ["ID", "Placa", "URL", "Ordem", "Enviado Em", "Enviado Por"];

export type Foto = { id: string; placa: string; url: string; ordem: number; linha: number };

async function load(): Promise<Foto[]> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.fotosAba)) return [];
  const rows = await getValues(config.appId, range(config.fotosAba, "A2:D"));
  return rows
    .map((r, i) => ({ id: clean(r[0] ?? ""), placa: clean(r[1] ?? "").toUpperCase(), url: clean(r[2] ?? ""), ordem: Number(r[3]) || 0, linha: i + 2 }))
    .filter((f) => f.id && f.placa && f.url);
}

export const getFotos = () => cached("fotos", load);

export async function fotosDaPlaca(placa: string): Promise<Foto[]> {
  const p = clean(placa).toUpperCase();
  return (await getFotos().catch(() => [])).filter((f) => f.placa === p).sort((a, b) => a.ordem - b.ordem || a.linha - b.linha);
}

/** Capa (primeira foto) de cada placa — para miniaturas no estoque. */
export async function capas(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of [...(await getFotos().catch(() => []))].sort((a, b) => a.ordem - b.ordem || a.linha - b.linha)) if (!out[f.placa]) out[f.placa] = f.url;
  return out;
}

export const armazenamentoConfigurado = () => !!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.FOTOS_DIR;

async function guardarArquivo(placa: string, arquivo: File): Promise<string> {
  const nome = `${placa}-${Date.now().toString(36)}.${arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg"}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const r = await put(`motos/${nome}`, arquivo, { access: "public", contentType: arquivo.type || "image/jpeg", addRandomSuffix: true });
    return r.url;
  }
  if (process.env.FOTOS_DIR) {
    // uso local/testes: grava em disco e serve por /api/fotos/<nome>
    await fs.mkdir(process.env.FOTOS_DIR, { recursive: true });
    await fs.writeFile(path.join(process.env.FOTOS_DIR, nome), Buffer.from(await arquivo.arrayBuffer()));
    return `/api/fotos/${nome}`;
  }
  throw new Error("Armazenamento de fotos não configurado. Na Vercel: Storage → Blob → conectar ao projeto (cria BLOB_READ_WRITE_TOKEN).");
}

async function garantirAba() {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.fotosAba)) {
    await addSheet(config.appId, config.fotosAba);
    await updateValues(config.appId, range(config.fotosAba, "A1"), [CABECALHO]);
  }
}

export async function adicionarFoto(placa: string, origem: File | string, s: Sessao): Promise<void> {
  const p = clean(placa).toUpperCase();
  let url: string;
  if (typeof origem === "string") {
    url = clean(origem);
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Link inválido: use um endereço que comece com http(s)://");
  } else {
    if (!origem.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
    if (origem.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8 MB).");
    url = await guardarArquivo(p, origem);
  }
  await garantirAba();
  const ordem = (await fotosDaPlaca(p)).length + 1;
  await appendValues(config.appId, range(config.fotosAba, "A1"), [[
    `F${Date.now().toString(36).toUpperCase()}`, p, valorSeguro(url), ordem, new Date().toLocaleString("pt-BR", { timeZone: TZ }), valorSeguro(s.nome),
  ]]);
  invalidate("fotos");
}

export async function removerFoto(id: string): Promise<void> {
  invalidate("fotos");
  const f = (await getFotos()).find((x) => x.id === id);
  if (!f) throw new Error("Foto não encontrada.");
  const sheet = (await listSheets(config.appId)).find((a) => a.title === config.fotosAba)!;
  await batchUpdateSheet(config.appId, [reqExcluirLinha(sheet.sheetId, f.linha - 1)]);
  if (process.env.BLOB_READ_WRITE_TOKEN && /vercel-storage\.com/.test(f.url)) {
    try { const { del } = await import("@vercel/blob"); await del(f.url); } catch { /* o arquivo pode já ter sido removido */ }
  }
  invalidate("fotos");
}

/** Torna a foto a capa (ordem 0). */
export async function definirCapa(id: string): Promise<void> {
  invalidate("fotos");
  const f = (await getFotos()).find((x) => x.id === id);
  if (!f) throw new Error("Foto não encontrada.");
  const { batchUpdateValues } = await import("./google");
  await batchUpdateValues(config.appId, [{ range: range(config.fotosAba, `D${f.linha}`), values: [[0]] }]);
  invalidate("fotos");
}
