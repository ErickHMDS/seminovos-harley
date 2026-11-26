import "server-only";
import { META_PADRAO, type BaseVendas } from "./vendas";

/**
 * Meta de cada vendedor no mês: o OBJETIVO DO MÊS da aba EQUIPE (vendedores ativos) — a mesma fonte
 * do PAINEL GERAL. Quem não está ativo na EQUIPE mas vendeu no mês aparece com a meta padrão (10).
 */
export async function objetivosVigentes(base: BaseVendas): Promise<Record<string, number>> {
  const out: Record<string, number> = { ...base.objetivos };
  const mes = base.meses[0];
  for (const v of base.vendas) if (v.mes === mes && v.conta && !(v.vendedor in out) && v.vendedor !== "SEM VENDEDOR") out[v.vendedor] = META_PADRAO;
  return out;
}
