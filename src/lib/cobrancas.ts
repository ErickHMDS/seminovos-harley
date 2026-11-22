import "server-only";
import { addSheet, appendValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { getLeads, semSyonet } from "./leads";
import { clean } from "./parse";
import type { Sessao } from "./sessao";
import { getUsuarios } from "./usuarios";

/**
 * Monitoramento do gestor: uma linha por vendedor com pendências (leads sem Syonet).
 * "Cobrei" esconde a linha por 24 h; ela volta se, passado esse prazo, ainda houver pendências
 * — ou antes, se as pendências aumentarem.
 */
const CABECALHO = ["Vendedor ID", "Vendedor", "Pendências", "Concluído Em", "Concluído Por"];
const PRAZO_MS = 24 * 60 * 60 * 1000;

type Registro = { vendedorId: string; pendencias: number; em: number; por: string };

async function load(): Promise<Registro[]> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.cobrancasAba)) return [];
  const rows = await getValues(config.appId, range(config.cobrancasAba, "A2:E"));
  return rows.map((r) => ({ vendedorId: clean(r[0] ?? ""), pendencias: Number(r[2]) || 0, em: Date.parse(clean(r[3] ?? "")) || 0, por: clean(r[4] ?? "") })).filter((r) => r.vendedorId);
}

const getRegistros = () => cached("cobrancas", load);

export type Monitor = { vendedorId: string; nome: string; pendencias: number; prioridade: "alta" | "media" | "baixa"; voltou: boolean; cobradoEm: number | null };

/** Pendências por vendedor (id -> quantidade). */
export async function pendenciasPorVendedor(): Promise<Map<string, number>> {
  const leads = await getLeads().catch(() => []);
  const m = new Map<string, number>();
  for (const l of leads) if (semSyonet(l)) m.set(l.vendedorId, (m.get(l.vendedorId) ?? 0) + 1);
  return m;
}

export async function monitoramento(): Promise<Monitor[]> {
  const [pend, usuarios, regs] = await Promise.all([pendenciasPorVendedor(), getUsuarios().catch(() => []), getRegistros().catch(() => [])]);
  const agora = Date.now();
  const out: Monitor[] = [];
  for (const [vendedorId, n] of pend) {
    if (!n) continue;
    const ultimo = regs.filter((r) => r.vendedorId === vendedorId).sort((a, b) => b.em - a.em)[0];
    const dentroDoPrazo = ultimo && agora - ultimo.em < PRAZO_MS;
    if (dentroDoPrazo && n <= ultimo.pendencias) continue; // cobrado há menos de 24 h e não piorou
    const nome = usuarios.find((u) => u.id === vendedorId)?.nome ?? vendedorId;
    out.push({ vendedorId, nome, pendencias: n, prioridade: n >= 10 ? "alta" : n >= 5 ? "media" : "baixa", voltou: !!ultimo, cobradoEm: ultimo?.em ?? null });
  }
  return out.sort((a, b) => b.pendencias - a.pendencias);
}

export async function concluirCobranca(vendedorId: string, s: Sessao) {
  const n = (await pendenciasPorVendedor()).get(vendedorId) ?? 0;
  const nome = (await getUsuarios()).find((u) => u.id === vendedorId)?.nome ?? vendedorId;
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.cobrancasAba)) {
    await addSheet(config.appId, config.cobrancasAba);
    await updateValues(config.appId, range(config.cobrancasAba, "A1"), [CABECALHO]);
  }
  await appendValues(config.appId, range(config.cobrancasAba, "A1"), [[vendedorId, nome, n, new Date().toISOString(), s.nome]]);
  invalidate("cobrancas");
}
