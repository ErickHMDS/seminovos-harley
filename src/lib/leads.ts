import "server-only";
import { addSheet, appendValues, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { getCatalogo } from "./catalogo";
import type { Moto } from "./estoque";
import { identificar, segmentoPadrao, type ModeloCat } from "./motos";
import { TZ, clean, date, num } from "./parse";
import { colLetra, garantirColunas, indiceCabecalho, valorSeguro } from "./planilha";
import type { Sessao } from "./sessao";

/** Leads (aba "Leads" da planilha de estoque). */
const COLS = {
  id: "ID", criadoEm: "Criado Em", vendedorId: "Vendedor ID", vendedor: "Vendedor", cliente: "Cliente", telefone: "Telefone",
  email: "E-mail", syonet: "Syonet", marca: "Marca", modelo: "Modelo", tipo: "Tipo", segmento: "Segmento", anoMin: "Ano Mínimo",
  valorMax: "Valor Máximo", aceitaEquivalente: "Aceita Equivalente", pagamento: "Pagamento", usado: "Usado na Troca",
  status: "Status", proximoContato: "Próximo Contato", ultimoContato: "Último Contato", avisadas: "Motos Avisadas",
  observacoes: "Observações", historico: "Histórico", atualizadoEm: "Atualizado Em",
} as const;
type Col = keyof typeof COLS;
const CAMPOS = Object.keys(COLS) as Col[];

export const STATUS_LEAD = [
  { id: "NOVO", label: "Novo" },
  { id: "EM CONTATO", label: "Em contato" },
  { id: "NEGOCIANDO", label: "Negociando" },
  { id: "VENDIDO", label: "Vendido" },
  { id: "PERDIDO", label: "Perdido" },
] as const;

export type Lead = Record<Col, string> & { linha: number; ativo: boolean; avisadasLista: string[] };

const agora = () => new Date().toLocaleString("pt-BR", { timeZone: TZ });
const hojeBR = () => new Date().toLocaleDateString("pt-BR", { timeZone: TZ });
const norm = (s: string) => clean(s).toUpperCase();

async function lerAba() {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.leadsAba)) return { existe: false, header: [] as string[], rows: [] as string[][] };
  const [header = [], ...rows] = await getValues(config.appId, range(config.leadsAba, "A1:AZ"));
  return { existe: true, header, rows };
}

function indices(header: string[]) {
  const col = indiceCabecalho(header);
  return Object.fromEntries(CAMPOS.map((c) => [c, col(COLS[c])])) as Record<Col, number>;
}

async function load(): Promise<Lead[]> {
  const { header, rows } = await lerAba();
  const idx = indices(header);
  return rows
    .map((r, i) => {
      const l = Object.fromEntries(CAMPOS.map((c) => [c, idx[c] >= 0 ? clean(r[idx[c]] ?? "") : ""])) as Record<Col, string>;
      l.status = norm(l.status) || "NOVO";
      return { ...l, linha: i + 2, ativo: !["VENDIDO", "PERDIDO"].includes(l.status), avisadasLista: l.avisadas.split(/[,;\s]+/).map(norm).filter(Boolean) };
    })
    .filter((l) => l.id && l.cliente);
}

export function getLeads() {
  return cached("leads", load);
}

/** Vendedor vê só os seus leads; gestor vê todos. */
export async function leadsVisiveis(s: Sessao): Promise<Lead[]> {
  const todos = await getLeads();
  return s.perfil === "gestor" ? todos : todos.filter((l) => l.vendedorId === s.uid);
}

export async function getLead(id: string, s: Sessao): Promise<Lead | null> {
  return (await leadsVisiveis(s)).find((l) => l.id === id) ?? null;
}

async function garantirAba(): Promise<string[]> {
  const { existe, header } = await lerAba();
  if (!existe) {
    await addSheet(config.appId, config.leadsAba);
    const novo = CAMPOS.map((c) => COLS[c]);
    await updateValues(config.appId, range(config.leadsAba, "A1"), [novo]);
    return novo;
  }
  return garantirColunas(config.appId, config.leadsAba, CAMPOS.map((c) => COLS[c]));
}

