import "server-only";
import { batchGet, batchUpdateValues, getValues, listSheets, range } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { clean, date, hojeISO, monthKey, num, shortName, yesNo } from "./parse";
import { colLetra, valorSeguro } from "./planilha";

/**
 * Planilha de vendas (MOTOS 2026) no formato novo:
 * - aba VENDAS: todas as vendas do ano, uma linha por venda (sem fórmulas), colunas A..O;
 * - aba EQUIPE: vendedor, objetivo do mês e ativo (SIM/NÃO) — fonte das metas e dos nomes;
 * - aba PAINEL GERAL: fórmulas que filtram o mês pela célula L3 (lida pela central do regional).
 * O app não cria abas nem mexe nas fórmulas; só grava linhas na aba VENDAS, metas na EQUIPE
 * e, na virada do mês, a data de referência em PAINEL GERAL!L3 (o passo que antes era manual).
 */

/** Situações da lista da planilha. Contam como venda: FATURADO, ESTOQUE e TRANSFERENCIA. */
export const SITUACOES = [
  { id: "ESTOQUE", label: "Vendida · aguardando faturar", conta: true },
  { id: "TRANSFERENCIA", label: "Transferência", conta: true },
  { id: "FATURADO", label: "Faturado", conta: true },
  { id: "CANCELADO", label: "Cancelado (não conta)", conta: false },
] as const;
const CONTA = new Set(["FATURADO", "ESTOQUE", "TRANSFERENCIA"]);

export type Venda = {
  id: string;
  mes: string; // "2026-11" — mês da DATA DA VENDA ("" se a linha não tem data)
  aba: string;
  linha: number; // linha na planilha (1-based)
  conta: boolean; // entra na contagem (mesma regra do PAINEL GERAL)
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
  usado: boolean; // TRADE-IN
  seguro: boolean;
  prevFaturamento: string;
  dataFaturamento: string;
  observacoes: string;
  historico?: boolean; // vem da aba de histórico (anos anteriores) — só leitura
};

export type AbaVendas = { aba: string; mes: string; vendas: number };
export type MembroEquipe = { nome: string; objetivo: number; ativo: boolean; linha: number };

export type BaseVendas = {
  vendas: Venda[];
  abas: AbaVendas[]; // um item por mês (todos na aba VENDAS) — mantido por compatibilidade
  abasIgnoradas: { aba: string; motivo: string }[];
  objetivos: Record<string, number>; // vendedor ativo da EQUIPE -> objetivo do mês
  equipe: MembroEquipe[];
  semData: number; // linhas com dados mas sem DATA DA VENDA (não entram em mês nenhum)
  meses: string[]; // do mais recente (mês atual) para o mais antigo
  atualizadoEm: string;
};

export const META_PADRAO = 10;
const norm = (s: string) => clean(s).toUpperCase();
const semAcento = (s: string) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Colunas da aba VENDAS (nome do cabeçalho, sem acento). */
const COLUNAS = {
  data: "DATA DA VENDA", vendedor: "VENDEDOR", pedido: "PEDIDO", loja: "LOJA DE ORIGEM DO CARRO", situacao: "SITUACAO",
  cliente: "CLIENTE", veiculo: "VEICULO", placa: "PLACA", usado: "TRADE-IN", fin: "FINANCIAMENTO", ge: "GARANTIA ESTENDIDA",
  seguro: "SEGURO", prevFaturamento: "PREVISAO DE FATURAMENTO", dataFaturamento: "DATA DO FATURAMENTO", observacoes: "OBSERVACAO",
} as const;
type Campo = keyof typeof COLUNAS;

function indices(header: string[]): Record<Campo, number> {
  const mapa = new Map(header.map((h, i) => [semAcento(h), i]));
  const out = {} as Record<Campo, number>;
  for (const [k, nome] of Object.entries(COLUNAS) as [Campo, string][]) out[k] = mapa.get(nome) ?? -1;
  return out;
}

