import "server-only";
import { addSheet, appendValues, batchUpdateSheet, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { pendencias } from "./checklist";
import { TZ, clean } from "./parse";
import { colLetra, reqExcluirLinha, valorSeguro } from "./planilha";
import type { Sessao } from "./sessao";

/**
 * Atividades (aba "Atividades" da planilha do app): pendências da inspeção 360 (automáticas),
 * tarefas do gestor e tarefas da equipe. Cada uma tem status (A fazer → Em andamento → Finalizado),
 * prioridade (Normal/Urgente), prazo com data e hora, pessoas marcadas, observação, periodicidade
 * (repete ao finalizar) e, opcionalmente, uma moto (placa) ou um lead.
 * "Atrasada" não é um status gravado: é a atividade não finalizada com o prazo vencido.
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
  responsavelId: "Responsável ID", // pessoas marcadas: IDs separados por vírgula
  responsavel: "Responsável", // nomes (só para quem lê a planilha)
  lead: "Lead ID",
  cliente: "Lead Cliente",
  prazo: "Prazo", // "dd/mm/aaaa" ou "dd/mm/aaaa hh:mm"
  prioridade: "Prioridade",
  observacao: "Observação",
  periodicidade: "Periodicidade",
  criadoPorId: "Criada Por ID",
  criadoPor: "Criada Por",
  proximaGerada: "Próxima Gerada",
  iniciadaEm: "Iniciada Em",
} as const;
type Col = keyof typeof COLS;
const CAMPOS = Object.keys(COLS) as Col[];

export const STATUS = ["A FAZER", "EM ANDAMENTO", "FINALIZADO"] as const;
export type StatusAtv = (typeof STATUS)[number];
export const PERIODOS = ["", "DIÁRIA", "SEMANAL", "QUINZENAL", "MENSAL"] as const;
export type Periodo = (typeof PERIODOS)[number];

export type Atividade = Record<Col, string> & {
  linha: number;
  aberta: boolean;
  etapa: StatusAtv;
  urgente: boolean;
  pessoas: string[];
  prazoData: string; // aaaa-mm-dd
  prazoHora: string; // hh:mm
};

const agora = () => new Date().toLocaleString("pt-BR", { timeZone: TZ });
const norm = (s: string) => clean(s).toUpperCase();

export function statusDe(raw: string): StatusAtv {
  const s = norm(raw);
  if (/^(RESOLVID|FINALIZAD|CONCLU)/.test(s)) return "FINALIZADO";
  if (/ANDAMENTO|INICIAD/.test(s)) return "EM ANDAMENTO";
  return "A FAZER";
}

/** "dd/mm/aaaa[ hh:mm]" → { data: "aaaa-mm-dd", hora: "hh:mm" } */
export function lerPrazo(p: string): { data: string; hora: string } {
  const m = clean(p).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (!m) return { data: "", hora: "" };
  return { data: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, hora: m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : "" };
}
export function escreverPrazo(data: string, hora: string): string {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}${/^\d{2}:\d{2}$/.test(hora) ? ` ${hora}` : ""}`;
}

/** Agora em São Paulo: { data: "aaaa-mm-dd", hora: "hh:mm" } */
export function agoraSP() {
  const d = new Date();
  return {
    data: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

/** Não finalizada e com o prazo vencido (sem hora: vence ao fim do dia). */
export function estaAtrasada(a: Pick<Atividade, "aberta" | "prazoData" | "prazoHora">, agora = agoraSP()): boolean {
  if (!a.aberta || !a.prazoData) return false;
  if (a.prazoData !== agora.data) return a.prazoData < agora.data;
  return !!a.prazoHora && a.prazoHora < agora.hora;
}

async function lerAba() {
  const abas = await listSheets(config.appId);
  const aba = abas.find((a) => a.title === config.atividadesAba);
  if (!aba) return { existe: false, sheetId: -1, header: [] as string[], rows: [] as string[][] };
  const [header = [], ...rows] = await getValues(config.appId, range(config.atividadesAba, "A1:AH"));
  return { existe: true, sheetId: aba.sheetId, header, rows };
}

function indices(header: string[]) {
  const map = new Map(header.map((h, i) => [norm(h), i]));
  return Object.fromEntries(CAMPOS.map((c) => [c, map.get(norm(COLS[c])) ?? -1])) as Record<Col, number>;
}

const separarIds = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

async function load(): Promise<Atividade[]> {
  const { header, rows } = await lerAba();
  const idx = indices(header);
  return rows
    .map((r, i) => {
      const a = Object.fromEntries(CAMPOS.map((c) => [c, idx[c] >= 0 ? clean(r[idx[c]]) : ""])) as Record<Col, string>;
      const etapa = statusDe(a.status);
      const { data, hora } = lerPrazo(a.prazo);
      return {
        ...a, linha: i + 2, etapa, aberta: etapa !== "FINALIZADO", urgente: norm(a.prioridade) === "URGENTE",
        pessoas: separarIds(a.responsavelId), prazoData: data, prazoHora: hora,
      };
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

export type Nova = {
  descricao: string; origem?: string; placa?: string; modelo?: string; item?: string; ref?: string;
  pessoas?: { id: string; nome: string }[]; lead?: string; cliente?: string; prazo?: string;
  prioridade?: string; observacao?: string; periodicidade?: string; criadoPorId?: string; criadoPor?: string;
};

async function criarVarias(novas: Nova[]) {
  if (!novas.length) return;
  const header = await garantirAba();
  const idx = indices(header);
  const base = Date.now();
  const linhas = novas.map((n, k) => {
    const v: Record<Col, string> = {
      id: `A${(base + k).toString(36).toUpperCase()}`, criadaEm: agora(),
      placa: clean(n.placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""), modelo: clean(n.modelo ?? "").toUpperCase(),
      item: n.item ?? "", descricao: n.descricao, origem: n.origem ?? "Manual", status: "A FAZER", resolvidaEm: "", resolucao: "", ref: n.ref ?? "",
      responsavelId: (n.pessoas ?? []).map((p) => p.id).join(","), responsavel: (n.pessoas ?? []).map((p) => p.nome).join(", "),
      lead: n.lead ?? "", cliente: n.cliente ?? "", prazo: n.prazo ?? "",
      prioridade: n.prioridade === "URGENTE" ? "URGENTE" : "NORMAL", observacao: n.observacao ?? "", periodicidade: n.periodicidade ?? "",
      criadoPorId: n.criadoPorId ?? "", criadoPor: n.criadoPor ?? "", proximaGerada: "", iniciadaEm: "",
    };
    const linha = header.map(() => "");
    for (const c of CAMPOS) if (idx[c] >= 0) linha[idx[c]] = String(valorSeguro(v[c]));
    return linha;
  });
  await appendValues(config.appId, range(config.atividadesAba, "A1"), linhas);
}

async function atualizarCampos(mudancas: { linha: number; campos: Partial<Record<Col, string>> }[]) {
  if (!mudancas.length) return;
  const header = await garantirAba();
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
 * pendência nova → cria atividade; item que virou OK → finaliza; observação mudou → atualiza a descrição.
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
    mudancas.push({ linha: a.linha, campos: { status: "FINALIZADO", resolvidaEm: agora(), resolucao: "Item marcado como OK na inspeção" } });
  }
  await atualizarCampos(mudancas);
  await criarVarias(novas);
  invalidate("atividades");
}

// ---------------------------------------------------------------------------------------------
// Quem vê e quem mexe
// ---------------------------------------------------------------------------------------------
/** Gestor vê todas; os demais veem as que estão marcados ou que criaram. */
export function visivelPara(a: Atividade, s: Pick<Sessao, "perfil" | "uid">): boolean {
  return s.perfil === "gestor" || a.pessoas.includes(s.uid) || a.criadoPorId === s.uid;
}
export const podeMexer = visivelPara;
export const podeExcluir = (a: Atividade, s: Pick<Sessao, "perfil" | "uid">) => s.perfil === "gestor" || (a.criadoPorId === s.uid && a.origem !== "Inspeção 360");

async function buscar(id: string): Promise<Atividade> {
  invalidate("atividades");
  const a = (await getAtividades()).find((x) => x.id === id);
  if (!a) throw new Error("Atividade não encontrada (pode ter sido excluída).");
  return a;
}

/** Próxima data de uma atividade que se repete. */
function proximaData(dataISO: string, periodo: string): string {
  const base = new Date(`${dataISO}T12:00:00Z`);
  const p = norm(periodo);
  if (p === "DIÁRIA" || p === "DIARIA") base.setUTCDate(base.getUTCDate() + 1);
  else if (p === "SEMANAL") base.setUTCDate(base.getUTCDate() + 7);
  else if (p === "QUINZENAL") base.setUTCDate(base.getUTCDate() + 14);
  else if (p === "MENSAL") {
    const dia = base.getUTCDate();
    base.setUTCDate(1); base.setUTCMonth(base.getUTCMonth() + 1);
    const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(dia, ultimo));
  } else return "";
  return base.toISOString().slice(0, 10);
}

/** Muda o status. Finalizar uma atividade que se repete cria a próxima (uma vez só). */
export async function mudarStatus(id: string, status: StatusAtv, nota = ""): Promise<{ proxima?: string }> {
  const a = await buscar(id);
  const campos: Partial<Record<Col, string>> = { status };
  if (status === "FINALIZADO") { campos.resolvidaEm = agora(); if (nota) campos.resolucao = nota; }
  else { campos.resolvidaEm = ""; if (a.etapa === "FINALIZADO") campos.resolucao = ""; }
  if (status === "EM ANDAMENTO" && !a.iniciadaEm) campos.iniciadaEm = agora();
  let proxima: string | undefined;
  if (status === "FINALIZADO" && a.periodicidade && !a.proximaGerada) {
    const data = proximaData(a.prazoData || agoraSP().data, a.periodicidade);
    if (data) {
      proxima = escreverPrazo(data, a.prazoHora);
      campos.proximaGerada = proxima;
      await criarVarias([{
        descricao: a.descricao, origem: a.origem, placa: a.placa, modelo: a.modelo, ref: a.ref,
        pessoas: a.pessoas.map((pid, k) => ({ id: pid, nome: a.responsavel.split(",").at(k)?.trim() ?? "" })),
        lead: a.lead, cliente: a.cliente, prazo: proxima, prioridade: a.prioridade, observacao: a.observacao, periodicidade: a.periodicidade,
        criadoPorId: a.criadoPorId, criadoPor: a.criadoPor,
      }]);
    }
  }
  await atualizarCampos([{ linha: a.linha, campos }]);
  invalidate("atividades");
  return { proxima };
}

export type Edicao = Partial<Pick<Nova, "descricao" | "placa" | "modelo" | "lead" | "cliente" | "prazo" | "prioridade" | "observacao" | "periodicidade" | "pessoas">>;

export async function editarAtividade(id: string, e: Edicao): Promise<void> {
  const a = await buscar(id);
  const campos: Partial<Record<Col, string>> = {};
  if (e.descricao !== undefined) campos.descricao = e.descricao;
  if (e.placa !== undefined) campos.placa = clean(e.placa).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (e.modelo !== undefined) campos.modelo = clean(e.modelo).toUpperCase();
  if (e.lead !== undefined) campos.lead = e.lead;
  if (e.cliente !== undefined) campos.cliente = e.cliente;
  if (e.prazo !== undefined) campos.prazo = e.prazo;
  if (e.prioridade !== undefined) campos.prioridade = e.prioridade === "URGENTE" ? "URGENTE" : "NORMAL";
  if (e.observacao !== undefined) campos.observacao = e.observacao;
  if (e.periodicidade !== undefined) campos.periodicidade = e.periodicidade;
  if (e.pessoas !== undefined) { campos.responsavelId = e.pessoas.map((p) => p.id).join(","); campos.responsavel = e.pessoas.map((p) => p.nome).join(", "); }
  // conferência: a linha ainda é a mesma atividade
  const { rows, header } = await lerAba();
  const idx = indices(header);
  if (clean(rows[a.linha - 2]?.[idx.id] ?? "") !== id) throw new Error("A planilha mudou enquanto você editava. Atualize e tente de novo.");
  await atualizarCampos([{ linha: a.linha, campos }]);
  invalidate("atividades");
}

export async function excluirAtividade(id: string): Promise<void> {
  const a = await buscar(id);
  const { sheetId, rows, header } = await lerAba();
  const idx = indices(header);
  if (clean(rows[a.linha - 2]?.[idx.id] ?? "") !== id) throw new Error("A planilha mudou. Atualize e tente de novo.");
  await batchUpdateSheet(config.appId, [reqExcluirLinha(sheetId, a.linha - 1)]);
  invalidate("atividades");
}

// compatibilidade (preparação, telas antigas)
export async function resolverAtividade(id: string, resolucao: string) { await mudarStatus(id, "FINALIZADO", resolucao.trim() || "Resolvida"); }
export async function reabrirAtividade(id: string) { await mudarStatus(id, "A FAZER"); }

export async function criarAtividade(n: Nova) {
  await criarVarias([n]);
  invalidate("atividades");
}

export const atividadesDaPlaca = async (placa: string) => (await getAtividades()).filter((a) => a.placa && a.placa === clean(placa).toUpperCase());
export const atividadesDoLead = async (id: string) => (await getAtividades()).filter((a) => a.lead === id);