export type LeadInput = {
  cliente: string; telefone: string; email: string; syonet: string; marca: string; modelo: string; tipo: string; anoMin: string; valorMax: string;
  aceitaEquivalente: boolean; pagamento: string; usado: string; status: string; proximoContato: string; observacoes: string;
  vendedorId?: string; vendedor?: string;
};

/** Segmento do desejo: pelo modelo do catálogo; se só houver tipo, "Tipo" puro. */
function segmentoDoDesejo(cat: ModeloCat[], marca: string, modelo: string, tipo: string): string {
  const m = modelo ? identificar(cat, `${marca} ${modelo}`, marca) : null;
  return m?.segmento ?? (tipo ? segmentoPadrao(tipo, null) : "");
}

export async function salvarLead(id: string | null, d: LeadInput, s: Sessao): Promise<string> {
  const { modelos } = await getCatalogo();
  const valores: Partial<Record<Col, string>> = {
    cliente: d.cliente, telefone: d.telefone, email: d.email, syonet: d.syonet, marca: d.marca, modelo: d.modelo, tipo: d.tipo,
    segmento: segmentoDoDesejo(modelos, d.marca, d.modelo, d.tipo), anoMin: d.anoMin, valorMax: d.valorMax,
    aceitaEquivalente: d.aceitaEquivalente ? "SIM" : "NÃO", pagamento: d.pagamento, usado: d.usado, status: d.status || "NOVO",
    proximoContato: d.proximoContato, observacoes: d.observacoes, atualizadoEm: agora(),
  };
  if (s.perfil === "gestor" && d.vendedorId) { valores.vendedorId = d.vendedorId; valores.vendedor = d.vendedor ?? ""; }
  const header = await garantirAba();
  const idx = indices(header);

  if (!id) {
    const novoId = `L${Date.now().toString(36).toUpperCase()}`;
    const todos: Partial<Record<Col, string>> = {
      ...valores, id: novoId, criadoEm: agora(), vendedorId: valores.vendedorId ?? s.uid, vendedor: valores.vendedor ?? s.nome,
      historico: `${agora()} — ${s.nome}: lead cadastrado`,
    };
    const linha = header.map(() => "");
    for (const c of CAMPOS) if (idx[c] >= 0 && todos[c] != null) linha[idx[c]] = String(valorSeguro(todos[c]!));
    await appendValues(config.appId, range(config.leadsAba, "A1"), [linha]);
    invalidate("leads");
    return novoId;
  }

  invalidate("leads");
  const atual = await getLead(id, s);
  if (!atual) throw new Error("Lead não encontrado (ou de outro vendedor).");
  if (atual.status !== valores.status) valores.historico = `${agora()} — ${s.nome}: status ${atual.status} → ${valores.status}\n${atual.historico}`.slice(0, 4000);
  await gravar(atual, valores, idx);
  return id;
}

async function gravar(l: Lead, valores: Partial<Record<Col, string>>, idx?: Record<Col, number>) {
  const i = idx ?? indices((await lerAba()).header);
  const data = (Object.keys(valores) as Col[])
    .filter((c) => i[c] >= 0 && valores[c] !== undefined)
    .map((c) => ({ range: range(config.leadsAba, `${colLetra(i[c])}${l.linha}`), values: [[valorSeguro(valores[c]!)]] }));
  await batchUpdateValues(config.appId, data);
  invalidate("leads");
}

