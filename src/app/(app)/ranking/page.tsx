import Link from "next/link";
import { AtualizarDados } from "@/components/AtualizarDados";
import { Fab } from "@/components/Fab";
import { Icon } from "@/components/Icon";
import { Kpi, Progress } from "@/components/ui";
import { fmt, monthLabel } from "@/lib/parse";
import { exigirPerfil } from "@/lib/sessao";
import { getVendas, ranking, resumo } from "@/lib/vendas";

export const dynamic = "force-dynamic";

const LOJAS = [
  { id: "", label: "Todas" },
  { id: "HARLEY", label: "Harley" },
  { id: "TRIUMPH", label: "Triumph" },
];

const SALVO: Record<string, string> = { lancada: "Venda lançada na planilha.", editada: "Venda atualizada.", excluida: "Lançamento excluído." };

const SIT: Record<string, { txt: string; tom: string }> = {
  FATURADO: { txt: "faturado", tom: "ok" },
  ESTOQUE: { txt: "aguardando faturar", tom: "warn" },
  TRANSFERENCIA: { txt: "transferência", tom: "" },
  CANCELADA: { txt: "cancelada", tom: "bad" },
};

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ mes?: string; loja?: string; salvo?: string }> }) {
  const perfil = await exigirPerfil("/ranking");
  const sp = await searchParams;
  const base = await getVendas();
  const atual = base.meses[0];
  const anos = [...new Set(base.meses.map((m) => m.slice(0, 4)))];

  const sel = sp.mes && (base.meses.includes(sp.mes) || /^ano-\d{4}$/.test(sp.mes)) ? sp.mes : atual;
  const ehAno = sel?.startsWith("ano-");
  const loja = LOJAS.some((l) => l.id === sp.loja) ? sp.loja ?? "" : "";

  const doPeriodo = base.vendas.filter((v) => (ehAno ? v.mes.startsWith(sel!.slice(4)) : v.mes === sel) && (!loja || v.loja.includes(loja)));
  const usaMeta = sel === atual && !loja;
  const linhas = ranking(doPeriodo, usaMeta ? base.objetivos : {}, usaMeta);
  const r = resumo(doPeriodo);
  const metaTotal = usaMeta ? Object.values(base.objetivos).reduce((a, b) => a + b, 0) : null;
  const top = linhas.slice(0, 3);
  const titulo = !sel ? "—" : ehAno ? `Ano ${sel.slice(4)}` : monthLabel(sel);
  const q = (p: Record<string, string>) => `?${new URLSearchParams({ ...(sel ? { mes: sel } : {}), ...(loja ? { loja } : {}), ...p })}`;
  const pct = (n: number) => (r.total ? fmt.pct(n / r.total) : "—");
  const lista = [...doPeriodo].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || b.linha - a.linha);
  const editarHref = (v: (typeof lista)[number]) => `/vendas/editar?${new URLSearchParams({ aba: v.aba, linha: String(v.linha) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Ranking de vendas</div>
          <h1>{titulo}</h1>
        </div>
        <div className="head-actions">
          <AtualizarDados em={base.atualizadoEm} />
          <Link href="/vendas/nova" className="btn desktop-only"><Icon name="plus" size={16} /> Lançar venda</Link>
        </div>
      </div>

      {sp.salvo && SALVO[sp.salvo] && <div className="alert ok toast" role="status">{SALVO[sp.salvo]}</div>}

      <div className="filters">
        <div className="chips scroll">
          {base.meses.slice(0, 8).map((m) => (
            <Link key={m} href={q({ mes: m })} className={`chip ${m === sel ? "active" : ""}`} scroll={false}>{monthLabel(m, true)}</Link>
          ))}
          {anos.map((a) => (
            <Link key={a} href={q({ mes: `ano-${a}` })} className={`chip ${sel === `ano-${a}` ? "active" : ""}`} scroll={false}>{a}</Link>
          ))}
        </div>
        <div className="chips seg">
          {LOJAS.map((l) => (
            <Link key={l.id} href={q({ loja: l.id })} className={`chip ${l.id === loja ? "active" : ""}`} scroll={false}>{l.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-kpi kpi-strip">
        <Kpi label="Vendas" value={r.total} tone="accent" sub={metaTotal ? `${fmt.pct(r.total / metaTotal)} da meta (${metaTotal})` : `${r.faturadas} faturadas`} />
        <Kpi label="Faturadas" value={r.faturadas} sub={`${r.total - r.faturadas} a faturar`} />
        <Kpi label="Financiamento" value={r.fin} sub={pct(r.fin)} />
        <Kpi label="Garantia est." value={r.ge} sub={pct(r.ge)} />
        <Kpi label="Usado na troca" value={r.usado} sub={pct(r.usado)} />
      </div>

      {top.length > 0 && top[0].vendas > 0 && (
        <div className="podium">
          {[top[1], top[0], top[2]].map((l, i) =>
            l ? (
              <div key={l.vendedor} className={`podium-card ${i === 1 ? "p1" : ""}`}>
                <div className="podium-pos">{i === 1 ? "1º" : i === 0 ? "2º" : "3º"}</div>
                <div className="podium-name">{l.nome}</div>
                <div className="podium-num"><b>{l.vendas}</b> {l.vendas === 1 ? "venda" : "vendas"}</div>
              </div>
            ) : <div key={i} />,
          )}
        </div>
      )}

      {/* celular: cartões */}
      <ol className="rank-list mobile-only">
        {linhas.map((l, i) => (
          <li key={l.vendedor} className={`rank-card ${i < 3 && l.vendas > 0 ? "top" : ""}`}>
            <span className="rank-pos">{i + 1}</span>
            <div className="rank-info">
              <div className="rank-name">{l.nome}</div>
              {l.objetivo ? <Progress value={l.atingimento} /> : null}
              <div className="rank-mini">
                <span>{l.faturadas} fat.</span>{l.fin ? <span>{l.fin} fin.</span> : null}{l.ge ? <span>{l.ge} G.E</span> : null}{l.pendentes ? <span className="warn-txt">{l.pendentes} a faturar</span> : null}
              </div>
            </div>
            <div className="rank-num"><b>{l.vendas}</b>{l.objetivo ? <small>/{l.objetivo}</small> : null}</div>
          </li>
        ))}
        {linhas.length === 0 && <li className="empty">Nenhuma venda neste período.</li>}
      </ol>

      {/* computador: tabela */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Vendedor</th><th className="r">Vendas</th>
              {usaMeta && <th style={{ minWidth: 160 }}>Meta</th>}
              <th className="r">Faturadas</th><th className="r">A faturar</th><th className="r">FIN</th><th className="r">G.E</th>
              <th className="r">Usado</th><th className="r">Seguro</th><th className="r">Harley</th><th className="r">Triumph</th>
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
                <td className="r">{l.fin}</td><td className="r">{l.ge}</td><td className="r">{l.usado}</td>
                <td className="r">{l.seguro}</td><td className="r">{l.harley}</td><td className="r">{l.triumph}</td>
              </tr>
            ))}
            {linhas.length === 0 && <tr><td colSpan={12} className="empty">Nenhuma venda neste período.</td></tr>}
          </tbody>
        </table>
      </div>

      {!ehAno && lista.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="panel-head"><h2>Lançamentos</h2><span className="hint">{lista.length} · toque para editar</span></div>

          <ul className="sale-list mobile-only">
            {lista.map((v) => {
              const s = SIT[v.situacao] ?? { txt: v.situacao.toLowerCase(), tom: "" };
              return (
                <li key={v.id}>
                  <Link href={editarHref(v)} className="sale-card">
                    <div className="sale-top">
                      <strong>{v.veiculo || "—"}</strong>
                      <span className={`badge ${s.tom}`}>{s.txt}</span>
                    </div>
                    <div className="sale-meta">
                      <span>{fmt.date(v.data ? new Date(v.data) : null).slice(0, 5)}</span>
                      <span>{v.vendedorCurto}</span>
                      <span>{v.loja === "TRIUMPH" ? "Triumph" : "Harley"}</span>
                      {v.placa && <span className="plate">{v.placa}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="table-wrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Vendedor</th><th>Loja</th><th>Veículo</th><th>Placa</th>
                  {perfil === "gestor" && <th>Cliente</th>}
                  <th>Situação</th><th className="c">FIN</th><th className="c">G.E</th><th className="c">Usado</th><th />
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const s = SIT[v.situacao] ?? { txt: v.situacao.toLowerCase(), tom: "" };
                  return (
                    <tr key={v.id} className="row-link">
                      <td className="num">{fmt.date(v.data ? new Date(v.data) : null)}</td>
                      <td>{v.vendedorCurto}</td>
                      <td><span className="badge">{v.loja}</span></td>
                      <td>{v.veiculo}</td>
                      <td>{v.placa && <span className="plate">{v.placa}</span>}</td>
                      {perfil === "gestor" && <td className="muted">{v.cliente}</td>}
                      <td><span className={`badge ${s.tom}`}>{s.txt}</span></td>
                      <td className="c">{v.fin ? "●" : <span className="faint">·</span>}</td>
                      <td className="c">{v.ge ? "●" : <span className="faint">·</span>}</td>
                      <td className="c">{v.usado ? "●" : <span className="faint">·</span>}</td>
                      <td className="r"><Link href={editarHref(v)} className="link-more">Editar</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Fab href="/vendas/nova" label="Lançar venda" />
    </>
  );
}
