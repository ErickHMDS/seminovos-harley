import "server-only";
import { getCatalogo } from "@/lib/catalogo";
import { getEstoque } from "@/lib/estoque";
import { leadsVisiveis, oportunidadesDoLead, retornoHoje, type Lead, type Match } from "@/lib/leads";
import { getPreparacao } from "@/lib/preparacao";
import type { Sessao } from "@/lib/sessao";

export type LeadVM = {
  id: string; cliente: string; telefone: string; email: string; desejo: string; marca: string; modelo: string; tipo: string; segmento: string;
  anoMin: string; valorMax: string; aceitaEquivalente: boolean; pagamento: string; usado: string; status: string; proximoContato: string;
  ultimoContato: string; observacoes: string; historico: string; vendedor: string; vendedorId: string; criadoEm: string;
  retornoHoje: boolean; matches: Match[];
};

export function vm(l: Lead, matches: Match[]): LeadVM {
  return {
    id: l.id, cliente: l.cliente, telefone: l.telefone, email: l.email, marca: l.marca, modelo: l.modelo, tipo: l.tipo, segmento: l.segmento,
    desejo: [l.marca, l.modelo].filter(Boolean).join(" ") || (l.tipo ? `Qualquer ${l.tipo}` : "—"),
    anoMin: l.anoMin, valorMax: l.valorMax, aceitaEquivalente: l.aceitaEquivalente !== "NÃO", pagamento: l.pagamento, usado: l.usado,
    status: l.status, proximoContato: l.proximoContato, ultimoContato: l.ultimoContato, observacoes: l.observacoes, historico: l.historico,
    vendedor: l.vendedor, vendedorId: l.vendedorId, criadoEm: l.criadoEm, retornoHoje: retornoHoje(l), matches,
  };
}

/** Leads visíveis para a sessão, já com as oportunidades calculadas. */
export async function leadsComOportunidades(s: Sessao): Promise<LeadVM[]> {
  const [leads, { motos }, { modelos }, prep] = await Promise.all([
    leadsVisiveis(s).catch(() => [] as Lead[]), getEstoque(), getCatalogo(), getPreparacao().catch(() => null),
  ]);
  const emPrep = new Set((prep?.itens ?? []).filter((p) => p.etapa !== "FINALIZADA" && p.placa).map((p) => p.placa.toUpperCase()));
  return leads.map((l) => vm(l, oportunidadesDoLead(l, motos, modelos, emPrep)));
}
