import "server-only";
import fs from "node:fs";
import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];
const API = process.env.SHEETS_API_BASE || "https://sheets.googleapis.com/v4/spreadsheets";

type ServiceAccount = { client_email: string; private_key: string };

let client: JWT | null = null;

function loadCredentials(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  let text: string | undefined;
  if (raw && raw.trim()) {
    text = raw.trim();
    // aceita o JSON puro ou codificado em base64
    if (!text.startsWith("{")) text = Buffer.from(text, "base64").toString("utf8");
  } else if (file) {
    text = fs.readFileSync(file, "utf8");
  }
  if (!text) {
    throw new Error(
      "Credenciais do Google não configuradas. Defina GOOGLE_SERVICE_ACCOUNT_JSON (ou GOOGLE_SERVICE_ACCOUNT_FILE).",
    );
  }
  const json = JSON.parse(text) as ServiceAccount;
  return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
}

function getClient(): JWT {
  if (!client) {
    const c = loadCredentials();
    client = new JWT({ email: c.client_email, key: c.private_key, scopes: SCOPES });
  }
  return client;
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { token } = await getClient().getAccessToken();
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(20_000),
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/** E-mail da conta de serviço (com quem compartilhar planilhas e a pasta do Drive). */
export function emailContaServico(): string {
  try { return loadCredentials().client_email; } catch { return ""; }
}

/** Token de acesso da conta de serviço (usado também para ler o Google Drive). */
export async function tokenGoogle(): Promise<string> {
  const { token } = await getClient().getAccessToken();
  if (!token) throw new Error("Não foi possível obter o token do Google.");
  return token;
}

/** Monta a referência de intervalo "'Aba'!A1:B2" com aspas escapadas. */
export function range(sheet: string, a1?: string): string {
  const quoted = `'${sheet.replace(/'/g, "''")}'`;
  return a1 ? `${quoted}!${a1}` : quoted;
}

export type Rows = string[][];

export type SheetInfo = { title: string; sheetId: number; columnCount: number; rowCount: number };

export async function listSheets(spreadsheetId: string): Promise<SheetInfo[]> {
  const data = await call<{
    sheets: { properties: { title: string; sheetId: number; gridProperties?: { columnCount?: number; rowCount?: number } } }[];
  }>(`${API}/${spreadsheetId}?fields=sheets.properties(title,sheetId,gridProperties)`);
  return data.sheets.map(({ properties: p }) => ({
    title: p.title,
    sheetId: p.sheetId,
    columnCount: p.gridProperties?.columnCount ?? 26,
    rowCount: p.gridProperties?.rowCount ?? 1000,
  }));
}

/** Garante que a aba tenha pelo menos `count` colunas (a API não grava fora da grade). */
export async function ensureColumns(spreadsheetId: string, sheet: SheetInfo, count: number) {
  if (sheet.columnCount >= count) return;
  return call(`${API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ appendDimension: { sheetId: sheet.sheetId, dimension: "COLUMNS", length: count - sheet.columnCount } }],
    }),
  });
}

/**
 * Lê vários intervalos numa única chamada.
 * FORMATTED_VALUE = como aparece na planilha; FORMULA = devolve a fórmula ("=...") nas células calculadas.
 */
export async function batchGet(spreadsheetId: string, ranges: string[], render: "FORMATTED_VALUE" | "FORMULA" = "FORMATTED_VALUE"): Promise<Rows[]> {
  if (ranges.length === 0) return [];
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const data = await call<{ valueRanges: { values?: (string | number | boolean)[][] }[] }>(
    `${API}/${spreadsheetId}/values:batchGet?${qs}&valueRenderOption=${render}`,
  );
  return data.valueRanges.map((v) => (v.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c)))));
}

export async function getFormulas(spreadsheetId: string, a1: string): Promise<Rows> {
  const [rows] = await batchGet(spreadsheetId, [a1], "FORMULA");
  return rows;
}

/** Operações estruturais (inserir/excluir linha, duplicar aba, copiar fórmulas…). */
export async function batchUpdateSheet<T = unknown>(spreadsheetId: string, requests: object[]): Promise<T> {
  return call<T>(`${API}/${spreadsheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
}

export async function batchClear(spreadsheetId: string, ranges: string[]) {
  if (ranges.length === 0) return;
  return call(`${API}/${spreadsheetId}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges }) });
}

export async function getValues(spreadsheetId: string, a1: string): Promise<Rows> {
  const [rows] = await batchGet(spreadsheetId, [a1]);
  return rows;
}

export async function updateValues(spreadsheetId: string, a1: string, values: (string | number)[][]) {
  return call(`${API}/${spreadsheetId}/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range: a1, majorDimension: "ROWS", values }),
  });
}

/** Atualiza várias células/intervalos independentes numa única chamada. */
export async function batchUpdateValues(spreadsheetId: string, data: { range: string; values: (string | number)[][] }[]) {
  if (data.length === 0) return;
  return call(`${API}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
}

export async function appendValues(spreadsheetId: string, a1: string, values: (string | number)[][]) {
  return call(
    `${API}/${spreadsheetId}/values/${encodeURIComponent(a1)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ range: a1, majorDimension: "ROWS", values }) },
  );
}

export async function addSheet(spreadsheetId: string, title: string) {
  return call(`${API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
}
