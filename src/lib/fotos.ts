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

export type Foto = { id: string; placa: string; url: string; ordem: number; linha: number; enviadoPor: string };

async function load(): Promise<Foto[]> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.fotosAba)) return [];
  const rows = await getValues(config.appId, range(config.fotosAba, "A2:F"));
  return rows
    .map((r, i) => ({ id: clean(r[0] ?? ""), placa: clean(r[1] ?? "").toUpperCase(), url: clean(r[2] ?? ""), ordem: Number(r[3]) || 0, linha: i + 2, enviadoPor: clean(r[5] ?? "") }))
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
  for (const f of [...(await getFotos().catch(() => []))].sort((a, b) => a.ordem - b.ordem || a.linha - b.linha)) if (!out[f.placa]) out[f.placa] = miniatura(f.url);
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

/**
 * Importa do Google Drive: com link (pasta ou arquivo) importa dali; sem link procura
 * a subpasta da placa na pasta configurada. Fotos já importadas são ignoradas.
 */
export async function importarDoDrive(placa: string, link: string | null, s: Sessao): Promise<{ novas: number; achadas: number; pastas: string[] }> {
  const { fotosDaPlacaNoDrive, fotosDoLink, urlDrive, idDeUrlDrive } = await import("./drive");
  const p = clean(placa).toUpperCase();
  const r = link ? { fotos: await fotosDoLink(link), pastas: [] as string[] } : await fotosDaPlacaNoDrive(p);
  invalidate("fotos");
  const atuais = await fotosDaPlaca(p);
  const ja = new Set(atuais.map((f) => idDeUrlDrive(f.url)).filter(Boolean));
  const novas = r.fotos.filter((f) => !ja.has(f.id)).slice(0, 40);
  if (novas.length) {
    await garantirAba();
    const agora = new Date().toLocaleString("pt-BR", { timeZone: TZ });
    const base = Date.now();
    await appendValues(config.appId, range(config.fotosAba, "A1"), novas.map((f, n) => [
      `F${(base + n).toString(36).toUpperCase()}`, p, urlDrive(f.id), atuais.length + n + 1, agora, valorSeguro(`${s.nome} (Drive)`),
    ]));
    invalidate("fotos");
    await contarFotosNaPreparacao(p);
  }
  return { novas: novas.length, achadas: r.fotos.length, pastas: r.pastas };
}

/** Miniatura: fotos do Drive vêm reduzidas pelo app. */
export const miniatura = (url: string, w = 480) => (url.startsWith("/api/drive/") ? `${url}?w=${w}` : url);

export async function adicionarFoto(placa: string, origem: File | string, s: Sessao): Promise<void> {
  const p = clean(placa).toUpperCase();
  let url: string;
  if (typeof origem === "string" && /drive\.google\.com|docs\.google\.com/.test(origem)) {
    const r = await importarDoDrive(p, origem, s);
    if (!r.achadas) throw new Error("Nenhuma imagem encontrada nesse link do Drive.");
    return;
  }
  if (typeof origem === "string") {
    url = clean(origem);
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Link inválido: use um endereço que comece com http(s)://");
  } else {
    if (!origem.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
    if (origem.size > 8 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 8 MB).");
    const drive = await import("./drive");
    if (await drive.pastaConfigurada()) {
      // vai direto para a pasta da moto no Google Drive
      const { motoPorPlaca } = await import("./estoque");
      const modelo = (await motoPorPlaca(p).catch(() => null))?.modelo ?? "";
      url = drive.urlDrive(await drive.enviarFotoParaDrive(p, modelo, origem));
    } else {
      url = await guardarArquivo(p, origem);
    }
  }
  await garantirAba();
  const ordem = (await fotosDaPlaca(p)).length + 1;
  await appendValues(config.appId, range(config.fotosAba, "A1"), [[
    `F${Date.now().toString(36).toUpperCase()}`, p, valorSeguro(url), ordem, new Date().toLocaleString("pt-BR", { timeZone: TZ }), valorSeguro(s.nome),
  ]]);
  invalidate("fotos");
  await contarFotosNaPreparacao(p);
}

/** Mantém "Qtd Fotos Oficiais" da preparação igual ao número de fotos da moto no app. */
export async function contarFotosNaPreparacao(placa: string) {
  try {
    const { getPreparacao, atualizar } = await import("./preparacao");
    const item = (await getPreparacao()).itens.filter((x) => x.placa.toUpperCase() === placa).pop();
    if (!item) return;
    const n = String((await fotosDaPlaca(placa)).length);
    if (item.fotosOficiais !== n) await atualizar(item.id, { fotosOficiais: n });
  } catch (e) { console.error("Não foi possível atualizar a quantidade de fotos", e); }
}

export async function removerFoto(id: string): Promise<void> {
  invalidate("fotos");
  const f = (await getFotos()).find((x) => x.id === id);
  if (!f) throw new Error("Foto não encontrada.");
  const sheet = (await listSheets(config.appId)).find((a) => a.title === config.fotosAba)!;
  await batchUpdateSheet(config.appId, [reqExcluirLinha(sheet.sheetId, f.linha - 1)]);
  // foto enviada pelo app vai para a lixeira do Drive (recuperável); importada de uma pasta fica onde está
  const { idDeUrlDrive, moverParaLixeira } = await import("./drive");
  const idDrive = idDeUrlDrive(f.url);
  if (idDrive && !f.enviadoPor.endsWith("(Drive)")) {
    try { await moverParaLixeira(idDrive); } catch (e) { console.error("Drive: não foi possível mover para a lixeira", e); }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && /vercel-storage\.com/.test(f.url)) {
    try { const { del } = await import("@vercel/blob"); await del(f.url); } catch { /* o arquivo pode já ter sido removido */ }
  }
  invalidate("fotos");
  await contarFotosNaPreparacao(f.placa);
}

/** Grava a ordem das fotos da moto (a 1ª é a capa). `ids` = todas as fotos da placa, na nova ordem. */
export async function reordenarFotos(placa: string, ids: string[]): Promise<void> {
  invalidate("fotos");
  const p = clean(placa).toUpperCase();
  const atuais = await fotosDaPlaca(p);
  const porId = new Map(atuais.map((f) => [f.id, f]));
  if (ids.length !== atuais.length || ids.some((id) => !porId.has(id))) throw new Error("As fotos mudaram enquanto você reordenava. Atualize a página e tente de novo.");
  const { batchUpdateValues } = await import("./google");
  await batchUpdateValues(config.appId, ids.map((id, n) => ({ range: range(config.fotosAba, `D${porId.get(id)!.linha}`), values: [[n + 1]] })));
  invalidate("fotos");
}
