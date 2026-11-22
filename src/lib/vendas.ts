import "server-only";
import { batchClear, batchGet, batchUpdateValues, getFormulas, listSheets, range } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { clean, date, monthKey, num, shortName, yesNo } from "./parse";
import { batchUpdateSheet, colLetra, colunasComFormula, indiceCabecalho, reqCopiarFormulas, valorSeguro } from "./planilha";

/** Situações aceitas. As 3 primeiras são contadas como venda pelo PAINEL GERAL (colunas O..S). */
export const SITUACOES = [
  { id: "ESTOQUE", label: "Vendida · aguardando faturar", conta: true },
  { id: "TRANSFERENCIA", label: "Transferência", conta: true },
  { id: "FATURADO", label: "Faturado", conta: true },
  { id: "CANCELADA", label: "Cancelada (não conta)", conta: false },
] as const;
const CONTA = new Set(["FATURADO", "ESTOQUE", "TRANSFERENCIA"]);

export type Venda = {
  id: string;
  mes: string; // "2026-11" — mês de referência (aba onde foi lançada)
  aba: string;
  linha: number; // linha na planilha (1-based)
  conta: boolean; // entra na contagem de vendas (mesma regra do PAINEL GERAL)
  data: string | null; // ISO
  vendedor: string;
  vendedorCurto: string;
  pedido: string;
  loja: string;
  situacao: string;
  faturada: boolean;
  cliente: string;
  veiculo: string;
  placa: string;
  ge: boolean;
  fin: boolean;
  usado: boolean;
  seguro: string;
  prevFaturamento: string;
  observacoes: string;
};

export type AbaVendas = { aba: string; mes: string; vendas: number };

export type BaseVendas = {
  vendas: Venda[];
  abas: AbaVendas[];
  abasIgnoradas: { aba: string; motivo: string }[];
  objetivos: Record<string, number>; // vendedor (normalizado) -> objetivo mensal
  meses: string[]; // ordenados do mais recente para o mais antigo
  atualizadoEm: string;
};

const norm = (s: string) => clean(s).toUpperCase();

function headerIndex(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const key = norm(h);
    if (key && !map.has(key)) map.set(key, i); // primeira ocorrência (há colunas repetidas)
  });
  return (name: string) => map.get(norm(name)) ?? -1;
}

function parseObjetivos(rows: string[][]): Record<string, number> {
  const out: Record<string, number> = {};
  const start = rows.findIndex((r) => norm(r[0] ?? "") === "OBJETIVO" && norm(r[1] ?? "") === "VENDEDOR");
  if (start < 0) return out;
  for (const r of rows.slice(start + 1)) {
    const vendedor = norm(r[1] ?? "");
    if (!vendedor) break;
    const objetivo = num(r[0]);
    if (objetivo != null) out[vendedor] = objetivo;
  }
  return out;
}