async function lerVendasBruto() {
  const rows = await getValues(config.vendasId, range(config.vendasAba, "A1:O"));
  const hi = rows.slice(0, 5).findIndex((r) => semAcento(r[0] ?? "").startsWith("DATA"));
  if (hi < 0) throw new Error(`A aba "${config.vendasAba}" não tem o cabeçalho "DATA DA VENDA".`);
  const idx = indices(rows[hi]);
  if (idx.vendedor < 0 || idx.situacao < 0) throw new Error(`A aba "${config.vendasAba}" mudou: faltam as colunas VENDEDOR/SITUAÇÃO.`);
  return { rows, hi, idx };
}

function lerEquipe(rows: string[][]): MembroEquipe[] {
  const out: MembroEquipe[] = [];
  rows.forEach((r, i) => {
    if (i === 0 && semAcento(r[0] ?? "").startsWith("VENDEDOR")) return;
    const nome = norm(r[0] ?? "");
    if (!nome) return;
    const objetivo = num(r[1] ?? "");
    out.push({ nome, objetivo: objetivo && objetivo > 0 ? objetivo : META_PADRAO, ativo: !/^N/i.test(semAcento(r[2] ?? "SIM")), linha: i + 1 });
  });
  return out;
}

/** Vendas de anos anteriores, importadas das abas antigas para a planilha do app (aba "Histórico Vendas"). */
async function lerHistorico(): Promise<string[][]> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.historicoVendasAba)) return [];
  return getValues(config.appId, range(config.historicoVendasAba, "A1:Q"));
}

function vendaDaLinha(r: string[], idx: Record<Campo, number>, aba: string, linha: number, mesFixo = ""): Venda | null {
  const g = (c: Campo) => (idx[c] >= 0 ? clean(r[idx[c]] ?? "") : "");
  if (!(g("vendedor") || g("veiculo") || g("cliente"))) return null;
  const d = date(g("data"));
  const vendedor = norm(g("vendedor")) || "SEM VENDEDOR";
  let situacao = norm(g("situacao")) || "SEM SITUAÇÃO";
  if (situacao === "CANCELADA") situacao = "CANCELADO";
  return {
    id: `${aba}#${linha}`, mes: d ? monthKey(d) : mesFixo, aba, linha,
    conta: CONTA.has(situacao), data: d ? d.toISOString() : null, vendedor, vendedorCurto: shortName(vendedor),
    pedido: g("pedido"), loja: norm(g("loja")) || "—", situacao, faturada: situacao === "FATURADO",
    cliente: g("cliente"), veiculo: g("veiculo"), placa: norm(g("placa")),
    ge: yesNo(g("ge")), fin: yesNo(g("fin")), usado: yesNo(g("usado")), seguro: yesNo(g("seguro")),
    prevFaturamento: g("prevFaturamento"), dataFaturamento: g("dataFaturamento"), observacoes: g("observacoes"),
  };
}

