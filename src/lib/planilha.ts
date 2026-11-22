import "server-only";
import { batchUpdateSheet, getFormulas, range } from "./google";
import { clean } from "./parse";

/** 0 -> "A", 25 -> "Z", 26 -> "AA" */
export function colLetra(n: number): string {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Evita que um texto digitado vire fórmula na planilha. Números passam como número. */
export function valorSeguro(v: string | number): string | number {
  if (typeof v === "number") return v;
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

export const norm = (s: string) => clean(s).toUpperCase();

/** Mapa nome-da-coluna -> índice (primeira ocorrência, ignorando maiúsculas/espaços). */
export function indiceCabecalho(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const k = norm(h);
    if (k && !map.has(k)) map.set(k, i);
  });
  return (nome: string) => map.get(norm(nome)) ?? -1;
}

/** Colunas que têm fórmula numa amostra de linhas (para nunca sobrescrevê-las). */
export async function colunasComFormula(spreadsheetId: string, aba: string, linhaIni: number, linhaFim: number): Promise<Set<number>> {
  const rows = await getFormulas(spreadsheetId, range(aba, `A${linhaIni}:AZ${linhaFim}`));
  const out = new Set<number>();
  rows.forEach((r) => r.forEach((c, i) => c.startsWith("=") && out.add(i)));
  return out;
}

/** Insere uma linha vazia (herdando a formatação da linha de cima). índice 0-based. */
export function reqInserirLinha(sheetId: number, index0: number) {
  return { insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: index0, endIndex: index0 + 1 }, inheritFromBefore: index0 > 0 } };
}

export function reqExcluirLinha(sheetId: number, index0: number) {
  return { deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: index0, endIndex: index0 + 1 } } };
}

/** Copia as fórmulas de uma linha para outra (referências relativas são ajustadas pelo Sheets). */
export function reqCopiarFormulas(sheetId: number, deLinha0: number, paraLinha0: number, colunas: number[]) {
  return colunas.map((c) => ({
    copyPaste: {
      source: { sheetId, startRowIndex: deLinha0, endRowIndex: deLinha0 + 1, startColumnIndex: c, endColumnIndex: c + 1 },
      destination: { sheetId, startRowIndex: paraLinha0, endRowIndex: paraLinha0 + 1, startColumnIndex: c, endColumnIndex: c + 1 },
      pasteType: "PASTE_FORMULA",
    },
  }));
}

export { batchUpdateSheet };