async function load(): Promise<BaseVendas> {
  const sheets = await listSheets(config.vendasId);
  const titles = sheets.map((s) => s.title).filter((t) => norm(t) !== norm(config.painelAba));
  const [painel, ...tabs] = await batchGet(config.vendasId, [
    range(config.painelAba, "A1:L60"),
    ...titles.map((t) => range(t, "A1:N")),
  ]);

  const porMes = new Map<string, { aba: string; vendas: Venda[] }>();
  const abasIgnoradas: BaseVendas["abasIgnoradas"] = [];

  titles.forEach((aba, t) => {
    const rows = tabs[t];
    const hi = rows.slice(0, 6).findIndex((r) => norm(r[0] ?? "") === "DATA");
    if (hi < 0) return abasIgnoradas.push({ aba, motivo: "sem cabeçalho 'Data'" });
    const col = headerIndex(rows[hi]);
    const c = {
      data: col("Data"), vendedor: col("Vendedor"), pedido: col("Pedido"), loja: col("Loja"),
      situacao: col("Situação"), cliente: col("Cliente"), veiculo: col("Veiculo"), placa: col("Placa"),
      ge: col("G.E"), fin: col("FIN"), usado: col("Usado"), seguro: col("SEGURO"),
      prev: col("Prev. Faturamento"), obs: col("Observações"),
    };
    const get = (r: string[], i: number) => (i >= 0 ? clean(r[i]) : "");

    const linhasIdx: number[] = [];
    const linhas = rows.slice(hi + 1).filter((r, i) => {
      const ok = !!(get(r, c.vendedor) || get(r, c.veiculo) || get(r, c.cliente));
      if (ok) linhasIdx.push(hi + 1 + i);
      return ok;
    });
    if (linhas.length === 0) return abasIgnoradas.push({ aba, motivo: "sem vendas lançadas" });

    // mês da aba = mês mais frequente entre as datas lançadas
    const contagem = new Map<string, number>();
    for (const r of linhas) {
      const d = date(get(r, c.data));
      if (d) contagem.set(monthKey(d), (contagem.get(monthKey(d)) ?? 0) + 1);
    }
    const mes = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!mes) return abasIgnoradas.push({ aba, motivo: "datas não reconhecidas" });

    const vendas: Venda[] = linhas.map((r, i) => {
      const d = date(get(r, c.data));
      const vendedor = norm(get(r, c.vendedor)) || "SEM VENDEDOR";
      const situacao = norm(get(r, c.situacao)) || "SEM SITUAÇÃO";
      return {
        id: `${aba}#${linhasIdx[i] + 1}`,
        mes,
        aba,
        linha: linhasIdx[i] + 1,
        conta: CONTA.has(situacao),
        data: d ? d.toISOString() : null,
        vendedor,
        vendedorCurto: shortName(vendedor),
        pedido: get(r, c.pedido),
        loja: norm(get(r, c.loja)) || "—",
        situacao,
        faturada: situacao === "FATURADO",
        cliente: get(r, c.cliente),
        veiculo: get(r, c.veiculo),
        placa: norm(get(r, c.placa)),
        ge: yesNo(get(r, c.ge)),
        fin: yesNo(get(r, c.fin)),
        usado: yesNo(get(r, c.usado)),
        seguro: get(r, c.seguro),
        prevFaturamento: get(r, c.prev),
        observacoes: get(r, c.obs),
      };
    });

    const atual = porMes.get(mes);
    if (!atual || atual.vendas.length < vendas.length) {
      if (atual) abasIgnoradas.push({ aba: atual.aba, motivo: `duplicada de ${mes} (usada a aba "${aba}")` });
      porMes.set(mes, { aba, vendas });
    } else {
      abasIgnoradas.push({ aba, motivo: `duplicada de ${mes} (usada a aba "${atual.aba}")` });
    }
  });

  const meses = [...porMes.keys()].sort().reverse();
  return {
    vendas: meses.flatMap((m) => porMes.get(m)!.vendas),
    abas: meses.map((m) => ({ aba: porMes.get(m)!.aba, mes: m, vendas: porMes.get(m)!.vendas.length })),
    abasIgnoradas,
    objetivos: parseObjetivos(painel),
    meses,
    atualizadoEm: new Date().toISOString(),
  };
}

export function getVendas() {
  return cached("vendas", load);
}

export type LinhaRanking = {
  vendedor: string;
  nome: string;
  vendas: number;
  faturadas: number;
  pendentes: number;
  fin: number;
  ge: number;
  usado: number;
  seguro: number;
  harley: number;
  triumph: number;
  objetivo: number | null;
  atingimento: number | null;
};

const temSeguro = (s: string) => !!s && !/^(n[aã]o|-)$/i.test(s);

export function ranking(vendas: Venda[], objetivos: Record<string, number> = {}, incluirSemVendas = false): LinhaRanking[] {
  const rows = new Map<string, LinhaRanking>();
  const linha = (vendedor: string): LinhaRanking => {
    let r = rows.get(vendedor);
    if (!r) {
      const objetivo = objetivos[vendedor] ?? null;
      r = { vendedor, nome: shortName(vendedor), vendas: 0, faturadas: 0, pendentes: 0, fin: 0, ge: 0, usado: 0, seguro: 0, harley: 0, triumph: 0, objetivo, atingimento: null };
      rows.set(vendedor, r);
    }
    return r;
  };
  if (incluirSemVendas) Object.keys(objetivos).forEach(linha);
  for (const v of vendas) {
    if (!v.conta) continue;
    const r = linha(v.vendedor);
    r.vendas++;
    if (v.faturada) r.faturadas++;
    else r.pendentes++;
    if (v.fin) r.fin++;
    if (v.ge) r.ge++;
    if (v.usado) r.usado++;
    if (temSeguro(v.seguro)) r.seguro++;
    if (v.loja.includes("HARLEY")) r.harley++;
    if (v.loja.includes("TRIUMPH")) r.triumph++;
  }
  for (const r of rows.values()) r.atingimento = r.objetivo ? r.vendas / r.objetivo : null;
  return [...rows.values()].sort((a, b) => b.vendas - a.vendas || b.faturadas - a.faturadas || a.nome.localeCompare(b.nome));
}

