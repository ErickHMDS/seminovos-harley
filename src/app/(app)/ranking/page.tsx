import Link from "next/link";
import { Atualizado, Kpi, Progress } from "@/components/ui";
import { fmt, monthLabel } from "@/lib/parse";
import { exigirPerfil } from "@/lib/sessao";
import { getVendas, ranking, resumo } from "@/lib/vendas";

export const dynamic = "force-dynamic";

const LOJAS = [
  { id: "", label: "Todas as lojas" },
  { id: "HARLEY", label: "Harley" },
  { id: "TRIUMPH", label: "Triumph" },
];

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ mes?: string; loja?: string }> }) {
  const perfil = await exigirPerfil("/ranking");
  const sp = await searchParams;
  const base = await getVendas();
  const atual = base.meses[0];
  const anos = [...new Set(base.meses.map((m) => m.slice(0, 4)))];

  const sel = sp.mes && (base.meses.includes(sp.mes) || /^ano-\d{4}$/.test(sp.mes)) ? sp.mes : atual;
  const ehAno = sel?.startsWith("ano-");
  const loja = LOJAS.some((l) => l.id === sp.loja) ? sp.loja ?? "" : "";

  const doPeriodo = base.vendas.filter((v) => (ehAno ? v.mes.startsWith(sel!.slice(4)) : v.mes === sel) && (!loja || v.loja.includes(loja)));
  // metas da aba PAINEL GERAL valem para o mês corrente
  const usaMeta = sel === atual && !loja;
  const linhas = ranking(doPeriodo, usaMeta ? base.objetivos : {}, usaMeta);
  const r = resumo(doPeriodo);
  const metaTotal = usaMeta ? Object.values(base.objetivos).reduce((a, b) => a + b, 0) : null;
  const top = linhas.slice(0, 3);
  const titulo = !sel ? "—" : ehAno ? `Ano ${sel.slice(4)}` : monthLabel(sel);
  const q = (p: Record<string, string>) => `?${new URLSearchParams({ ...(sel ? { mes: sel } : {}), ...(loja ? { loja } : {}), ...p })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Ranking de vendas</div>
          <h1>{titulo}</h1>
          <p>Vendas lançadas na planilha MOTOS 2026, por vendedor.</p>
        </div>
        <Atualizado em={base.atualizadoEm} />
      </div>

      <div className="toolbar">
        <div className="chips">
          {base.meses.slice(0, 6).map((m) => (
            <Link key={m} href={q({ mes: m })} className={`chip ${m === sel ? "active" : ""}`}>{monthLabel(m, true)}</Link>
          ))}
          {anos.map((a) => (
            <Link key={a} href={q({ mes: `ano-${a}` })} className={`chip ${sel === `ano-${a}` ? "active" : ""}`}>Ano {a}</Link>
          ))}
        </div>
        <div className="chips" style={{ marginLeft: "auto" }}>
          {LOJAS.map((l) => (
            <Link key={l.id} href={q({ loja: l.id })} className={`chip ${l.id === loja ? "active" : ""}`}>{l.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Vendas" value={r.total} tone="accent" sub={metaTotal ? `Meta da equipe: ${metaTotal} · ${fmt.pct(r.total / metaTotal)}` : undefined} />
        <Kpi label="Faturadas" value={r.faturadas} sub={`${r.total - r.faturadas} em andamento`} />
        <Kpi label="Financiamento" value={r.fin} sub={fmt.pct(r.total ? r.fin / r.total : null) + " das vendas"} />
        <Kpi label="Garantia estendida" value={r.ge} sub={fmt.pct(r.total ? r.ge / r.total : null) + " das vendas"} />
        <Kpi label="Trade-in (usado)" value={r.usado} sub={fmt.pct(r.total ? r.usado / r.total : null) + " das vendas"} />
      </div>

      {top.length > 0 && top[0].vendas > 0 && (
        <div className="podium" style={{ marginBottom: 16 }}>
          {[top[1], top[0], top[2]].map((l, i) =>
            l ? (
              <div key={l.vendedor} className={`podium-card ${i === 1 ? "p1" : ""}`}>
                <div className="podium-pos">{i === 1 ? "1º" : i === 0 ? "2º" : "3º"}</div>
                <div className="podium-name">{l.nome}</div>
                <div className="podium-num"><b>{l.vendas}</b> vendas{l.objetivo ? ` · ${fmt.pct(l.atingimento)} da meta` : ""}</div>
              </div>
            ) : <div key={i} />,
          )}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th className="r">Vendas</th>
              {usaMeta && <th style={{ minWidth: 140 }}>Meta</th>}
              <th className="r">Faturadas</th>
              <th className="r">Em andamento</th>
              <th className="r">FIN</th>
              <th className="r hide-sm">G.E</th>
              <th className="r hide-sm">Usado</th>
              <th className="r hide-sm">Seguro</th>
              <th className="r hide-sm">Harley</th>
              <th className="r hide-sm">Triumph</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.vendedor}>
                <td><span className={`rank-pos ${i < 3 && l.vendas > 0 ? "top" : ""}`}>{i + 1}</span></td>
                <td className="strong" title={l.vendedor}>{l.nome}</td>
                <td className="r strong">{l.vendas}</td>
                {usaMeta && (
                  <td>
                    {l.objetivo ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><Progress value={l.atingimento} /></div>
                        <span className="num muted" style={{ fontSize: 12, minWidth: 64, textAlign: "right" }}>{l.vendas}/{l.objetivo} · {fmt.pct(l.atingimento)}</span>
                      </div>
                    ) : <span className="faint">—</span>}
                  </td>
                )}
                <td className="r">{l.faturadas}</td>
                <td className="r">{l.pendentes || <span className="faint">0</span>}</td>
                <td className="r">{l.fin}</td>
                <td className="r hide-sm">{l.ge}</td>
                <td className="r hide-sm">{l.usado}</td>
                <td className="r hide-sm">{l.seguro}</td>
                <td className="r hide-sm">{l.harley}</td>
                <td className="r hide-sm">{l.triumph}</td>
              </tr>
            ))}
            {linhas.length === 0 && <tr><td colSpan={12} className="empty">Nenhuma venda neste período.</td></tr>}
          </tbody>
        </table>
      </div>

      {!ehAno && doPeriodo.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="panel-head"><h2>Vendas do período</h2><span className="hint">{doPeriodo.length} lançamentos</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Vendedor</th><th>Loja</th><th>Veículo</th><th>Placa</th>
                  {perfil === "gestor" && <th>Cliente</th>}
                  <th>Situação</th><th className="c">FIN</th><th className="c">G.E</th><th className="c">Usado</th>
                </tr>
              </thead>
              <tbody>
                {[...doPeriodo].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")).map((v) => (
                  <tr key={v.id}>
                    <td className="num">{fmt.date(v.data ? new Date(v.data) : null)}</td>
                    <td>{v.vendedorCurto}</td>
                    <td><span className="badge">{v.loja}</span></td>
                    <td>{v.veiculo}</td>
                    <td>{v.placa && <span className="plate">{v.placa}</span>}</td>
                    {perfil === "gestor" && <td className="muted">{v.cliente}</td>}
                    <td><span className={`badge ${v.faturada ? "ok" : "warn"}`}>{v.situacao}</span></td>
                    <td className="c">{v.fin ? "●" : <span className="faint">·</span>}</td>
                    <td className="c">{v.ge ? "●" : <span className="faint">·</span>}</td>
                    <td className="c">{v.usado ? "●" : <span className="faint">·</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
