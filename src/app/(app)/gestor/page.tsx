import Link from "next/link";
import { Atualizado, Bars, Columns, Kpi, Progress } from "@/components/ui";
import { FAIXAS, faixa, getEstoque } from "@/lib/estoque";
import { fmt, monthLabel } from "@/lib/parse";
import { ETAPAS, getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { getVendas, ranking, resumo } from "@/lib/vendas";

export const dynamic = "force-dynamic";

export default async function GestorPage() {
  await exigirPerfil("/gestor");
  const [base, { motos }, prep] = await Promise.all([getVendas(), getEstoque(), getPreparacao().catch(() => null)]);

  const mes = base.meses[0];
  const doMes = base.vendas.filter((v) => v.mes === mes);
  const r = resumo(doMes);
  const rank = ranking(doMes, base.objetivos, true);
  const metaTotal = Object.values(base.objetivos).reduce((a, b) => a + b, 0) || null;
  const emAndamento = doMes.filter((v) => !v.faturada);

  // histórico: 12 meses corridos até o mês atual (mês sem aba aparece como 0)
  const historico = mes
    ? Array.from({ length: 12 }, (_, i) => {
        const [y, mm] = mes.split("-").map(Number);
        const d = new Date(y, mm - 1 - (11 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return { label: monthLabel(key, true), value: base.vendas.filter((v) => v.mes === key).length, current: key === mes };
      })
    : [];
  const mesAnterior = base.meses[1];
  const vendasMesAnterior = mesAnterior ? base.vendas.filter((v) => v.mes === mesAnterior).length : null;

  // estoque
  const acima90 = motos.filter((m) => (m.dias ?? 0) > 90);
  const custo = motos.reduce((s, m) => s + (m.custo ?? 0), 0);
  const margem = motos.reduce((s, m) => s + (m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : 0), 0);
  const idadeMedia = motos.length ? Math.round(motos.reduce((s, m) => s + (m.dias ?? 0), 0) / motos.length) : 0;
  const porFaixa = FAIXAS.map((f, i) => ({
    label: f.label,
    value: motos.filter((m) => faixa(m.dias)?.id === f.id).length,
    tone: (i === 3 ? "bad" : i === 2 ? "warn" : undefined) as "bad" | "warn" | undefined,
  }));
  const porLoja = Object.entries(
    motos.reduce<Record<string, number>>((acc, m) => {
      const k = `${m.marca === "TRIUMPH" ? "Triumph" : "Freedom"} · ${m.cidade}`;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  const naoAnunciadas = motos.filter((m) => !m.anunciada).length;

  // preparação
  const itens = prep?.itens ?? [];
  const ativos = itens.filter((p) => p.etapa !== "FINALIZADA");
  const atrasadas = ativos.filter((p) => p.atrasada);
  const pendencias = [
    ...atrasadas.map((p) => ({ p, txt: `atrasada no fornecedor (prazo ${p.prazoEntrega})`, tone: "bad" })),
    ...ativos.filter((p) => p.etapa === "FORNECEDOR" && !p.emailEnviado).map((p) => ({ p, txt: "e-mail ao coordenador pendente", tone: "warn" })),
    ...ativos.filter((p) => p.etapa === "FOTOS" && !p.postadoRedes).map((p) => ({ p, txt: "aguardando fotos/postagem", tone: "warn" })),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Visão do gestor</div>
          <h1>{mes ? monthLabel(mes) : "Painel"}</h1>
          <p>Vendas, estoque e preparação em uma tela.</p>
        </div>
        <Atualizado em={base.atualizadoEm} />
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Vendas no mês" value={r.total} tone="accent"
          sub={<>{metaTotal ? `${fmt.pct(r.total / metaTotal)} da meta (${metaTotal})` : ""}{vendasMesAnterior != null ? ` · mês anterior: ${vendasMesAnterior}` : ""}</>} />
        <Kpi label="Faturadas" value={r.faturadas} sub={`${emAndamento.length} em andamento`} />
        <Kpi label="Motos em estoque" value={motos.length} sub={`idade média ${idadeMedia} dias · ${naoAnunciadas} sem anúncio`} />
        <Kpi label="+ de 90 dias" value={acima90.length} tone={acima90.length ? "bad" : undefined} sub={`${fmt.pct(motos.length ? acima90.length / motos.length : null)} do estoque`} />
        <Kpi label="Custo em estoque" value={<span style={{ fontSize: "1.5rem" }}>{fmt.brl(custo)}</span>} sub={`margem potencial ${fmt.brl(margem)}`} />
        <Kpi label="Em preparação" value={ativos.length} tone={atrasadas.length ? "warn" : undefined} sub={atrasadas.length ? `${atrasadas.length} atrasada(s) no fornecedor` : "nenhuma atrasada"} />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head"><h2>Ranking do mês</h2><Link href="/ranking" className="hint orange">ver completo →</Link></div>
          <div className="stack" style={{ gap: 12 }}>
            {rank.slice(0, 7).map((l, i) => (
              <div key={l.vendedor} style={{ display: "grid", gridTemplateColumns: "2ch 1fr auto", gap: 10, alignItems: "center" }}>
                <span className={`rank-pos ${i < 3 && l.vendas ? "top" : ""}`}>{i + 1}</span>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                    <span className="strong">{l.nome}</span>
                    <span className="num muted">{l.vendas}{l.objetivo ? ` / ${l.objetivo}` : ""}</span>
                  </div>
                  <Progress value={l.objetivo ? l.atingimento : l.vendas / Math.max(1, rank[0]?.vendas ?? 1)} />
                </div>
                <span className="num faint" style={{ fontSize: 12, minWidth: 36, textAlign: "right" }}>{l.objetivo ? fmt.pct(l.atingimento) : ""}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Vendas por mês</h2><span className="hint">últimos {historico.length} meses</span></div>
          <Columns data={historico} />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 18, gap: 18 }}>
            <div><div className="kpi-label" style={{ marginBottom: 8 }}>Por loja (mês)</div><Bars data={r.porLoja.map(([label, value]) => ({ label, value }))} /></div>
            <div><div className="kpi-label" style={{ marginBottom: 8 }}>Situação (mês)</div><Bars tone="alt" data={r.porSituacao.map(([label, value]) => ({ label: label.toLowerCase(), value }))} /></div>
          </div>
        </section>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head"><h2>Idade do estoque</h2><Link href="/estoque" className="hint orange">abrir estoque →</Link></div>
          <Bars data={porFaixa} />
          <div className="kpi-label" style={{ margin: "18px 0 8px" }}>Por loja</div>
          <Bars tone="alt" data={porLoja} />
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Preparação</h2><Link href="/preparacao" className="hint orange">abrir quadro →</Link></div>
          {prep ? (
            <>
              <Bars data={ETAPAS.map((e) => ({ label: e.curto, value: itens.filter((p) => p.etapa === e.id).length, href: "/preparacao" }))} />
              <div className="kpi-label" style={{ margin: "18px 0 8px" }}>Pendências</div>
              {pendencias.length === 0 ? <div className="faint" style={{ fontSize: 14 }}>Nenhuma pendência.</div> : (
                <div className="stack" style={{ gap: 8 }}>
                  {pendencias.slice(0, 6).map(({ p, txt, tone }) => (
                    <Link key={p.id + txt} href={`/preparacao/${encodeURIComponent(p.id)}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, flexWrap: "wrap" }}>
                      {p.placa && <span className="plate">{p.placa}</span>} <span>{p.modelo}</span> <span className={`badge ${tone}`}>{txt}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : <div className="faint">Não foi possível ler a aba de preparação.</div>}
        </section>
      </div>

      <div className="grid grid-2">
        <section>
          <div className="panel-head"><h2>Motos mais paradas</h2><span className="hint">priorizar ações de venda</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Placa</th><th>Modelo</th><th className="r">Dias</th><th className="r">Preço</th><th className="r">Margem</th></tr></thead>
              <tbody>
                {motos.slice(0, 8).map((m) => (
                  <tr key={m.id}>
                    <td><span className="plate">{m.placa}</span></td>
                    <td>{m.modelo}<div className="faint" style={{ fontSize: 12 }}>{m.cidade} · {m.status.toLowerCase()}</div></td>
                    <td className="r"><span className={`badge ${(m.dias ?? 0) > 90 ? "bad" : (m.dias ?? 0) > 60 ? "warn" : "ok"}`}>{m.dias}</span></td>
                    <td className="r">{fmt.brl(m.realinhamento)}</td>
                    <td className="r" style={{ color: m.realinhamento != null && m.custo != null && m.realinhamento - m.custo < 0 ? "var(--bad)" : undefined }}>
                      {m.realinhamento != null && m.custo != null ? fmt.brl(m.realinhamento - m.custo) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="panel-head"><h2>Vendas em andamento</h2><span className="hint">ainda não faturadas</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Vendedor</th><th>Veículo</th><th>Situação</th></tr></thead>
              <tbody>
                {emAndamento.map((v) => (
                  <tr key={v.id}>
                    <td className="num">{fmt.date(v.data ? new Date(v.data) : null)}</td>
                    <td>{v.vendedorCurto}</td>
                    <td>{v.veiculo}{v.placa && <> <span className="plate">{v.placa}</span></>}<div className="faint" style={{ fontSize: 12 }}>{v.cliente}</div></td>
                    <td><span className="badge warn">{v.situacao.toLowerCase()}</span></td>
                  </tr>
                ))}
                {emAndamento.length === 0 && <tr><td colSpan={4} className="empty">Todas as vendas do mês estão faturadas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {base.abasIgnoradas.some((a) => a.motivo.startsWith("duplicada")) && (
        <p className="faint" style={{ fontSize: 12, marginTop: 24 }}>
          Abas ignoradas por repetirem um mês já lido: {base.abasIgnoradas.filter((a) => a.motivo.startsWith("duplicada")).map((a) => `“${a.aba.trim()}”`).join(", ")}.
        </p>
      )}
    </>
  );
}
