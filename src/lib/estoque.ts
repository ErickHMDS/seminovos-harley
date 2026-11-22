import "server-only";
import { batchGet, range } from "./google";
import { cached } from "./cache";
import { config } from "./config";
import { clean, date, daysBetween, hoje as hojeSP, num } from "./parse";

export type Moto = {
  id: string;
  aba: string;
  empresa: string;
  marca: "HARLEY" | "TRIUMPH" | "OUTRA";
  cidade: string;
  placa: string;
  modelo: string;
  km: number | null;
  ano: string;
  cor: string;
  dataEntrada: string | null;
  dias: number | null;
  custo: number | null;
  ultimoValorVenda: number | null;
  fipe: number | null;
  realinhamento: number | null; // preço de venda atual
  status: string;
  anunciada: boolean;
  observacao: string;
};

const norm = (s: string) => clean(s).toUpperCase();

function cidade(empresa: string, aba: string): string {
  const s = norm(`${empresa} ${aba}`);
  if (/CTBA|CURITIBA/.test(s)) return "Curitiba";
  if (/LND|LDNA|LOND/.test(s)) return "Londrina";
  return "—";
}

function marca(empresa: string): Moto["marca"] {
  const s = norm(empresa);
  if (s.includes("TRIUMPH")) return "TRIUMPH";
  if (s.includes("FREEDOM") || s.includes("HARLEY")) return "HARLEY";
  return "OUTRA";
}

function statusNormalizado(s: string): { status: string; anunciada: boolean } {
  const v = norm(s);
  if (!v) return { status: "SEM STATUS", anunciada: false };
  if (/^(N[AÃ]O|SEM) ANUNCI/.test(v)) return { status: "NÃO ANUNCIADO", anunciada: false };
  if (/^ANUNCIAD/.test(v)) return { status: "ANUNCIADO", anunciada: true };
  return { status: v, anunciada: false };
}

async function load(): Promise<{ motos: Moto[]; atualizadoEm: string }> {
  const tabs = await batchGet(config.estoqueId, config.estoqueAbas.map((a) => range(a, "A1:N")));
  const hoje = hojeSP();
  const motos: Moto[] = [];

  config.estoqueAbas.forEach((aba, t) => {
    const [header = [], ...rows] = tabs[t];
    const idx = new Map(header.map((h, i) => [norm(h), i]));
    const g = (r: string[], name: string) => clean(r[idx.get(norm(name)) ?? -1]);

    rows.forEach((r, i) => {
      const placa = norm(g(r, "Placa"));
      const modelo = g(r, "Modelo");
      if (!placa && !modelo) return;
      const empresa = norm(g(r, "Empresa"));
      const entrada = date(g(r, "Data Entrada"));
      const st = statusNormalizado(g(r, "Status"));
      motos.push({
        id: `${aba}#${i + 2}`,
        aba,
        empresa,
        marca: marca(empresa),
        cidade: cidade(empresa, aba),
        placa,
        modelo: modelo.toUpperCase(),
        km: num(g(r, "Km")),
        ano: g(r, "Ano Modelo"),
        cor: norm(g(r, "Cor")),
        dataEntrada: entrada ? entrada.toISOString() : null,
        // calcula na hora a partir da data de entrada; se não houver, usa a coluna da planilha
        dias: entrada ? daysBetween(entrada, hoje) : num(g(r, "Dias Estoque")),
        custo: num(g(r, "Custo Presente")),
        ultimoValorVenda: num(g(r, "Último Valor Venda")),
        fipe: num(g(r, "Fipe")),
        realinhamento: num(g(r, "Realinhamento")),
        status: st.status,
        anunciada: st.anunciada,
        observacao: g(r, "Observação"),
      });
    });
  });

  motos.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return { motos, atualizadoEm: new Date().toISOString() };
}

export function getEstoque() {
  return cached("estoque", load);
}

export const FAIXAS = [
  { id: "0-30", label: "Até 30 dias", min: 0, max: 30 },
  { id: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
  { id: "61-90", label: "61 a 90 dias", min: 61, max: 90 },
  { id: "90+", label: "Mais de 90 dias", min: 91, max: Infinity },
] as const;

export function faixa(dias: number | null) {
  if (dias == null) return null;
  return FAIXAS.find((f) => dias >= f.min && dias <= f.max) ?? null;
}

/** Remove dados financeiros sensíveis para perfis que não são gestor. */
export function semCusto(m: Moto): Moto {
  return { ...m, custo: null, ultimoValorVenda: null };
}
