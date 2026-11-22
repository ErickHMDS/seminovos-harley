import "server-only";
import base from "@/data/catalogo-base.json";
import { addSheet, appendValues, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { clean } from "./parse";
import { batchUpdateSheet, colLetra, indiceCabecalho, reqExcluirLinha, valorSeguro } from "./planilha";
import { segmentoPadrao, type ModeloCat } from "./motos";

const CABECALHO = ["ID", "Marca", "Modelo", "Tipo", "Cilindrada", "Ano Início", "Ano Fim", "Segmento", "Apelidos"];

type Base = { marca: string; modelo: string; tipo: string; cc: number | null; anoIni: number | null; anoFim: number | null; apelidos?: string[]; segmento?: string };

function daBase(): ModeloCat[] {
  return (base as Base[]).map((b, i) => ({
    id: `B${i}`, marca: b.marca, modelo: b.modelo, tipo: b.tipo, cc: b.cc ?? null, anoIni: b.anoIni ?? null, anoFim: b.anoFim ?? null,
    segmento: b.segmento || segmentoPadrao(b.tipo, b.cc), apelidos: b.apelidos ?? [],
  }));
}

const int = (v: string) => { const n = parseInt(clean(v).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };

async function load(): Promise<{ modelos: ModeloCat[]; fonte: "planilha" | "base" }> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.catalogoAba)) return { modelos: daBase(), fonte: "base" };
  const [header = [], ...rows] = await getValues(config.appId, range(config.catalogoAba, "A1:Z"));
  const col = indiceCabecalho(header);
  const g = (r: string[], n: string) => clean(r[col(n)] ?? "");
  const modelos = rows
    .map((r, i) => {
      const tipo = g(r, "Tipo"), cc = int(g(r, "Cilindrada"));
      return {
        id: g(r, "ID") || `L${i + 2}`, marca: g(r, "Marca"), modelo: g(r, "Modelo"), tipo, cc,
        anoIni: int(g(r, "Ano Início")), anoFim: int(g(r, "Ano Fim")),
        segmento: g(r, "Segmento") || segmentoPadrao(tipo, cc),
        apelidos: g(r, "Apelidos").split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      };
    })
    .filter((m) => m.marca && m.modelo);
  return { modelos, fonte: "planilha" };
}

export function getCatalogo() {
  return cached("catalogo", load);
}

const linhaDe = (m: Omit<ModeloCat, "id">, id: string): (string | number)[] => [
  id, valorSeguro(m.marca), valorSeguro(m.modelo), m.tipo, m.cc ?? "", m.anoIni ?? "", m.anoFim ?? "",
  valorSeguro(m.segmento), valorSeguro(m.apelidos.join(", ")),
];

/** Grava o catálogo base numa aba nova da planilha (uma vez). */
export async function gravarBaseNaPlanilha() {
  const abas = await listSheets(config.appId);
  if (abas.some((a) => a.title === config.catalogoAba)) return;
  await addSheet(config.appId, config.catalogoAba);
  const linhas = daBase().map((m, i) => linhaDe(m, `M${String(i + 1).padStart(4, "0")}`));
  await updateValues(config.appId, range(config.catalogoAba, "A1"), [CABECALHO, ...linhas]);
  invalidate("catalogo");
}

async function localizar(id: string) {
  const [header = [], ...rows] = await getValues(config.appId, range(config.catalogoAba, "A1:Z"));
  const col = indiceCabecalho(header);
  const n = rows.findIndex((r, i) => (clean(r[col("ID")] ?? "") || `L${i + 2}`) === id);
  if (n < 0) throw new Error("Modelo não encontrado no catálogo (pode ter sido removido na planilha).");
  return { linha: n + 2, header, col };
}

export async function salvarModelo(id: string | null, m: Omit<ModeloCat, "id">): Promise<string> {
  await gravarBaseNaPlanilha();
  if (!id) {
    const novoId = `M${Date.now().toString(36).toUpperCase()}`;
    await appendValues(config.appId, range(config.catalogoAba, "A1"), [linhaDe(m, novoId)]);
    invalidate("catalogo");
    return novoId;
  }
  const { linha, col } = await localizar(id);
  const valores = linhaDe(m, id.startsWith("L") ? `M${Date.now().toString(36).toUpperCase()}` : id);
  const data = CABECALHO.map((nome, i) => ({ c: col(nome), v: valores[i] }))
    .filter(({ c }) => c >= 0)
    .map(({ c, v }) => ({ range: range(config.catalogoAba, `${colLetra(c)}${linha}`), values: [[v]] }));
  await batchUpdateValues(config.appId, data);
  invalidate("catalogo");
  return id;
}

export async function excluirModelo(id: string) {
  const { linha } = await localizar(id);
  const sheet = (await listSheets(config.appId)).find((a) => a.title === config.catalogoAba)!;
  await batchUpdateSheet(config.appId, [reqExcluirLinha(sheet.sheetId, linha - 1)]);
  invalidate("catalogo");
}
