import "server-only";
import { addSheet, appendValues, batchUpdateValues, ensureColumns, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { TZ, clean, date, daysBetween, hoje as hojeSP } from "./parse";

export const ETAPAS = [
  { id: "INSPEÇÃO", label: "Recepção e inspeção 360", curto: "Inspeção" },
  { id: "FORNECEDOR", label: "No fornecedor", curto: "Fornecedor" },
  { id: "FOTOS", label: "Retornou · fotos oficiais", curto: "Fotos" },
  { id: "FINALIZADA", label: "Finalizada · pronta para venda", curto: "Finalizada" },
] as const;
export type Etapa = (typeof ETAPAS)[number]["id"];

/**
 * Colunas da aba de preparação. As 9 primeiras já existem na planilha (mantidas como estão);
 * as demais são acrescentadas à direita na primeira gravação feita pelo app.
 */
export const COLUNAS = {
  modelo: "Modelo",
  placa: "Placa",
  chassi: "Chassi",
  cor: "Cor",
  servicos: "Serviços",
  fornecedor: "Fornecedor",
  dataSaida: "Data de Saída",
  prazoEntrega: "Prazo de Entrega",
  observacoes: "Observações",
  id: "ID App",
  etapa: "Etapa",
  loja: "Loja",
  ano: "Ano",
  km: "Km",
  dataRecepcao: "Data Recepção",
  responsavel: "Responsável",
  riscos: "Riscos/Arranhões",
  sujeira: "Sujeira",
  estetica: "Detalhes Estéticos",
  manual: "Manual",
  chaveReserva: "Chave Reserva",
  ultimaRevisao: "Última Revisão",
  emailEnviado: "E-mail Coordenador",
  fotoPreparacao: "Foto Em Preparação Postada",
  dataRetorno: "Data Retorno",
  fotosOficiais: "Qtd Fotos Oficiais",
  postadoRedes: "Postado nas Redes",
  dataFinalizacao: "Data Finalização",
  atualizadoEm: "Atualizado Em",
} as const;
export type Campo = keyof typeof COLUNAS;
export type Preparacao = Record<Campo, string> & { linha: number; diasNaEtapa: number | null; diasTotal: number | null; atrasada: boolean };

const norm = (s: string) => clean(s).toUpperCase();
const CAMPOS = Object.keys(COLUNAS) as Campo[];

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR", { timeZone: TZ });
}

async function lerAba(): Promise<{ header: string[]; rows: string[][]; existe: boolean }> {
  const abas = await listSheets(config.estoqueId);
  if (!abas.some((a) => a.title === config.preparacaoAba)) return { header: [], rows: [], existe: false };
  const [header = [], ...rows] = await getValues(config.estoqueId, range(config.preparacaoAba, "A1:AZ"));
  return { header, rows, existe: true };
}

function indices(header: string[]) {
  const map = new Map(header.map((h, i) => [norm(h), i]));
  return Object.fromEntries(CAMPOS.map((c) => [c, map.get(norm(COLUNAS[c])) ?? -1])) as Record<Campo, number>;
}

function etapaDe(p: Record<Campo, string>): Etapa {
  const e = norm(p.etapa);
  const found = ETAPAS.find((x) => x.id === e);
  if (found) return found.id;
  // linhas lançadas direto na planilha (sem etapa): deduz pelo que está preenchido
  if (p.dataFinalizacao) return "FINALIZADA";
  if (p.dataRetorno) return "FOTOS";
  if (p.fornecedor || p.dataSaida) return "FORNECEDOR";
  return "INSPEÇÃO";
}

async function load(): Promise<{ itens: Preparacao[]; abaExiste: boolean; colunasFaltando: string[] }> {
  const { header, rows, existe } = await lerAba();
  const idx = indices(header);
  const hoje = hojeSP();
  const itens: Preparacao[] = [];
  rows.forEach((r, i) => {
    const p = Object.fromEntries(CAMPOS.map((c) => [c, idx[c] >= 0 ? clean(r[idx[c]]) : ""])) as Record<Campo, string>;
    if (!p.placa && !p.modelo) return;
    p.etapa = etapaDe(p);
    if (!p.id) p.id = `L${i + 2}`; // linha sem ID (lançada manualmente): identifica pela linha
    const ref =
      p.etapa === "FORNECEDOR" ? date(p.dataSaida) : p.etapa === "FOTOS" ? date(p.dataRetorno) : p.etapa === "FINALIZADA" ? date(p.dataFinalizacao) : date(p.dataRecepcao);
    const inicio = date(p.dataRecepcao) ?? date(p.dataSaida);
    const fim = date(p.dataFinalizacao) ?? hoje;
    const prazo = date(p.prazoEntrega);
    itens.push({
      ...p,
      linha: i + 2,
      diasNaEtapa: ref ? daysBetween(ref, hoje) : null,
      diasTotal: inicio ? daysBetween(inicio, fim) : null,
      atrasada: p.etapa === "FORNECEDOR" && !!prazo && prazo < hoje,
    });
  });
  const colunasFaltando = existe ? CAMPOS.filter((c) => idx[c] < 0).map((c) => COLUNAS[c]) : CAMPOS.map((c) => COLUNAS[c]);
  return { itens, abaExiste: existe, colunasFaltando };
}

