import "server-only";
import { addSheet, appendValues, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { pendencias } from "./checklist";
import { TZ, clean } from "./parse";
import { colLetra, valorSeguro } from "./planilha";

/**
 * Atividades: pendências da inspeção 360 (automáticas), tarefas avulsas do gestor e tarefas dos
 * vendedores (origem "Vendedor", com responsável). Podem estar ligadas a uma moto (placa) ou a um lead.
 * Ficam na aba "Atividades" da planilha do app.
 */
const COLS = {
  id: "ID",
  criadaEm: "Criada Em",
  placa: "Placa",
  modelo: "Modelo",
  item: "Item",
  descricao: "Descrição",
  origem: "Origem",
  status: "Status",
  resolvidaEm: "Resolvida Em",
  resolucao: "Resolução",
  ref: "Ref Preparação",
  responsavelId: "Responsável ID",
  responsavel: "Responsável",
  lead: "Lead ID",
  cliente: "Lead Cliente",
  prazo: "Prazo",
} as const;
type Col = keyof typeof COLS;
const CAMPOS = Object.keys(COLS) as Col[];
export type Atividade = Record<Col, string> & { linha: number; aberta: boolean };

const agora = () => new Date().toLocaleString("pt-BR", { timeZone: TZ });
const norm = (s: string) => clean(s).toUpperCase();

async function lerAba() {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.atividadesAba)) return { existe: false, header: [] as string[], rows: [] as string[][] };
  const [header = [], ...rows] = await getValues(config.appId, range(config.atividadesAba, "A1:Z"));
  return { existe: true, header, rows };
}

function indices(header: string[]) {
  const map = new Map(header.map((h, i) => [norm(h), i]));
  return Object.fromEntries(CAMPOS.map((c) => [c, map.get(norm(COLS[c])) ?? -1])) as Record<Col, number>;
}

async function load(): Promise<Atividade[]> {
  const { header, rows } = await lerAba();
  const idx = indices(header);
  return rows
    .map((r, i) => {
      const a = Object.fromEntries(CAMPOS.map((c) => [c, idx[c] >= 0 ? clean(r[idx[c]]) : ""])) as Record<Col, string>;
      return { ...a, linha: i + 2, aberta: norm(a.status) !== "RESOLVIDA" };
    })
    .filter((a) => a.id || a.descricao);
}

export function getAtividades() {
  return cached("atividades", load);
}

async function garantirAba(): Promise<string[]> {
  const { existe, header } = await lerAba();
  if (!existe) await addSheet(config.appId, config.atividadesAba);
  const atual = [...header];
  while (atual.length && !clean(atual[atual.length - 1])) atual.pop(); // remove vazios do fim
  const presentes = new Set(atual.map(norm));
  const faltando = CAMPOS.map((c) => COLS[c]).filter((n) => !presentes.has(norm(n)));
  if (!faltando.length) return atual;
  const novo = [...atual, ...faltando];
  await updateValues(config.appId, range(config.atividadesAba, "A1"), [novo]);
  return novo;
}

type Nova = { placa?: string; modelo?: string; item?: string; descricao: string; origem: string; ref?: string; responsavelId?: string; responsavel?: string; lead?: string; cliente?: string; prazo?: string };

async function criarVarias(novas: Nova[]) {
  if (!novas.length) return;
  const header = await garantirAba();
  const idx = indices(header);
  const base = Date.now();
  const linhas = novas.map((n, k) => {
    const v: Record<Col, string> = {
      id: `A${(base + k).toString(36).toUpperCase()}`, criadaEm: agora(), placa: n.placa ?? "", modelo: n.modelo ?? "",
      item: n.item ?? "", descricao: n.descricao, origem: n.origem, status: "ABERTA", resolvidaEm: "", resolucao: "", ref: n.ref ?? "",
      responsavelId: n.responsavelId ?? "", responsavel: n.responsavel ?? "", lead: n.lead ?? "", cliente: n.cliente ?? "", prazo: n.prazo ?? "",
    };
    const linha = header.map(() => "");
    for (const c of CAMPOS) if (idx[c] >= 0) linha[idx[c]] = String(valorSeguro(v[c]));
    return linha;
  });
  await appendValues(config.appId, range(config.atividadesAba, "A1"), linhas);
}

