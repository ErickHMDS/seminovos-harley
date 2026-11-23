import "server-only";
import { META_PADRAO, getUsuarios } from "./usuarios";
import type { BaseVendas } from "./vendas";

/**
 * Meta de cada vendedor no mês: a do Cadastro (padrão 10) para quem tem acesso ligado ao nome
 * da planilha; senão a do PAINEL GERAL; senão 10.
 */
export async function objetivosVigentes(base: BaseVendas): Promise<Record<string, number>> {
  const out: Record<string, number> = { ...base.objetivos };
  const mes = base.meses[0];
  for (const v of base.vendas) if (v.mes === mes && !(v.vendedor in out) && v.vendedor !== "SEM VENDEDOR") out[v.vendedor] = META_PADRAO;
  for (const u of await getUsuarios().catch(() => [])) if (u.ativo && u.perfil === "vendedor" && u.vendedor) out[u.vendedor] = u.meta;
  return out;
}