export function getPreparacao() {
  return cached("preparacao", load);
}

export async function getItem(id: string) {
  const { itens } = await getPreparacao();
  return itens.find((p) => p.id === id) ?? null;
}

/** Garante que a aba exista e que todas as colunas do app estejam no cabeçalho (acrescenta à direita). */
async function garantirCabecalho(): Promise<string[]> {
  const { header, existe } = await lerAba();
  if (!existe) await addSheet(config.estoqueId, config.preparacaoAba);
  const atual = [...header];
  while (atual.length && !clean(atual[atual.length - 1])) atual.pop();
  const presentes = new Set(atual.map(norm));
  const faltando = CAMPOS.map((c) => COLUNAS[c]).filter((nome) => !presentes.has(norm(nome)));
  if (faltando.length) {
    const novo = [...atual, ...faltando];
    const info = (await listSheets(config.estoqueId)).find((a) => a.title === config.preparacaoAba);
    if (info) await ensureColumns(config.estoqueId, info, novo.length);
    await updateValues(config.estoqueId, range(config.preparacaoAba, "A1"), [novo]);
    return novo;
  }
  return atual;
}

/** Evita que um texto digitado vire fórmula na planilha. */
function seguro(v: string): string {
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

function colLetra(n: number): string {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export async function criar(dados: Partial<Record<Campo, string>>): Promise<string> {
  const header = await garantirCabecalho();
  const idx = indices(header);
  const id = `P${Date.now().toString(36).toUpperCase()}`;
  const valores: Partial<Record<Campo, string>> = {
    dataRecepcao: hojeBR(),
    ...dados,
    id,
    etapa: "INSPEÇÃO",
    atualizadoEm: new Date().toLocaleString("pt-BR", { timeZone: TZ }),
  };
  const linha = header.map(() => "");
  for (const c of CAMPOS) if (idx[c] >= 0 && valores[c] != null) linha[idx[c]] = seguro(String(valores[c]));
  await appendValues(config.estoqueId, range(config.preparacaoAba, "A1"), [linha]);
  invalidate("preparacao");
  return id;
}

export async function atualizar(id: string, dados: Partial<Record<Campo, string>>): Promise<string> {
  const header = await garantirCabecalho();
  const idx = indices(header);
  const rows = await getValues(config.estoqueId, range(config.preparacaoAba, "A1:AZ"));
  let n = rows.findIndex((r, i) => i > 0 && idx.id >= 0 && clean(r[idx.id]) === id);
  if (n < 0 && /^L\d+$/.test(id)) n = Number(id.slice(1)) - 1; // linha lançada manualmente
  if (n < 1 || n >= rows.length) throw new Error("Moto não encontrada na planilha de preparação.");

  const novoId = clean(rows[n][idx.id] ?? "") || `P${Date.now().toString(36).toUpperCase()}`;
  const valores: Partial<Record<Campo, string>> = {
    ...dados,
    id: novoId,
    atualizadoEm: new Date().toLocaleString("pt-BR", { timeZone: TZ }),
  };
  // grava somente as células que mudaram (não reescreve fórmulas/valores de outras colunas)
  const celulas = CAMPOS.filter((c) => idx[c] >= 0 && valores[c] !== undefined && clean(rows[n][idx[c]]) !== clean(valores[c])).map((c) => ({
    range: range(config.preparacaoAba, `${colLetra(idx[c])}${n + 1}`),
    values: [[seguro(String(valores[c]))]],
  }));
  await batchUpdateValues(config.estoqueId, celulas);
  invalidate("preparacao");
  return novoId;
}

export function proximaEtapa(etapa: string): Etapa | null {
  const i = ETAPAS.findIndex((e) => e.id === etapa);
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1].id : null;
}

export { hojeBR };