async function load(): Promise<BaseVendas> {
  const [{ rows, hi, idx }, [equipeRows], histRows] = await Promise.all([
    lerVendasBruto(),
    batchGet(config.vendasId, [range(config.equipeAba, "A1:C60")]).catch(() => [[]] as string[][][]),
    lerHistorico().catch((e) => { console.error("[vendas] histórico não lido", e); return [] as string[][]; }),
  ]);
  const equipe = lerEquipe(equipeRows ?? []);
  const vendas: Venda[] = [];
  let semData = 0;
  rows.forEach((r, i) => {
    if (i <= hi) return;
    const v = vendaDaLinha(r, idx, config.vendasAba, i + 1);
    if (!v) return;
    if (!v.data) semData++;
    vendas.push(v);
  });
  if (histRows.length > 1) {
    const hidx = indices(histRows[0]);
    const iMes = histRows[0].findIndex((h) => semAcento(h) === "MES");
    histRows.forEach((r, i) => {
      if (i === 0) return;
      const mes = iMes >= 0 && /^\d{4}-\d{2}$/.test(clean(r[iMes])) ? clean(r[iMes]) : "";
      const v = vendaDaLinha(r, hidx, config.historicoVendasAba, i + 1, mes);
      if (v) vendas.push({ ...v, historico: true });
    });
  }

  // meses: o do calendário (mesmo sem vendas) e os anteriores que têm vendas; mês futuro só aparece quando começar
  const mesAtual = hojeISO().slice(0, 7);
  const meses = [...new Set([mesAtual, ...vendas.map((v) => v.mes).filter(Boolean)])].filter((m) => m <= mesAtual).sort().reverse();
  const objetivos: Record<string, number> = {};
  for (const m of equipe) if (m.ativo) objetivos[m.nome] = m.objetivo;
  return {
    vendas: [...vendas].sort((a, b) => b.mes.localeCompare(a.mes) || (b.data ?? "").localeCompare(a.data ?? "") || b.linha - a.linha),
    abas: meses.map((mes) => ({ aba: vendas.find((v) => v.mes === mes)?.aba ?? config.vendasAba, mes, vendas: vendas.filter((v) => v.mes === mes).length })),
    abasIgnoradas: [],
    objetivos,
    equipe,
    semData,
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
    if (v.seguro) r.seguro++;
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
    seguro: vendas.filter((v) => v.seguro).length,
    porSituacao: [...porSituacao.entries()].sort((a, b) => b[1] - a[1]),
    porLoja: [...porLoja.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ---------------------------------------------------------------------------
// Escrita (somente células de digitação da aba VENDAS)
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
  seguro: boolean;
  prevFaturamento: string; // dd/mm/aaaa ou ""
  dataFaturamento: string; // dd/mm/aaaa ou ""
  observacoes: string;
};

const hojeBR = () => hojeISO().split("-").reverse().join("/");

function paraCelula(campo: Campo, v: VendaInput[keyof VendaInput]): string | number {
  if (typeof v === "boolean") return v ? "SIM" : "NÃO";
  const t = clean(String(v ?? ""));
  if (["vendedor", "loja", "situacao", "cliente", "veiculo", "placa"].includes(campo)) return valorSeguro(t.toUpperCase());
  if (campo === "pedido" && /^\d+$/.test(t)) return Number(t);
  return valorSeguro(t); // datas vão como "dd/mm/aaaa": a planilha (pt_BR) grava como data
}

async function validar(v: VendaInput) {
  if (!SITUACOES.some((s) => s.id === v.situacao)) throw new Error("Situação inválida.");
  const base = await getVendas();
  const membro = base.equipe.find((m) => m.nome === norm(v.vendedor));
  if (!membro) throw new Error(`"${v.vendedor}" não está na aba EQUIPE da planilha de vendas. Cadastre lá primeiro.`);
  for (const [nome, d] of [["data da venda", v.data], ["previsão de faturamento", v.prevFaturamento], ["data do faturamento", v.dataFaturamento]] as const) {
    if (d && !date(d)) throw new Error(`Data inválida em ${nome}.`);
  }
  // instrução da planilha: venda faturada leva a DATA DO FATURAMENTO
  if (v.situacao === "FATURADO" && !v.dataFaturamento) v.dataFaturamento = hojeBR();
}

function celulas(idx: Record<Campo, number>, linha: number, v: VendaInput, atual?: string[]) {
  return (Object.keys(COLUNAS) as Campo[])
    .filter((k) => idx[k] >= 0)
    .map((k) => [k, paraCelula(k, v[k as keyof VendaInput])] as const)
    .filter(([k, val]) => !atual || clean(atual[idx[k]] ?? "") !== clean(String(val)))
    .map(([k, val]) => ({ range: range(config.vendasAba, `${colLetra(idx[k])}${linha}`), values: [[val]] }));
}

export async function lancarVenda(v: VendaInput): Promise<{ aba: string; linha: number }> {
  if (!date(v.data)) throw new Error("Data inválida.");
  invalidate("vendas");
  await validar(v);
  const { rows, hi, idx } = await lerVendasBruto();
  const chave = (["data", "vendedor", "pedido", "cliente", "veiculo", "placa", "situacao"] as Campo[]).map((k) => idx[k]).filter((i) => i >= 0);
  let alvo = rows.findIndex((r, i) => i > hi && chave.every((c) => !clean(r[c] ?? "")));
  if (alvo < 0) alvo = Math.max(rows.length, hi + 1);
  const linha = alvo + 1;
  await batchUpdateValues(config.vendasId, celulas(idx, linha, v));
  invalidate("vendas");
  return { aba: config.vendasAba, linha };
}

export type Original = { vendedor: string; veiculo: string; pedido: string };

async function conferirLinha(linha: number, original: Original) {
  const { rows, idx } = await lerVendasBruto();
  const r = rows[linha - 1] ?? [];
  const g = (k: Campo) => (idx[k] >= 0 ? norm(r[idx[k]] ?? "") : "");
  if (g("vendedor") !== norm(original.vendedor) || g("veiculo") !== norm(original.veiculo) || g("pedido") !== norm(original.pedido)) {
    throw new Error("Esta venda foi alterada ou movida na planilha. Atualize a página e tente de novo.");
  }
  return { r, idx };
}

function soAbaVendas(aba: string) {
  if (aba !== config.vendasAba) throw new Error("Vendas do histórico (anos anteriores) são só para consulta.");
}

export async function editarVenda(aba: string, linha: number, original: Original, v: VendaInput) {
  soAbaVendas(aba);
  invalidate("vendas");
  await validar(v);
  const { r, idx } = await conferirLinha(linha, original);
  await batchUpdateValues(config.vendasId, celulas(idx, linha, v, r));
  invalidate("vendas");
}

/** Instrução da planilha: venda desfeita não se apaga — a SITUAÇÃO vira CANCELADO. */
export async function excluirVenda(aba: string, linha: number, original: Original) {
  soAbaVendas(aba);
  const { idx } = await conferirLinha(linha, original);
  await batchUpdateValues(config.vendasId, [{ range: range(config.vendasAba, `${colLetra(idx.situacao)}${linha}`), values: [["CANCELADO"]] }]);
  invalidate("vendas");
}

/** Vendedores para lançar venda: os ativos da aba EQUIPE. */
export async function listaVendedores(): Promise<string[]> {
  const base = await getVendas();
  return base.equipe.filter((m) => m.ativo).map((m) => m.nome).sort();
}

/** Atualiza o OBJETIVO DO MÊS de um vendedor na aba EQUIPE (permitido pelas instruções da planilha). */
export async function salvarMetaEquipe(vendedor: string, meta: number): Promise<void> {
  invalidate("vendas");
  const base = await getVendas();
  const m = base.equipe.find((x) => x.nome === norm(vendedor));
  if (!m) throw new Error(`"${vendedor}" não está na aba EQUIPE.`);
  if (m.objetivo === meta) return;
  await batchUpdateValues(config.vendasId, [{ range: range(config.equipeAba, `B${m.linha}`), values: [[meta]] }]);
  invalidate("vendas");
}

/**
 * Virada de mês (agendador diário da Vercel): nos 3 primeiros dias do mês, se a data de referência
 * do PAINEL GERAL (L3) ainda for de outro mês, troca para o dia 1º do mês atual — exatamente o passo
 * que a aba INSTRUÇÕES manda fazer à mão. Não cria abas nem mexe em fórmulas.
 */
export async function atualizarMesReferencia(forcar = false): Promise<{ alterado: boolean; de: string; para: string; motivo: string }> {
  const hoje = hojeISO();
  const [y, m, d] = hoje.split("-").map(Number);
  const para = `01/${String(m).padStart(2, "0")}/${y}`;
  const celula = range(config.painelAba, "L3");
  const de = clean((await getValues(config.vendasId, celula))[0]?.[0] ?? "");
  const atual = date(de);
  if (atual && atual.getFullYear() === y && atual.getMonth() + 1 === m) return { alterado: false, de, para, motivo: "já está no mês atual" };
  if (!forcar && d > 3) return { alterado: false, de, para, motivo: "fora dos 3 primeiros dias do mês (troca manual)" };
  await batchUpdateValues(config.vendasId, [{ range: celula, values: [[para]] }]);
  return { alterado: true, de, para, motivo: "mês de referência do PAINEL GERAL atualizado" };
}