async function atualizarCampos(mudancas: { linha: number; campos: Partial<Record<Col, string>> }[]) {
  if (!mudancas.length) return;
  const { header } = await lerAba();
  const idx = indices(header);
  const data = mudancas.flatMap(({ linha, campos }) =>
    (Object.keys(campos) as Col[]).filter((c) => idx[c] >= 0).map((c) => ({
      range: range(config.atividadesAba, `${colLetra(idx[c])}${linha}`),
      values: [[valorSeguro(campos[c] ?? "")]],
    })),
  );
  await batchUpdateValues(config.appId, data);
}

/**
 * Mantém as atividades em dia com o checklist da inspeção:
 * pendência nova → cria atividade; item que virou OK → resolve; observação mudou → atualiza a descrição.
 */
export async function sincronizarInspecao(p: Partial<Record<string, string>> & { id: string }) {
  invalidate("atividades");
  const todas = await getAtividades();
  const daMoto = todas.filter((a) => a.ref === p.id && a.origem === "Inspeção 360");
  const pend = pendencias(p);
  const novas: Nova[] = [];
  const mudancas: { linha: number; campos: Partial<Record<Col, string>> }[] = [];

  for (const x of pend) {
    const desc = x.obs ? `${x.tarefa}: ${x.obs}` : x.tarefa;
    const aberta = daMoto.find((a) => a.aberta && a.item === x.label);
    if (!aberta) novas.push({ placa: p.placa, modelo: p.modelo, item: x.label, descricao: desc, origem: "Inspeção 360", ref: p.id });
    else if (aberta.descricao !== desc) mudancas.push({ linha: aberta.linha, campos: { descricao: desc } });
  }
  for (const a of daMoto.filter((a) => a.aberta && !pend.some((x) => x.label === a.item))) {
    mudancas.push({ linha: a.linha, campos: { status: "RESOLVIDA", resolvidaEm: agora(), resolucao: "Item marcado como OK na inspeção" } });
  }
  await atualizarCampos(mudancas);
  await criarVarias(novas);
  invalidate("atividades");
}

export async function resolverAtividade(id: string, resolucao: string) {
  const a = (await getAtividades()).find((x) => x.id === id);
  if (!a) throw new Error("Atividade não encontrada.");
  await atualizarCampos([{ linha: a.linha, campos: { status: "RESOLVIDA", resolvidaEm: agora(), resolucao: resolucao.trim() || "Resolvida" } }]);
  invalidate("atividades");
}

export async function reabrirAtividade(id: string) {
  const a = (await getAtividades()).find((x) => x.id === id);
  if (!a) throw new Error("Atividade não encontrada.");
  await atualizarCampos([{ linha: a.linha, campos: { status: "ABERTA", resolvidaEm: "", resolucao: "" } }]);
  invalidate("atividades");
}

export async function criarAtividade(n: Omit<Nova, "origem"> & { origem?: string }) {
  await criarVarias([{ ...n, origem: n.origem ?? "Manual", placa: clean(n.placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""), modelo: clean(n.modelo ?? "").toUpperCase() }]);
  invalidate("atividades");
}

export const ehDoVendedor = (a: Atividade) => a.origem === "Vendedor";
export const atividadesDoResponsavel = async (uid: string) => (await getAtividades()).filter((a) => a.responsavelId === uid);
export const atividadesDaPlaca = async (placa: string) => (await getAtividades()).filter((a) => a.placa && a.placa === clean(placa).toUpperCase());
export const atividadesDoLead = async (id: string) => (await getAtividades()).filter((a) => a.lead === id);
