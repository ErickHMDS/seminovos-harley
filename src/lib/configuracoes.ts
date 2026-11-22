import "server-only";
import { addSheet, appendValues, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { TZ, clean } from "./parse";
import { valorSeguro } from "./planilha";

/** Configurações editáveis pelo gestor (aba "Configurações App": Chave | Valor | Descrição | Atualizado Em). */
export const CHAVES = {
  coordenadores: { nome: "coordenadores_email", descricao: "E-mails dos coordenadores (separados por vírgula) — recebem o resumo da inspeção 360" },
} as const;

async function load(): Promise<Record<string, string>> {
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.configAba)) return {};
  const rows = await getValues(config.appId, range(config.configAba, "A2:B"));
  return Object.fromEntries(rows.filter((r) => clean(r[0] ?? "")).map((r) => [clean(r[0]), clean(r[1] ?? "")]));
}

export function getConfiguracoes() {
  return cached("config", load);
}

/** E-mails dos coordenadores: cadastro do app; se vazio, usa COORDENADOR_EMAIL do servidor. */
export async function emailsCoordenadores(): Promise<string> {
  const c = await getConfiguracoes().catch(() => ({} as Record<string, string>));
  return c[CHAVES.coordenadores.nome] || config.coordenadorEmail;
}

export async function salvarConfiguracao(chave: keyof typeof CHAVES, valor: string) {
  const def = CHAVES[chave];
  const abas = await listSheets(config.appId);
  if (!abas.some((a) => a.title === config.configAba)) {
    await addSheet(config.appId, config.configAba);
    await updateValues(config.appId, range(config.configAba, "A1"), [["Chave", "Valor", "Descrição", "Atualizado Em"]]);
  }
  const rows = await getValues(config.appId, range(config.configAba, "A1:A"));
  const n = rows.findIndex((r) => clean(r[0] ?? "") === def.nome);
  const linha = [def.nome, valorSeguro(valor), def.descricao, new Date().toLocaleString("pt-BR", { timeZone: TZ })];
  if (n > 0) await batchUpdateValues(config.appId, [{ range: range(config.configAba, `A${n + 1}`), values: [linha] }]);
  else await appendValues(config.appId, range(config.configAba, "A1"), [linha]);
  invalidate("config");
}
