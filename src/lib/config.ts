import "server-only";

function list(v: string | undefined, fallback: string[]): string[] {
  const items = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

export const config = {
  vendasId: process.env.SHEET_VENDAS_ID ?? "1EfQAOgyZCzO0cRoJYXjnTmtJ-gcoKrhg4QcEAO5meYE",
  estoqueId: process.env.SHEET_ESTOQUE_ID ?? "1l1BXerwxXTjlkdho2-1w7pvippJhB2_uuaZlbY5hzNs",
  /** Planilha do app: usuários, leads, atividades, catálogo, configurações e fotos. */
  appId: process.env.SHEET_APP_ID ?? "1RR4A-f6rWZ-dzY4Pz76Pse00MWaxft3_9xPnDMBrgCQ",
  estoqueAbas: list(process.env.ESTOQUE_ABAS, ["Estoque CTBA", "Estoque LOND"]),
  preparacaoAba: process.env.PREPARACAO_ABA?.trim() || "Motos em Preparação",
  atividadesAba: process.env.ATIVIDADES_ABA?.trim() || "Atividades",
  catalogoAba: process.env.CATALOGO_ABA?.trim() || "Catálogo Motos",
  usuariosAba: process.env.USUARIOS_ABA?.trim() || "Usuários App",
  configAba: process.env.CONFIG_ABA?.trim() || "Configurações App",
  leadsAba: process.env.LEADS_ABA?.trim() || "Leads",
  cobrancasAba: process.env.COBRANCAS_ABA?.trim() || "Cobranças",
  fotosAba: process.env.FOTOS_ABA?.trim() || "Fotos",
  vendasAba: process.env.VENDAS_ABA?.trim() || "VENDAS", // aba única com todas as vendas do ano
  equipeAba: process.env.EQUIPE_ABA?.trim() || "EQUIPE", // vendedores, objetivo do mês e ativo
  painelAba: process.env.PAINEL_ABA?.trim() || "PAINEL GERAL",
  coordenadorEmail: process.env.COORDENADOR_EMAIL?.trim() ?? "",
  /** segundos que os dados lidos ficam em memória antes de reler a planilha */
  cacheSegundos: Number(process.env.CACHE_SEGUNDOS ?? 60),
};
