import "server-only";
import { batchGet, listSheets, range } from "./google";
import { cached } from "./cache";
import { config } from "./config";
import { clean, date, monthKey, num, shortName, yesNo } from "./parse";

export type Venda = {
  id: string;
  mes: string; // "2026-11" — mês de referência (aba onde foi lançada)
  aba: string;
  data: string | null; // ISO
  vendedor: string;
  vendedorCurto: string;
  pedido: string;
  loja: string;
  situacao: string;
  faturada: boolean;
  cliente: string;
  veiculo: string;
  placa: string;
  ge: boolean;
  fin: boolean;
  usado: boolean;
  seguro: string;
  prevFaturamento: string;
  observacoes: string;
};

export type AbaVendas = { aba: string; mes: string; vendas: number };

export type BaseVendas = {
  vendas: Venda[];
  abas: AbaVendas[];
  abasIgnoradas: { aba: string; motivo: string }[];
  objetivos: Record<string, number>; // vendedor (normalizado) -> objetivo mensal
  meses: string[]; // ordenados do mais recente para o mais antigo
  atualizadoEm: string;
};

const norm = (s: string) => clean(s).toUpperCase();

function headerIndex(header: string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const key = norm(h);
    if (key && !map.has(key)) map.set(key, i); // primeira ocorrência (há colunas repetidas)
  });
  return (name: string) => map.get(norm(name)) ?? -1;
}

function parseObjetivos(rows: string[][]): Record<string, number> {
  const out: Record<string, number> = {};
  const start = rows.findIndex((r) => norm(r[0] ?? "") === "OBJETIVO" && norm(r[1] ?? "") === "VENDEDOR");
  if (start < 0) return out;
  for (const r of rows.slice(start + 1)) {
    const vendedor = norm(r[1] ?? "");
    if (!vendedor) break;
    const objetivo = num(r[0]);
    if (objetivo != null) out[vendedor] = objetivo;
  }
  return out;
}

async function load(): Promise<BaseVendas> {
  const sheets = await listSheets(config.vendasId);
  const titles = sheets.map((s) => s.title).filter((t) => norm(t) !== norm(config.painelAba));
  const [painel, ...tabs] = await batchGet(config.vendasId, [
    range(config.painelAba, "A1:L60"),
    ...titles.map((t) => range(t, "A1:N")),
  ]);

  const porMes = new Map<string, { aba: string; vendas: Venda[] }>();
  const abasIgnoradas: BaseVendas["abasIgnoradas"] = [];

  titles.forEach((aba, t) => {
    const rows = tabs[t];
    const hi = rows.slice(0, 6).findIndex((r) => norm(r[0] ?? "") === "DATA");
    if (hi < 0) return abasIgnoradas.push({ aba, motivo: "sem cabeçalho 'Data'" });
    const col = headerIndex(rows[hi]);
    const c = {
      data: col("Data"), vendedor: col("Vendedor"), pedido: col("Pedido"), loja: col("Loja"),
      situacao: col("Situação"), cliente: col("Cliente"), veiculo: col("Veiculo"), placa: col("Placa"),
      ge: col("G.E"), fin: col("FIN"), usado: col("Usado"), seguro: col("SEGURO"),
      prev: col("Prev. Faturamento"), obs: col("Observações"),
    };
    const get = (r: string[], i: number) => (i >= 0 ? clean(r[i]) : "");

    const linhas = rows.slice(hi + 1).filter((r) => get(r, c.vendedor) || get(r, c.veiculo) || get(r, c.cliente));
    if (linhas.length === 0) return abasIgnoradas.push({ aba, motivo: "sem vendas lançadas" });

    // mês da aba = mês mais frequente entre as datas lançadas
    const contagem = new Map<string, number>();
    for (const r of linhas) {
      const d = date(get(r, c.data));
      if (d) contagem.set(monthKey(d), (contagem.get(monthKey(d)) ?? 0) + 1);
    }
    const mes = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!mes) return abasIgnoradas.push({ aba, motivo: "datas não reconhecidas" });

    const vendas: Venda[] = linhas.map((r, i) => {
      const d = date(get(r, c.data));
      const vendedor = norm(get(r, c.vendedor)) || "SEM VENDEDOR";
      const situacao = norm(get(r, c.situacao)) || "SEM SITUAÇÃO";
      return {
        id: `${aba}#${hi + 2 + i}`,
        mes,
        aba,
        data: d ? d.toISOString() : null,
        vendedor,
        vendedorCurto: shortName(vendedor),
        pedido: get(r, c.pedido),
        loja: norm(get(r, c.loja)) || "—",
        situacao,
        faturada: situacao === "FATURADO",
        cliente: get(r, c.cliente),
        veiculo: get(r, c.veiculo),
        placa: norm(get(r, c.placa)),
        ge: yesNo(get(r, c.ge)),
        fin: yesNo(get(r, c.fin)),
        usado: yesNo(get(r, c.usado)),
        seguro: get(r, c.seguro),
        prevFaturamento: get(r, c.prev),
        observacoes: get(r, c.obs),
      };
    });

    const atual = porMes.get(mes);
    if (!atual || atual.vendas.length < vendas.length) {
      if (atual) abasIgnoradas.push({ aba: atual.aba, motivo: `duplicada de ${mes} (usada a aba "${aba}")` });
      porMes.set(mes, { aba, vendas });
    } else {
      abasIgnoradas.push({ aba, motivo: `duplicada de ${mes} (usada a aba "${atual.aba}")` });
    }
  });

  const meses = [...porMes.keys()].sort().reverse();
  return {
    vendas: meses.flatMap((m) => porMes.get(m)!.vendas),
    abas: meses.map((m) => ({ aba: porMes.get(m)!.aba, mes: m, vendas: porMes.get(m)!.vendas.length })),
    abasIgnoradas,
    objetivos: parseObjetivos(painel),
    meses,
    atualizadoEm: new Date().toISOString(),
  };
}

