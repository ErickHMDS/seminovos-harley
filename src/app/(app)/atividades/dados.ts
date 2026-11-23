import "server-only";
import { getEstoque } from "@/lib/estoque";
import { leadsVisiveis } from "@/lib/leads";
import { getPreparacao } from "@/lib/preparacao";
import type { Sessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";

/** Opções do formulário de atividade: motos (estoque + preparação), leads visíveis e a equipe ativa. */
export async function opcoesFormulario(s: Sessao) {
  const [{ motos }, prep, leads, usuarios] = await Promise.all([
    getEstoque().catch(() => ({ motos: [] as Awaited<ReturnType<typeof getEstoque>>["motos"] })),
    getPreparacao().catch(() => ({ itens: [] as Awaited<ReturnType<typeof getPreparacao>>["itens"] })),
    leadsVisiveis(s).catch(() => []),
    getUsuarios().catch(() => []),
  ]);
  const opcoesMotos = new Map<string, string>();
  for (const m of motos) if (m.placa) opcoesMotos.set(m.placa, m.modelo);
  for (const p of prep.itens) if (p.placa && p.etapa !== "FINALIZADA" && !opcoesMotos.has(p.placa.toUpperCase())) opcoesMotos.set(p.placa.toUpperCase(), `${p.modelo} (em preparação)`);
  return {
    motos: [...opcoesMotos.entries()].map(([placa, modelo]) => ({ placa, modelo })).sort((a, b) => a.modelo.localeCompare(b.modelo)),
    leads: leads.filter((l) => l.ativo).map((l) => ({ id: l.id, cliente: l.cliente, desejo: [l.marca, l.modelo].filter(Boolean).join(" ") })),
    pessoas: usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil })).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

export const voltaSegura = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/atividades");