export function resumo(todas: Venda[]) {
  const vendas = todas.filter((v) => v.conta);
  const porSituacao = new Map<string, number>();
  const porLoja = new Map<string, number>();
  for (const v of vendas) {
    porSituacao.set(v.situacao, (porSituacao.get(v.situacao) ?? 0) + 1);
    porLoja.set(v.loja, (porLoja.get(v.loja) ?? 0) + 1);
  }
  return {
    total: vendas.length,
    faturadas: vendas.filter((v) => v.faturada).length,
    fin: vendas.filter((v) => v.fin).length,
    ge: vendas.filter((v) => v.ge).length,
    usado: vendas.filter((v) => v.usado).length,
    seguro: vendas.filter((v) => temSeguro(v.seguro)).length,
    porSituacao: [...porSituacao.entries()].sort((a, b) => b[1] - a[1]),
    porLoja: [...porLoja.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type VendaInput = {
  data: string; // dd/mm/aaaa
  vendedor: string;
  pedido: string;
  loja: string;
  situacao: string;
  cliente: string;
  veiculo: string;
  placa: string;
  ge: boolean;
  fin: boolean;
  usado: boolean;
  seguro: string;
  prevFaturamento: string;
  observacoes: string;
};

const CAMPOS_PLANILHA: [keyof VendaInput, string][] = [
  ["data", "Data"], ["vendedor", "Vendedor"], ["pedido", "Pedido"], ["loja", "Loja"], ["situacao", "Situação"],
  ["cliente", "Cliente"], ["veiculo", "Veiculo"], ["placa", "Placa"], ["ge", "G.E"], ["fin", "FIN"], ["usado", "Usado"],
  ["seguro", "SEGURO"], ["prevFaturamento", "Prev. Faturamento"], ["observacoes", "Observações"],
];

const MESES_NOME = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

function paraCelula(campo: keyof VendaInput, v: VendaInput[keyof VendaInput]): string | number {
  if (typeof v === "boolean") return v ? "SIM" : "NÃO";
  const t = clean(String(v ?? ""));
  if (["vendedor", "loja", "situacao", "cliente", "veiculo", "placa"].includes(campo)) return valorSeguro(t.toUpperCase());
  if (campo === "pedido" && /^\d+$/.test(t)) return Number(t);
  return valorSeguro(t);
}

async function lerAbaVendas(aba: string) {
  const rows = (await batchGet(config.vendasId, [range(aba, "A1:N")]))[0];
  const hi = rows.slice(0, 6).findIndex((r) => clean(r[0] ?? "").toUpperCase() === "DATA");
  if (hi < 0) throw new Error(`A aba "${aba}" não tem o cabeçalho "Data".`);
  return { rows, hi, col: indiceCabecalho(rows[hi]) };
}

/** Cria a aba de um mês novo duplicando a aba mais recente (mantém fórmulas e formatação, limpa os lançamentos). */
async function criarAbaDoMes(mes: string, abaModelo: string): Promise<string> {
  const [y, m] = mes.split("-").map(Number);
  const nome = `${MESES_NOME[m - 1]} ${y}`;
  const abas = await listSheets(config.vendasId);
  if (abas.some((a) => a.title === nome)) return nome;
  const modelo = abas.find((a) => a.title === abaModelo);
  if (!modelo) throw new Error(`Aba modelo "${abaModelo}" não encontrada.`);
  const idx = abas.findIndex((a) => a.title === abaModelo);
  await batchUpdateSheet(config.vendasId, [{ duplicateSheet: { sourceSheetId: modelo.sheetId, insertSheetIndex: idx, newSheetName: nome } }]);

  const { hi, rows } = await lerAbaVendas(nome);
  const formulas = await colunasComFormula(config.vendasId, nome, hi + 2, hi + 40);
  const ultimaCol = rows[hi].length - 1;
  const limpar: string[] = [];
  for (let c = 0; c <= ultimaCol; c++) if (!formulas.has(c)) limpar.push(range(nome, `${colLetra(c)}${hi + 2}:${colLetra(c)}`));
  await batchClear(config.vendasId, limpar);
  return nome;
}

export async function lancarVenda(v: VendaInput): Promise<{ aba: string; linha: number }> {
  const d = date(v.data);
  if (!d) throw new Error("Data inválida.");
  invalidate("vendas");
  const base = await getVendas();
  const mes = monthKey(d);
  let aba = base.abas.find((a) => a.mes === mes)?.aba;
  if (!aba) {
    if (!base.abas.length || mes < base.meses[0]) throw new Error(`Não existe aba para ${mes.split("-").reverse().join("/")} na planilha.`);
    aba = await criarAbaDoMes(mes, base.abas[0].aba);
  }

  const { rows, hi, col } = await lerAbaVendas(aba);
  const chave = ["Data", "Vendedor", "Pedido", "Cliente", "Veiculo", "Placa"].map(col).filter((i) => i >= 0);
  let alvo = rows.findIndex((r, i) => i > hi && chave.every((c) => !clean(r[c] ?? "")));
  if (alvo < 0) alvo = Math.max(rows.length, hi + 1);
  const linha = alvo + 1;

  // nunca escreve em colunas de fórmula; se a linha nova não tiver as fórmulas, copia da linha de cima
  const formulas = await colunasComFormula(config.vendasId, aba, hi + 2, Math.max(hi + 2, linha - 1));
  const alvoFormulas = (await getFormulas(config.vendasId, range(aba, `A${linha}:AZ${linha}`)))[0] ?? [];
  const faltando = [...formulas].filter((c) => !(alvoFormulas[c] ?? "").startsWith("="));
  if (faltando.length && linha - 1 > hi + 1) {
    const sheet = (await listSheets(config.vendasId)).find((a) => a.title === aba)!;
    await batchUpdateSheet(config.vendasId, reqCopiarFormulas(sheet.sheetId, linha - 2, linha - 1, faltando));
  }

  const data = CAMPOS_PLANILHA.map(([k, nome]) => [col(nome), paraCelula(k, v[k])] as const)
    .filter(([c]) => c >= 0 && !formulas.has(c))
    .map(([c, val]) => ({ range: range(aba!, `${colLetra(c)}${linha}`), values: [[val]] }));
  await batchUpdateValues(config.vendasId, data);
  invalidate("vendas");
  return { aba, linha };
}

export type Original = { vendedor: string; veiculo: string; pedido: string };

async function conferirLinha(aba: string, linha: number, original: Original) {
  const { rows, col } = await lerAbaVendas(aba);
  const r = rows[linha - 1] ?? [];
  const g = (n: string) => clean(r[col(n)] ?? "").toUpperCase();
  if (g("Vendedor") !== clean(original.vendedor).toUpperCase() || g("Veiculo") !== clean(original.veiculo).toUpperCase() || g("Pedido") !== clean(original.pedido).toUpperCase()) {
    throw new Error("Esta venda foi alterada ou movida na planilha. Atualize a página e tente de novo.");
  }
  return { r, col };
}

export async function editarVenda(aba: string, linha: number, original: Original, v: VendaInput) {
  const { r, col } = await conferirLinha(aba, linha, original);
  const formulas = await colunasComFormula(config.vendasId, aba, linha, linha);
  const data = CAMPOS_PLANILHA.map(([k, nome]) => [col(nome), paraCelula(k, v[k])] as const)
    .filter(([c, val]) => c >= 0 && !formulas.has(c) && clean(r[c] ?? "") !== clean(String(val)))
    .map(([c, val]) => ({ range: range(aba, `${colLetra(c)}${linha}`), values: [[val]] }));
  await batchUpdateValues(config.vendasId, data);
  invalidate("vendas");
}

export async function excluirVenda(aba: string, linha: number, original: Original) {
  const { col } = await conferirLinha(aba, linha, original);
  const formulas = await colunasComFormula(config.vendasId, aba, linha, linha);
  const cols = CAMPOS_PLANILHA.map(([, nome]) => col(nome)).filter((c) => c >= 0 && !formulas.has(c));
  await batchClear(config.vendasId, cols.map((c) => range(aba, `${colLetra(c)}${linha}`)));
  invalidate("vendas");
}

export async function listaVendedores(): Promise<string[]> {
  const base = await getVendas();
  const recentes = new Set(base.meses.slice(0, 3));
  const nomes = new Set<string>(Object.keys(base.objetivos));
  base.vendas.filter((v) => recentes.has(v.mes) && v.vendedor !== "SEM VENDEDOR").forEach((v) => nomes.add(v.vendedor));
  return [...nomes].sort();
}