export function getVendas() {
  return cached("vendas", load);
}

export type LinhaRanking = {
  vendedor: string;
  nome: string;
  vendas: number;
  faturadas: number;
  pendentes: number;
  fin: number;
  ge: number;
  usado: number;
  seguro: number;
  harley: number;
  triumph: number;
  objetivo: number | null;
  atingimento: number | null;
};

const temSeguro = (s: string) => !!s && !/^(n[aã]o|-)$/i.test(s);

export function ranking(vendas: Venda[], objetivos: Record<string, number> = {}, incluirSemVendas = false): LinhaRanking[] {
  const rows = new Map<string, LinhaRanking>();
  const linha = (vendedor: string): LinhaRanking => {
    let r = rows.get(vendedor);
    if (!r) {
      const objetivo = objetivos[vendedor] ?? null;
      r = { vendedor, nome: shortName(vendedor), vendas: 0, faturadas: 0, pendentes: 0, fin: 0, ge: 0, usado: 0, seguro: 0, harley: 0, triumph: 0, objetivo, atingimento: null };
      rows.set(vendedor, r);
    }
    return r;
  };
  if (incluirSemVendas) Object.keys(objetivos).forEach(linha);
  for (const v of vendas) {
    const r = linha(v.vendedor);
    r.vendas++;
    if (v.faturada) r.faturadas++;
    else r.pendentes++;
    if (v.fin) r.fin++;
    if (v.ge) r.ge++;
    if (v.usado) r.usado++;
    if (temSeguro(v.seguro)) r.seguro++;
    if (v.loja.includes("HARLEY")) r.harley++;
    if (v.loja.includes("TRIUMPH")) r.triumph++;
  }
  for (const r of rows.values()) r.atingimento = r.objetivo ? r.vendas / r.objetivo : null;
  return [...rows.values()].sort((a, b) => b.vendas - a.vendas || b.faturadas - a.faturadas || a.nome.localeCompare(b.nome));
}

export function resumo(vendas: Venda[]) {
  const porSituacao = new Map<string, number>();
  const porLoja = new Map<string, number>();
  for (const v of vendas) {
    porSituacao.set(v.situacao, (porSituacao.get(v.situacao) ?? 0) + 1);
    porLoja.set(v.loja, (porLoja.get(v.loja) ?? 0) + 1);
  }
  return {
    total: vendas.length,
    faturadas: vendas.filter((v) => v.faturada).length,
    fin: vendas.filter((v) => v.fin).length,
    ge: vendas.filter((v) => v.ge).length,
    usado: vendas.filter((v) => v.usado).length,
    seguro: vendas.filter((v) => temSeguro(v.seguro)).length,
    porSituacao: [...porSituacao.entries()].sort((a, b) => b[1] - a[1]),
    porLoja: [...porLoja.entries()].sort((a, b) => b[1] - a[1]),
  };
}
