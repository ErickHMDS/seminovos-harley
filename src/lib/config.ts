import "server-only";

function list(v: string | undefined, fallback: string[]): string[] {
  const items = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

export const config = {
  vendasId: process.env.SHEET_VENDAS_ID ?? "1EfQAOgyZCzO0cRoJYXjnTmtJ-gcoKrhg4QcEAO5meYE",
  estoqueId: process.env.SHEET_ESTOQUE_ID ?? "1l1BXerwxXTjlkdho2-1w7pvippJhB2_uuaZlbY5hzNs",
  estoqueAbas: list(process.env.ESTOQUE_ABAS, ["Estoque CTBA", "Estoque LOND"]),
  preparacaoAba: process.env.PREPARACAO_ABA?.trim() || "Motos em Preparação",
  atividadesAba: process.env.ATIVIDADES_ABA?.trim() || "Atividades",
  painelAba: process.env.PAINEL_ABA?.trim() || "PAINEL GERAL",
  coordenadorEmail: process.env.COORDENADOR_EMAIL?.trim() ?? "",
  /** segundos que os dados lidos ficam em memória antes de reler a planilha */
  cacheSegundos: Number(process.env.CACHE_SEGUNDOS ?? 60),
};
