import "server-only";
import { batchGet, batchUpdateValues, getFormulas, listSheets, range } from "./google";
import { cached, invalidate } from "./cache";
import { batchUpdateSheet, colLetra, colunasComFormula, indiceCabecalho, reqCopiarFormulas, reqExcluirLinha, reqInserirLinha, valorSeguro } from "./planilha";
import { config } from "./config";
import { getCatalogo } from "./catalogo";
import { identificar, TIPOS } from "./motos";
import { clean, date, daysBetween, hoje as hojeSP, num, title } from "./parse";
import { garantirColunas } from "./planilha";

export type Moto = {
  id: string;
  aba: string;
  linha: number; // linha na planilha (1-based)
  empresa: string;
  marca: "HARLEY" | "TRIUMPH" | "OUTRA"; // bandeira da loja (Freedom/Harley ou Triumph)
  fabricante: string; // marca da moto (coluna "Marca" ou identificada pelo catálogo)
  tipo: string; // Big Trail, Custom… (coluna "Tipo" ou catálogo)
  segmento: string; // grupo de equivalência do catálogo
  catalogoId: string | null;
  cidade: string;
  placa: string;
  modelo: string;
  km: number | null;
  ano: string;
  cor: string;
  dataEntrada: string | null;
  dias: number | null;
  custo: number | null;
  ultimoValorVenda: number | null;
  fipe: number | null;
  realinhamento: number | null; // preço de venda atual
  status: string;
  anunciada: boolean;
  observacao: string;
};

const norm = (s: string) => clean(s).toUpperCase();

function cidade(empresa: string, aba: string): string {
  const s = norm(`${empresa} ${aba}`);
  if (/CTBA|CURITIBA/.test(s)) return "Curitiba";
  if (/LND|LDNA|LOND/.test(s)) return "Londrina";
  return "—";
}

function marca(empresa: string): Moto["marca"] {
  const s = norm(empresa);
  if (s.includes("TRIUMPH")) return "TRIUMPH";
  if (s.includes("FREEDOM") || s.includes("HARLEY")) return "HARLEY";
  return "OUTRA";
}

function statusNormalizado(s: string): { status: string; anunciada: boolean } {
  const v = norm(s);
  if (!v) return { status: "SEM STATUS", anunciada: false };
  if (/^(N[AÃ]O|SEM) ANUNCI/.test(v)) return { status: "NÃO ANUNCIADO", anunciada: false };
  if (/^ANUNCIAD/.test(v)) return { status: "ANUNCIADO", anunciada: true };
  return { status: v, anunciada: false };
}

async function load(): Promise<{ motos: Moto[]; atualizadoEm: string }> {
  const [tabs, { modelos: catalogo }] = await Promise.all([
    batchGet(config.estoqueId, config.estoqueAbas.map((a) => range(a, "A1:Z"))),
    getCatalogo().catch(() => ({ modelos: [] })),
  ]);
  const hoje = hojeSP();
  const tipoCanon = (t: string) => TIPOS.find((x) => x.toUpperCase() === t.toUpperCase()) ?? title(t);
  const motos: Moto[] = [];

  config.estoqueAbas.forEach((aba, t) => {
    const [header = [], ...rows] = tabs[t];
    const idx = new Map(header.map((h, i) => [norm(h), i]));
    const g = (r: string[], name: string) => clean(r[idx.get(norm(name)) ?? -1]);

    rows.forEach((r, i) => {
      const placa = norm(g(r, "Placa"));
      const modelo = g(r, "Modelo");
      if (!placa && !modelo) return;
      const empresa = norm(g(r, "Empresa"));
      const entrada = date(g(r, "Data Entrada"));
      const st = statusNormalizado(g(r, "Status"));
      const marcaCol = g(r, "Marca");
      const cat = identificar(catalogo, `${marcaCol} ${modelo}`, marcaCol);
      motos.push({
        id: `${aba}#${i + 2}`,
        aba,
        linha: i + 2,
        empresa,
        marca: marca(empresa),
        fabricante: marcaCol ? (catalogo.find((c) => c.marca.toUpperCase() === marcaCol.toUpperCase())?.marca ?? title(marcaCol)) : cat?.marca ?? "",
        tipo: g(r, "Tipo") ? tipoCanon(g(r, "Tipo")) : cat?.tipo ?? "",
        segmento: cat?.segmento ?? "",
        catalogoId: cat?.id ?? null,
        cidade: cidade(empresa, aba),
        placa,
        modelo: modelo.toUpperCase(),
        km: num(g(r, "Km")),
        ano: g(r, "Ano Modelo"),
        cor: norm(g(r, "Cor")),
        dataEntrada: entrada ? entrada.toISOString() : null,
        // calcula na hora a partir da data de entrada; se não houver, usa a coluna da planilha
        dias: entrada ? daysBetween(entrada, hoje) : num(g(r, "Dias Estoque")),
        custo: num(g(r, "Custo Presente")),
        ultimoValorVenda: num(g(r, "Último Valor Venda")),
        fipe: num(g(r, "Fipe")),
        realinhamento: num(g(r, "Realinhamento")),
        status: st.status,
        anunciada: st.anunciada,
        observacao: g(r, "Observação"),
      });
    });
  });

  motos.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return { motos, atualizadoEm: new Date().toISOString() };
}

