import Link from "next/link";
import { Icon } from "@/components/Icon";
import { VendasLista } from "@/components/VendasLista";
import { getEstoque } from "@/lib/estoque";
import { TZ, monthLabel, shortName } from "@/lib/parse";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { getVendas, ranking } from "@/lib/vendas";
import { leadsComOportunidades } from "../leads/dados";
import { MetaView, type MetaVM } from "./MetaView";

export const dynamic = "force-dynamic";

/** Dias de loja (segunda a sábado) do mês: total, já passados (até ontem) e restantes (de hoje em diante). */
function diasDeLoja(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const ehMesAtual = hoje.getFullYear() === y && hoje.getMonth() + 1 === m;
  let total = 0, passados = 0;
  const ultimo = new Date(y, m, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const dia = new Date(y, m - 1, d);
    if (dia.getDay() === 0) continue;
    total++;
    if (!ehMesAtual || d < hoje.getDate()) passados++;
  }
  return { total, passados, restantes: Math.max(0, total - passados), ehMesAtual };
}

const taxa = (n: number, d: number) => (d ? n / d : 0);
const SALVO: Record<string, string> = { lancada: "Venda lançada na planilha.", editada: "Venda atualizada.", atividade: "Atividade lançada — está nas suas Tarefas." };

export default async function MetaPage({ searchParams }: { searchParams: Promise<{ v?: string; salvo?: string }> }) {
  const s = await exigirSessao("/meta");
  const { v, salvo } = await searchParams;
  const base = await getVendas();
  const mes = base.meses[0];
  const doMes = base.vendas.filter((x) => x.mes === mes);
  const rank = ranking(doMes, base.objetivos, true);
  const nomes = rank.map((r) => r.vendedor);
  const alvo = s.perfil === "gestor" ? (v && nomes.includes(v) ? v : nomes[0]) : s.vendedor;

  if (!alvo) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <div className="empty-icon">🎯</div><strong>Seu acesso ainda não está ligado a um vendedor</strong>
        <span>Peça ao gestor para vincular seu nome da planilha de vendas no Cadastro.</span>
      </div>
    );
  }

  const eu = rank.find((r) => r.vendedor === alvo) ?? { vendedor: alvo, nome: shortName(alvo), vendas: 0, faturadas: 0, pendentes: 0, fin: 0, ge: 0, usado: 0, seguro: 0, harley: 0, triumph: 0, objetivo: base.objetivos[alvo] ?? null, atingimento: null };
  const pos = rank.findIndex((r) => r.vendedor === alvo) + 1 || rank.length + 1;
  const acima = pos > 1 ? rank[pos - 2] : null;
  const abaixo = rank[pos] ?? null;
  const dias = diasDeLoja(mes);
  const meta = eu.objetivo;
  const faltam = meta ? Math.max(0, meta - eu.vendas) : 0;
  const projecao = dias.passados ? Math.round((eu.vendas / dias.passados) * dias.total) : eu.vendas;

  // qualidade das vendas: últimos 3 meses (amostra maior), você x equipe
  const meses3 = new Set(base.meses.slice(0, 3));
  const amostra = base.vendas.filter((x) => meses3.has(x.mes) && x.conta);
  const minhas3 = amostra.filter((x) => x.vendedor === alvo);
  const indicador = (f: (x: (typeof amostra)[number]) => boolean) => ({ eu: taxa(minhas3.filter(f).length, minhas3.length), equipe: taxa(amostra.filter(f).length, amostra.length) });
  const qualidade = {
    fin: indicador((x) => x.fin), ge: indicador((x) => x.ge), usado: indicador((x) => x.usado),
    seguro: indicador((x) => !!x.seguro && !/^(n[aã]o|-)$/i.test(x.seguro)),
  };

  // histórico (6 meses corridos)
  const historico = Array.from({ length: 6 }, (_, i) => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 - (5 - i), 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { label: monthLabel(k, true), value: base.vendas.filter((x) => x.mes === k && x.vendedor === alvo && x.conta).length, atual: k === mes };
  });
  const melhorMes = Math.max(...historico.map((h) => h.value));

  // leads do vendedor
  let meusLeads: Awaited<ReturnType<typeof leadsComOportunidades>> = [];
  if (s.perfil === "vendedor") meusLeads = await leadsComOportunidades(s).catch(() => []);
  else {
    const u = (await getUsuarios().catch(() => [])).find((x) => x.vendedor === alvo);
    if (u) meusLeads = (await leadsComOportunidades(s).catch(() => [])).filter((l) => l.vendedorId === u.id);
  }
  const ativos = meusLeads.filter((l) => !["VENDIDO", "PERDIDO"].includes(l.status));
  const oportunidades = meusLeads.filter((l) => l.matches.length);
  const retornos = meusLeads.filter((l) => l.retornoHoje);
  const minhasDoMes = doMes.filter((x) => x.vendedor === alvo).sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  const aFaturar = doMes.filter((x) => x.vendedor === alvo && x.conta && !x.faturada);
  const { motos } = await getEstoque().catch(() => ({ motos: [] as Awaited<ReturnType<typeof getEstoque>>["motos"] }));
  const paradas = motos.filter((m) => (m.dias ?? 0) > 60 && m.anunciada).slice(0, 4);

  const data: MetaVM = {
    nome: eu.nome, mes: monthLabel(mes), vendas: eu.vendas, faturadas: eu.faturadas, meta, faltam, projecao, dias,
    pos, totalVendedores: rank.length, acima: acima ? { nome: acima.nome, vendas: acima.vendas } : null, abaixo: abaixo ? { nome: abaixo.nome, vendas: abaixo.vendas } : null,
    lider: rank[0] ? { nome: rank[0].nome, vendas: rank[0].vendas } : null,
    escada: rank.slice(Math.max(0, pos - 3), pos + 2).map((r) => ({ nome: r.nome, vendas: r.vendas, eu: r.vendedor === alvo, pos: rank.indexOf(r) + 1 })),
    qualidade, historico, melhorMes, amostra3: minhas3.length,
    leads: { ativos: ativos.length, oportunidades: oportunidades.length, retornos: retornos.length, clientesOportunidade: oportunidades.slice(0, 3).map((l) => ({ id: l.id, cliente: l.cliente, moto: l.matches[0].modelo })) },
    aFaturar: aFaturar.map((x) => ({ veiculo: x.veiculo, cliente: x.cliente, aba: x.aba, linha: x.linha })),
    paradas: paradas.map((m) => ({ modelo: m.modelo, placa: m.placa, dias: m.dias ?? 0, preco: m.realinhamento, cidade: m.cidade })),
    hoje: new Date().toLocaleDateString("sv-SE", { timeZone: TZ }),
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{s.perfil === "gestor" ? "Metas da equipe" : "Minha meta"} · {monthLabel(mes)}</div>
          <h1>{s.perfil === "gestor" ? eu.nome : `Bora, ${eu.nome.split(" ")[0]}!`}</h1>
        </div>
        {s.perfil === "gestor" && (
          <div className="chips scroll" style={{ maxWidth: "100%" }}>
            {rank.map((r) => <Link key={r.vendedor} href={`/meta?v=${encodeURIComponent(r.vendedor)}`} className={`chip ${r.vendedor === alvo ? "active" : ""}`} scroll={false}>{r.nome}</Link>)}
          </div>
        )}
      </div>
      {s.perfil === "vendedor" && (
        <nav className="acoes-rapidas" aria-label="Lançamentos">
          <Link href="/vendas/nova" className="acao-rapida principal"><Icon name="plus" size={18} /><span>Lançar venda</span></Link>
          <Link href="/leads/novo" className="acao-rapida"><Icon name="leads" size={18} /><span>Lançar lead</span></Link>
          <Link href="/atividades/nova?volta=/meta" className="acao-rapida"><Icon name="atividades" size={18} /><span>Lançar atividade</span></Link>
        </nav>
      )}
      {salvo && SALVO[salvo] && <div className="alert ok toast" role="status">{SALVO[salvo]}</div>}
      <MetaView d={data} />

      <section className="meta-vendas">
        <div className="panel-head">
          <h2>{s.perfil === "gestor" ? `Vendas de ${eu.nome}` : "Minhas vendas"} · {monthLabel(mes)}</h2>
          <span className="hint">{minhasDoMes.length} lançamento(s){minhasDoMes.length ? " · toque para editar" : ""}</span>
        </div>
        {minhasDoMes.length ? <VendasLista lista={minhasDoMes} mostrarVendedor={false} mostrarCliente /> : (
          <div className="empty-state"><div className="empty-icon">🏍️</div><strong>Nenhuma venda lançada neste mês</strong><span>Use “Lançar venda” quando fechar a próxima.</span></div>
        )}
      </section>
    </>
  );
}
