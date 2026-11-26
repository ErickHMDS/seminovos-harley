import Link from "next/link";
import { objetivosVigentes } from "@/lib/metas";
import { AtualizarDados } from "@/components/AtualizarDados";
import { Bars, Columns, Kpi, Progress } from "@/components/ui";
import { getAtividades } from "@/lib/atividades";
import { FAIXAS, faixa, getEstoque } from "@/lib/estoque";
import { fmt, monthLabel } from "@/lib/parse";
import { ETAPAS, getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { getVendas, ranking, resumo } from "@/lib/vendas";

export const dynamic = "force-dynamic";

export default async function GestorPage() {
  await exigirPerfil("/gestor");
  const [base, { motos }, prep, atividades] = await Promise.all([getVendas(), getEstoque(), getPreparacao().catch(() => null), getAtividades().catch(() => [])]);
  const objs = await objetivosVigentes(base);
  const tarefas = atividades.filter((a) => a.aberta);

  const mes = base.meses[0];
  const doMes = base.vendas.filter((v) => v.mes === mes);
  const r = resumo(doMes);
  const rank = ranking(doMes, objs, true);
  const metaTotal = Object.values(objs).reduce((a, b) => a + b, 0) || null;
  const emAndamento = doMes.filter((v) => v.conta && !v.faturada && !v.historico);

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
    href: `/estoque?faixa=${encodeURIComponent(f.id)}`,
  }));
  const porLoja = Object.values(
    motos.reduce<Record<string, { label: string; value: number; href: string }>>((acc, m) => {
      const marca = m.marca === "TRIUMPH" ? "TRIUMPH" : "HARLEY";
      const k = `${marca === "TRIUMPH" ? "Triumph" : "Freedom"} · ${m.cidade}`;
      acc[k] ??= { label: k, value: 0, href: `/estoque?${new URLSearchParams({ marca, cidade: m.cidade })}` };
      acc[k].value++;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);
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
        </div>
        <div className="head-actions">
          <AtualizarDados em={base.atualizadoEm} />
          <Link href="/cadastro" className="btn ghost small">Cadastro</Link>
          <Link href="/catalogo" className="btn ghost small">Catálogo</Link>
        </div>
      </div>

      <div className="grid grid-kpi kpi-strip">
        <Kpi label="Vendas no mês" value={r.total} tone="accent"
          sub={<>{metaTotal ? `${fmt.pct(r.total / metaTotal)} da meta (${metaTotal})` : ""}{vendasMesAnterior != null ? ` · mês anterior: ${vendasMesAnterior}` : ""}</>} />
        <Kpi label="Faturadas" value={r.faturadas} sub={`${emAndamento.length} em andamento`} />
        <Kpi label="Motos em estoque" value={motos.length} sub={`idade média ${idadeMedia} dias · ${naoAnunciadas} sem anúncio`} />
        <Kpi label="+ de 90 dias" value={acima90.length} tone={acima90.length ? "bad" : undefined} sub={`${fmt.pct(motos.length ? acima90.length / motos.length : null)} do estoque`} />
        <Kpi label="Custo em estoque" value={<span style={{ fontSize: "1.5rem" }}>{fmt.brl(custo)}</span>} sub={`margem potencial ${fmt.brl(margem)}`} />
        <Kpi label="Em preparação" value={ativos.length} tone={atrasadas.length ? "warn" : undefined} sub={atrasadas.length ? `${atrasadas.length} atrasada(s) no fornecedor` : "nenhuma atrasada"} />
        <Link href="/atividades" className="kpi-link"><Kpi label="Atividades" value={tarefas.length} tone={tarefas.length ? "warn" : undefined} sub={tarefas.length ? "abertas · resolver →" : "nada pendente"} /></Link>
      </div>

      {tarefas.length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h2>Atividades para resolver</h2><Link href="/atividades" className="hint accent">ver todas →</Link></div>
          <ul className="simple-list">
            {tarefas.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link href="/atividades" className="simple-row">
                  {a.placa ? <span className="plate">{a.placa}</span> : <span className="badge">avulsa</span>}
                  <span className="simple-main">{a.descricao}</span>
                  <span className="faint simple-side">{a.criadaEm.split(",")[0].slice(0, 5)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head"><h2>Ranking do mês</h2><Link href="/ranking" className="hint accent">ver completo →</Link></div>
          <div className="stack" style={{ gap: 12 }}>
            {rank.slice(0, 7).map((l, i) => (
              <Link key={l.vendedor} href={`/meta?v=${encodeURIComponent(l.vendedor)}`} className="rank-link" title={`Ver a meta de ${l.nome}`} style={{ display: "grid", gridTemplateColumns: "2ch 1fr auto", gap: 10, alignItems: "center" }}>
                <span className={`rank-pos ${i < 3 && l.vendas ? "top" : ""}`}>{i + 1}</span>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                    <span className="strong">{l.nome}</span>
                    <span className="num muted">{l.vendas}{l.objetivo ? ` / ${l.objetivo}` : ""}</span>
                  </div>
                  <Progress value={l.objetivo ? l.atingimento : l.vendas / Math.max(1, rank[0]?.vendas ?? 1)} />
                </div>
                <span className="num faint" style={{ fontSize: 12, minWidth: 36, textAlign: "right" }}>{l.objetivo ? fmt.pct(l.atingimento) : ""}</span>
              </Link>
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
          <div className="panel-head"><h2>Idade do estoque</h2><Link href="/estoque" className="hint accent">abrir estoque →</Link></div>
          <Bars data={porFaixa} />
          <div className="kpi-label" style={{ margin: "18px 0 8px" }}>Por loja</div>
          <Bars tone="alt" data={porLoja} />
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Preparação</h2><Link href="/preparacao" className="hint accent">abrir quadro →</Link></div>
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
        <section className="panel">
          <div className="panel-head"><h2>Motos mais paradas</h2><Link href="/estoque" className="hint accent">estoque →</Link></div>
          <ul className="simple-list">
            {motos.slice(0, 8).map((m) => {
              const mg = m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : null;
              return (
                <li key={m.id}>
                  <Link href={`/estoque/ver?${new URLSearchParams({ aba: m.aba, linha: String(m.linha) })}`} className="simple-row">
                    <span className={`badge ${(m.dias ?? 0) > 90 ? "bad" : (m.dias ?? 0) > 60 ? "warn" : "ok"}`}>{m.dias}d</span>
                    <span className="simple-main">{m.modelo}<small>{m.placa} · {m.cidade}{mg != null ? ` · margem ${fmt.brl(mg)}` : ""}</small></span>
                    <span className="simple-side strong">{fmt.brl(m.realinhamento)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>A faturar</h2><span className="hint">vendidas, ainda não faturadas</span></div>
          {emAndamento.length === 0 ? <div className="faint" style={{ fontSize: 14 }}>Todas as vendas do mês estão faturadas.</div> : (
            <ul className="simple-list">
              {emAndamento.map((v) => (
                <li key={v.id}>
                  <Link href={`/vendas/editar?${new URLSearchParams({ aba: v.aba, linha: String(v.linha) })}`} className="simple-row">
                    <span className="badge warn">{v.situacao === "ESTOQUE" ? "a faturar" : v.situacao.toLowerCase()}</span>
                    <span className="simple-main">{v.veiculo}<small>{v.vendedorCurto}{v.cliente ? ` · ${v.cliente}` : ""}</small></span>
                    <span className="faint simple-side">{fmt.date(v.data ? new Date(v.data) : null).slice(0, 5)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {base.semData > 0 && (
        <p className="faint" style={{ fontSize: 12, marginTop: 24 }}>
          {base.semData} linha(s) da aba VENDAS estão sem DATA DA VENDA válida e não entram em nenhum mês — confira na planilha.
        </p>
      )}
    </>
  );
}