export function getEstoque() {
  return cached("estoque", load);
}

export const FAIXAS = [
  { id: "0-30", label: "Até 30 dias", min: 0, max: 30 },
  { id: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
  { id: "61-90", label: "61 a 90 dias", min: 61, max: 90 },
  { id: "90+", label: "Mais de 90 dias", min: 91, max: Infinity },
] as const;

export function faixa(dias: number | null) {
  if (dias == null) return null;
  return FAIXAS.find((f) => dias >= f.min && dias <= f.max) ?? null;
}

/** Remove dados financeiros sensíveis para perfis que não são gestor. */
export function semCusto(m: Moto): Moto {
  return { ...m, custo: null, ultimoValorVenda: null };
}

// ---------------------------------------------------------------------------
// Escrita (gestor)
// ---------------------------------------------------------------------------

export type MotoInput = {
  empresa: string; placa: string; modelo: string; km: string; ano: string; cor: string; dataEntrada: string;
  custo: string; ultimoValorVenda: string; fipe: string; realinhamento: string; status: string; observacao: string;
  fabricante?: string; tipo?: string;
};

const CAMPOS: [keyof MotoInput, string, "texto" | "numero" | "data"][] = [
  ["empresa", "Empresa", "texto"], ["placa", "Placa", "texto"], ["modelo", "Modelo", "texto"], ["km", "Km", "numero"],
  ["ano", "Ano Modelo", "texto"], ["cor", "Cor", "texto"], ["dataEntrada", "Data Entrada", "data"],
  ["custo", "Custo Presente", "numero"], ["ultimoValorVenda", "Último Valor Venda", "numero"], ["fipe", "Fipe", "numero"],
  ["realinhamento", "Realinhamento", "numero"], ["status", "Status", "texto"], ["observacao", "Observação", "texto"],
  ["fabricante", "Marca", "texto"], ["tipo", "Tipo", "texto"],
];

function celula(tipo: "texto" | "numero" | "data", v: string): string | number {
  const t = clean(v);
  if (!t) return "";
  if (tipo === "numero") return num(t) ?? valorSeguro(t);
  if (tipo === "texto") return valorSeguro(t.toUpperCase());
  return t;
}

const comparavel = (tipo: "texto" | "numero" | "data", v: string) => (tipo === "numero" ? String(num(v) ?? "") : clean(v).toUpperCase());

/** Cria (linha = null) ou atualiza uma moto. Nunca grava nas colunas de fórmula (ex.: Dias Estoque). */
export async function salvarMoto(aba: string, linha: number | null, placaOriginal: string | null, m: MotoInput): Promise<number> {
  if (!config.estoqueAbas.includes(aba)) throw new Error("Loja inválida.");
  if (m.fabricante || m.tipo) await garantirColunas(config.estoqueId, aba, ["Marca", "Tipo"]);
  const rows = (await batchGet(config.estoqueId, [range(aba, "A1:Z")]))[0];
  const col = indiceCabecalho(rows[0] ?? []);
  const formulas = await colunasComFormula(config.estoqueId, aba, 2, Math.max(2, rows.length));
  const sheet = (await listSheets(config.estoqueId)).find((a) => a.title === aba)!;

  let alvo: number; // 1-based
  const novo = linha == null;
  if (novo) {
    const livre = rows.findIndex((r, i) => i > 0 && !clean(r[col("Placa")] ?? "") && !clean(r[col("Modelo")] ?? ""));
    if (livre > 0) alvo = livre + 1;
    else {
      // aba cheia: insere uma linha no fim (herda a formatação)
      alvo = rows.length + 1;
      if (alvo > sheet.rowCount) await batchUpdateSheet(config.estoqueId, [reqInserirLinha(sheet.sheetId, sheet.rowCount)]);
    }
    // copia as fórmulas (ex.: =TODAY()-G) da última linha preenchida
    const fonte = [...rows.keys()].reverse().find((i) => i > 0 && i < alvo - 1 && clean(rows[i][col("Placa")] ?? ""));
    const alvoF = (await getFormulas(config.estoqueId, range(aba, `A${alvo}:AZ${alvo}`)))[0] ?? [];
    const faltando = [...formulas].filter((c) => !(alvoF[c] ?? "").startsWith("="));
    if (fonte != null && faltando.length) await batchUpdateSheet(config.estoqueId, reqCopiarFormulas(sheet.sheetId, fonte, alvo - 1, faltando));
  } else {
    alvo = linha;
    const atual = clean(rows[alvo - 1]?.[col("Placa")] ?? "").toUpperCase();
    if (atual !== clean(placaOriginal ?? "").toUpperCase()) throw new Error("Esta moto foi alterada ou movida na planilha. Atualize a página e tente de novo.");
  }

  const r = novo ? [] : rows[alvo - 1] ?? [];
  const data = CAMPOS.map(([k, nome, tipo]) => ({ c: col(nome), tipo, v: m[k], k }))
    .filter((x): x is { c: number; tipo: "texto" | "numero" | "data"; v: string; k: keyof MotoInput } => x.v !== undefined)
    .filter(({ c, tipo, v }) => c >= 0 && !formulas.has(c) && (novo ? clean(v) !== "" : comparavel(tipo, r[c] ?? "") !== comparavel(tipo, v)))
    .map(({ c, tipo, v }) => ({ range: range(aba, `${colLetra(c)}${alvo}`), values: [[celula(tipo, v)]] }));
  await batchUpdateValues(config.estoqueId, data);
  invalidate("estoque");
  return alvo;
}

/** Remove a linha da moto (ex.: vendida). Confere a placa antes para não apagar a linha errada. */
export async function removerMoto(aba: string, linha: number, placa: string) {
  const rows = (await batchGet(config.estoqueId, [range(aba, "A1:N")]))[0];
  const col = indiceCabecalho(rows[0] ?? []);
  if (clean(rows[linha - 1]?.[col("Placa")] ?? "").toUpperCase() !== clean(placa).toUpperCase()) {
    throw new Error("Esta moto foi alterada ou movida na planilha. Atualize a página e tente de novo.");
  }
  const sheet = (await listSheets(config.estoqueId)).find((a) => a.title === aba)!;
  await batchUpdateSheet(config.estoqueId, [reqExcluirLinha(sheet.sheetId, linha - 1)]);
  invalidate("estoque");
}

export async function getMoto(aba: string, linha: number) {
  const { motos } = await getEstoque();
  return motos.find((m) => m.aba === aba && m.linha === linha) ?? null;
}

export async function empresasPorAba(): Promise<Record<string, string[]>> {
  const { motos } = await getEstoque();
  const out: Record<string, string[]> = Object.fromEntries(config.estoqueAbas.map((a) => [a, []]));
  for (const m of motos) if (m.empresa && !out[m.aba]?.includes(m.empresa)) out[m.aba]?.push(m.empresa);
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}

/** Atualiza o status de uma moto pela placa (ex.: preparação finalizada → ANUNCIADO). */
export async function atualizarStatusPorPlaca(placa: string, status: string): Promise<boolean> {
  invalidate("estoque");
  const { motos } = await getEstoque();
  const m = motos.find((x) => x.placa === clean(placa).toUpperCase());
  if (!m) return false;
  const rows = (await batchGet(config.estoqueId, [range(m.aba, "A1:Z")]))[0];
  const col = indiceCabecalho(rows[0] ?? []);
  if (clean(rows[m.linha - 1]?.[col("Placa")] ?? "").toUpperCase() !== m.placa || col("Status") < 0) return false;
  await batchUpdateValues(config.estoqueId, [{ range: range(m.aba, `${colLetra(col("Status"))}${m.linha}`), values: [[status]] }]);
  invalidate("estoque");
  return true;
}

export async function motoPorPlaca(placa: string) {
  const { motos } = await getEstoque();
  return motos.find((x) => x.placa === clean(placa).toUpperCase()) ?? null;
}