/** Registra um contato (opcionalmente sobre uma moto, que deixa de aparecer como oportunidade para este lead). */
export async function registrarContato(id: string, s: Sessao, nota: string, placa = "", proximo = "") {
  invalidate("leads");
  const l = await getLead(id, s);
  if (!l) throw new Error("Lead não encontrado (ou de outro vendedor).");
  const avisadas = placa ? [...new Set([...l.avisadasLista, norm(placa)])] : l.avisadasLista;
  const texto = [nota.trim() || "contato realizado", placa ? `(moto ${norm(placa)})` : ""].filter(Boolean).join(" ");
  await gravar(l, {
    ultimoContato: hojeBR(), avisadas: avisadas.join(", "), status: l.status === "NOVO" ? "EM CONTATO" : l.status,
    proximoContato: proximo, historico: `${agora()} — ${s.nome}: ${texto}\n${l.historico}`.slice(0, 4000), atualizadoEm: agora(),
  });
}

// ---------------------------------------------------------------------------
// Oportunidades: motos do estoque (inclui em preparação) que atendem ao lead
// ---------------------------------------------------------------------------

export type Match = { placa: string; modelo: string; fabricante: string; ano: string; preco: number | null; cidade: string; dias: number | null; tipoMatch: "exato" | "equivalente" | "tipo"; emPreparacao: boolean; nova: boolean; aba: string; linha: number };

export function oportunidadesDoLead(l: Lead, motos: Moto[], cat: ModeloCat[], placasEmPreparacao: Set<string>): Match[] {
  if (!l.ativo) return [];
  const alvo = l.modelo ? identificar(cat, `${l.marca} ${l.modelo}`, l.marca) : null;
  const seg = l.segmento || alvo?.segmento || "";
  const aceita = l.aceitaEquivalente !== "NÃO";
  const anoMin = parseInt(l.anoMin, 10) || 0;
  const valorMax = num(l.valorMax);
  const out: Match[] = [];
  for (const m of motos) {
    if (!m.placa || l.avisadasLista.includes(m.placa)) continue;
    let tipoMatch: Match["tipoMatch"] | null = null;
    if (alvo && m.catalogoId === alvo.id) tipoMatch = "exato";
    else if (aceita && seg && m.segmento && m.segmento === seg) tipoMatch = "equivalente";
    else if (!l.modelo && l.tipo && m.tipo && m.tipo.toUpperCase() === l.tipo.toUpperCase()) tipoMatch = "tipo";
    if (!tipoMatch) continue;
    const ano = parseInt(m.ano, 10);
    if (anoMin && ano && ano < anoMin) continue;
    if (valorMax && m.realinhamento != null && m.realinhamento > valorMax * 1.1) continue;
    out.push({
      placa: m.placa, modelo: m.modelo, fabricante: m.fabricante, ano: m.ano, preco: m.realinhamento, cidade: m.cidade, dias: m.dias, tipoMatch,
      emPreparacao: placasEmPreparacao.has(m.placa) || /PREPARA/.test(m.status), nova: m.dias != null && m.dias <= 7, aba: m.aba, linha: m.linha,
    });
  }
  const peso = { exato: 0, equivalente: 1, tipo: 2 };
  return out.sort((a, b) => peso[a.tipoMatch] - peso[b.tipoMatch] || Number(b.nova) - Number(a.nova) || (a.dias ?? 0) - (b.dias ?? 0));
}

/** Retorno vencido ou para hoje. */
export function retornoHoje(l: Lead): boolean {
  if (!l.ativo || !l.proximoContato) return false;
  const d = date(l.proximoContato);
  const hoje = date(hojeBR());
  return !!d && !!hoje && d <= hoje;
}

/** Leads sem o número do Syonet = pendência do vendedor (todos os status, exceto Perdido). */
export const semSyonet = (l: Lead) => !l.syonet && l.status !== "PERDIDO";

export async function registrarSyonet(id: string, s: Sessao, valor: string) {
  const v = clean(valor);
  if (!v) throw new Error("Informe o número do Syonet.");
  invalidate("leads");
  const l = await getLead(id, s);
  if (!l) throw new Error("Lead não encontrado (ou de outro vendedor).");
  await garantirAba();
  await gravar(l, { syonet: v, historico: `${agora()} — ${s.nome}: cadastrado no Syonet (${v})\n${l.historico}`.slice(0, 4000), atualizadoEm: agora() });
}
