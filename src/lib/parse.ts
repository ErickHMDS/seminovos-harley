/** Utilitários para interpretar valores no formato brasileiro vindos da planilha. */

export function clean(v: string | undefined | null): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** "75.756,41" | "R$ 1.234" | "37538" -> número (ou null) */
export function num(v: string | undefined | null): number | null {
  const s = clean(v).replace(/[R$\s%]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** "03/11/2026" -> Date (meio-dia local para evitar problemas de fuso). Rejeita anos absurdos. */
export function date(v: string | undefined | null): Date | null {
  const m = clean(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (year < 2015 || year > 2100) return null;
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const TZ = "America/Sao_Paulo";

/** Data de hoje no fuso de São Paulo, ao meio-dia (mesma base usada em date()). */
export function hoje(): Date {
  return date(new Date().toLocaleDateString("pt-BR", { timeZone: TZ }))!;
}

/** "AAAA-MM-DD" de hoje em São Paulo (para <input type="date">). */
export function hojeISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function yesNo(v: string | undefined | null): boolean {
  return /^(sim|s|x|ok|1|true|verdadeiro)$/i.test(clean(v));
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MESES[m - 1] ?? key;
  return short ? `${name.slice(0, 3)}/${String(y).slice(2)}` : `${name} ${y}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "MIGUEL GOMES RAUSIS" -> "Miguel Rausis" */
export function shortName(full: string): string {
  const parts = clean(full).toLowerCase().split(" ").filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length <= 2) return parts.map(cap).join(" ");
  return `${cap(parts[0])} ${cap(parts[parts.length - 1])}`;
}

export function title(s: string): string {
  return clean(s)
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR");

export const fmt = {
  brl: (n: number | null | undefined) => (n == null ? "—" : brl.format(n)),
  int: (n: number | null | undefined) => (n == null ? "—" : int.format(n)),
  pct: (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 100)}%`),
  date: (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR") : "—"),
};
