"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Ind = { eu: number; equipe: number };
export type MetaVM = {
  nome: string; mes: string; vendas: number; faturadas: number; meta: number | null; faltam: number; projecao: number;
  dias: { total: number; passados: number; restantes: number; ehMesAtual: boolean };
  pos: number; totalVendedores: number; acima: { nome: string; vendas: number } | null; abaixo: { nome: string; vendas: number } | null; lider: { nome: string; vendas: number } | null;
  escada: { nome: string; vendas: number; eu: boolean; pos: number }[];
  qualidade: { fin: Ind; ge: Ind; usado: Ind; seguro: Ind }; historico: { label: string; value: number; atual: boolean }[]; melhorMes: number; amostra3: number;
  leads: { ativos: number; oportunidades: number; retornos: number; clientesOportunidade: { id: string; cliente: string; moto: string }[] };
  aFaturar: { veiculo: string; cliente: string; aba: string; linha: number }[];
  paradas: { modelo: string; placa: string; dias: number; preco: number | null; cidade: string }[];
  hoje: string;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Anel({ valor, meta }: { valor: number; meta: number | null }) {
  const [p, setP] = useState(0);
  const alvo = meta ? Math.min(1, valor / meta) : valor ? 1 : 0;
  useEffect(() => { const t = setTimeout(() => setP(alvo), 120); return () => clearTimeout(t); }, [alvo]);
  const r = 70, c = 2 * Math.PI * r;
  return (
    <svg className="anel" viewBox="0 0 180 180" role="img" aria-label={meta ? `${valor} de ${meta} vendas` : `${valor} vendas`}>
      <defs>
        <linearGradient id="anelG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9c0e15" /><stop offset=".55" stopColor="#d7141c" /><stop offset="1" stopColor="#ff4b55" /></linearGradient>
      </defs>
      <circle cx="90" cy="90" r={r} className="anel-fundo" />
      <circle cx="90" cy="90" r={r} className="anel-valor" stroke="url(#anelG)" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 90 90)" />
      <text x="90" y="88" textAnchor="middle" className="anel-num">{valor}</text>
      <text x="90" y="114" textAnchor="middle" className="anel-sub">{meta ? `de ${meta} vendas` : "vendas no mês"}</text>
    </svg>
  );
}

type Tarefa = { id: string; texto: string; href?: string; destaque?: boolean };

function Plano({ tarefas, hoje }: { tarefas: Tarefa[]; hoje: string }) {
  const chave = `plano-${hoje}`;
  const [feitas, setFeitas] = useState<string[]>([]);
  useEffect(() => { try { setFeitas(JSON.parse(localStorage.getItem(chave) ?? "[]")); } catch { /* sem armazenamento */ } }, [chave]);
  const alternar = (id: string) => setFeitas((f) => {
    const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
    try { localStorage.setItem(chave, JSON.stringify(n)); } catch { /* sem armazenamento */ }
    return n;
  });
  const feitasN = tarefas.filter((t) => feitas.includes(t.id)).length;
  return (
    <section className="meta-card plano">
      <div className="meta-card-head"><h2>Plano de hoje</h2><span className={`badge ${feitasN === tarefas.length && tarefas.length ? "ok" : ""}`}>{feitasN}/{tarefas.length}</span></div>
      <ul>
        {tarefas.map((t) => {
          const ok = feitas.includes(t.id);
          return (
            <li key={t.id} className={`${ok ? "feito" : ""} ${t.destaque ? "destaque" : ""}`}>
              <button type="button" className="plano-check" aria-pressed={ok} onClick={() => alternar(t.id)} aria-label={ok ? "Desmarcar" : "Marcar como feito"}>{ok ? "✓" : ""}</button>
              {t.href ? <Link href={t.href} className="plano-txt">{t.texto} <span className="plano-ir">→</span></Link> : <span className="plano-txt">{t.texto}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MetaView({ d }: { d: MetaVM }) {
  const porDia = d.faltam && d.dias.restantes ? d.faltam / d.dias.restantes : 0;
  const cadaN = porDia ? Math.max(1, Math.round(1 / porDia)) : 0;
  const porSemana = porDia ? Math.ceil(porDia * 6) : 0;
  const noRitmo = d.meta ? d.projecao >= d.meta : true;
  const bateu = d.meta != null && d.vendas >= d.meta;

  const manchete = bateu ? "🏆 Meta batida! Cada venda agora é bônus."
    : !d.meta ? "Sem meta no painel — cada venda conta."
    : noRitmo ? `No ritmo certo: projeção de ${d.projecao} vendas.`
    : `Faltam ${d.faltam} venda${d.faltam > 1 ? "s" : ""} em ${d.dias.restantes} dia${d.dias.restantes === 1 ? "" : "s"} de loja.`;

  const tarefas = useMemo<Tarefa[]>(() => {
    const t: Tarefa[] = [];
    if (d.leads.oportunidades) t.push({ id: "op", texto: `Ligar para ${d.leads.oportunidades} cliente${d.leads.oportunidades > 1 ? "s" : ""} com moto compatível no estoque`, href: "/leads", destaque: true });
    if (d.leads.retornos) t.push({ id: "ret", texto: `Retornar ${d.leads.retornos} cliente${d.leads.retornos > 1 ? "s" : ""} agendado${d.leads.retornos > 1 ? "s" : ""} para hoje`, href: "/leads", destaque: true });
    if (d.aFaturar.length) t.push({ id: "fat", texto: `Destravar ${d.aFaturar.length} venda${d.aFaturar.length > 1 ? "s" : ""} aguardando faturamento (documentação)` });
    if (!bateu && d.meta && porDia) t.push({ id: "ritmo", texto: cadaN > 1 ? `Meta do ritmo: fechar 1 venda a cada ${cadaN} dias de loja (${porSemana} por semana)` : `Meta do ritmo: ${Math.ceil(porDia)} venda${Math.ceil(porDia) > 1 ? "s" : ""} por dia de loja` });
    if (d.qualidade.ge.eu < d.qualidade.ge.equipe) t.push({ id: "ge", texto: `Oferecer garantia estendida em toda negociação (você ${pct(d.qualidade.ge.eu)} × equipe ${pct(d.qualidade.ge.equipe)})` });
    if (d.qualidade.fin.eu < d.qualidade.fin.equipe) t.push({ id: "fin", texto: `Apresentar simulação de financiamento logo no início (você ${pct(d.qualidade.fin.eu)} × equipe ${pct(d.qualidade.fin.equipe)})` });
    if (d.paradas.length) t.push({ id: "parada", texto: `Oferecer ${d.paradas[0].modelo} — parada há ${d.paradas[0].dias} dias`, href: "/estoque" });
    if (d.leads.ativos < 5) t.push({ id: "leads", texto: "Cadastrar todo cliente que não fechar hoje como lead (o app avisa quando chegar a moto)", href: "/leads/novo" });
    return t;
  }, [d, bateu, porDia, cadaN, porSemana]);

  const max = Math.max(1, ...d.historico.map((h) => h.value), d.meta ?? 0);

  return (
    <div className="meta">
      <div className="meta-topo">
      <section className={`meta-hero ${bateu ? "bateu" : noRitmo ? "ritmo" : "acelera"}`}>
        <Anel valor={d.vendas} meta={d.meta} />
        <div className="meta-hero-txt">
          <div className="meta-manchete">{manchete}</div>
          <div className="meta-pills">
            {d.meta && !bateu && porDia > 0 && <span className="pill quente">{cadaN > 1 ? `1 venda a cada ${cadaN} dias` : `${Math.ceil(porDia)}/dia`}</span>}
            {d.meta && !bateu && porSemana > 0 && <span className="pill">≈ {porSemana} por semana</span>}
            <span className="pill">{d.dias.restantes} dias de loja restantes</span>
            <span className="pill">projeção {d.projecao}</span>
            <span className="pill">{d.faturadas} faturada{d.faturadas === 1 ? "" : "s"}</span>
          </div>
          <div className="meta-barra-dias" aria-hidden>
            <span style={{ width: `${(d.dias.passados / Math.max(1, d.dias.total)) * 100}%` }} />
            {d.meta ? <i style={{ left: `${Math.min(100, (d.vendas / d.meta) * 100)}%` }} title="sua meta" /> : null}
          </div>
          <div className="meta-legenda"><span>mês {pct(d.dias.passados / Math.max(1, d.dias.total))} passado</span>{d.meta ? <span>meta {pct(Math.min(1, d.vendas / d.meta))} feita</span> : null}</div>
        </div>
      </section>
        <section className="meta-card meta-ofertas">
          <div className="meta-card-head"><h2>Motos para oferecer</h2><span className="faint" style={{ fontSize: 12 }}>paradas há mais tempo</span></div>
          {d.paradas.length === 0 ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>Nenhuma moto anunciada parada há mais de 60 dias.</p> : (
            <ul className="simple-list">
              {d.paradas.slice(0, 4).map((m) => <li key={m.placa}><Link href={`/estoque/ver?placa=${encodeURIComponent(m.placa)}`} className="simple-row"><span className="badge bad">{m.dias}d</span><span className="simple-main">{m.modelo}<small>{m.placa} · {m.cidade}</small></span><span className="simple-side strong">{m.preco != null ? brl.format(m.preco) : ""}</span></Link></li>)}
            </ul>
          )}
        </section>
      </div>

      <div className="meta-grid meta-3">
        <Plano tarefas={tarefas} hoje={d.hoje} />

        <section className="meta-card">
          <div className="meta-card-head"><h2>Ranking</h2><span className="badge accent">{d.pos}º de {d.totalVendedores}</span></div>
          <p className="meta-frase">
            {d.pos === 1 ? `Você lidera o mês${d.abaixo ? ` — ${d.vendas - d.abaixo.vendas} à frente de ${d.abaixo.nome.split(" ")[0]}` : ""}. Segura!`
              : d.acima ? `Faltam ${d.acima.vendas - d.vendas + 1} venda${d.acima.vendas - d.vendas + 1 > 1 ? "s" : ""} para passar ${d.acima.nome.split(" ")[0]}.` : ""}
          </p>
          <ol className="escada">
            {d.escada.map((e) => (
              <li key={e.nome} className={e.eu ? "eu" : ""}>
                <span className="escada-pos">{e.pos}</span>
                <span className="escada-nome">{e.eu ? "Você" : e.nome}</span>
                <span className="escada-bar"><span style={{ width: `${(e.vendas / Math.max(1, d.lider?.vendas ?? 1)) * 100}%` }} /></span>
                <strong>{e.vendas}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="meta-card">
          <div className="meta-card-head"><h2>Qualidade das vendas</h2><span className="faint" style={{ fontSize: 12 }}>últimos 3 meses · {d.amostra3} vendas</span></div>
          {([["fin", "Financiamento"], ["ge", "Garantia estendida"], ["usado", "Usado na troca"], ["seguro", "Seguro"]] as const).map(([k, label]) => {
            const q = d.qualidade[k];
            const melhor = q.eu >= q.equipe;
            return (
              <div key={k} className="vs">
                <div className="vs-top"><span>{label}</span><span className={melhor ? "ok-txt" : "warn-txt"}>{pct(q.eu)} <small className="faint">equipe {pct(q.equipe)}</small></span></div>
                <div className="vs-bar"><span className={melhor ? "ok" : ""} style={{ width: `${q.eu * 100}%` }} /><i style={{ left: `${q.equipe * 100}%` }} /></div>
              </div>
            );
          })}
        </section>
      </div>

      <div className="meta-grid meta-3">

        <section className="meta-card">
          <div className="meta-card-head"><h2>Seus meses</h2>{d.melhorMes > 0 && <span className="faint" style={{ fontSize: 12 }}>recorde: {d.melhorMes}</span>}</div>
          <div className="mini-cols">
            {d.historico.map((h) => (
              <div key={h.label} className="mini-col">
                <span className="mini-v">{h.value}</span>
                <span className={`mini-bar ${h.atual ? "atual" : ""} ${h.value === d.melhorMes && h.value ? "recorde" : ""}`} style={{ height: `${(h.value / max) * 100}%` }} />
                <span className="mini-l">{h.label}</span>
              </div>
            ))}
            {d.meta ? <i className="mini-meta" style={{ bottom: `calc(${(d.meta / max) * 100}% * 0.72 + 22px)` }}><span>meta {d.meta}</span></i> : null}
          </div>
        </section>

        <section className="meta-card">
          <div className="meta-card-head"><h2>Seus clientes</h2><Link href="/leads" className="link-more">leads →</Link></div>
          <div className="meta-nums">
            <Link href="/leads" className={`meta-num ${d.leads.oportunidades ? "quente" : ""}`}><b>{d.leads.oportunidades}</b><span>com moto compatível</span></Link>
            <Link href="/leads" className={`meta-num ${d.leads.retornos ? "morno" : ""}`}><b>{d.leads.retornos}</b><span>retornar hoje</span></Link>
            <Link href="/leads" className="meta-num"><b>{d.leads.ativos}</b><span>leads ativos</span></Link>
          </div>
          {d.leads.clientesOportunidade.length > 0 && (
            <ul className="simple-list" style={{ marginTop: 8 }}>
              {d.leads.clientesOportunidade.map((c) => (
                <li key={c.id}><Link href={`/leads/${c.id}`} className="simple-row"><span className="badge ok">ligar</span><span className="simple-main">{c.cliente}<small>{c.moto}</small></span></Link></li>
              ))}
            </ul>
          )}
        </section>

        <section className="meta-card">
          <div className="meta-card-head"><h2>A faturar</h2><span className={`badge ${d.aFaturar.length ? "warn" : "ok"}`}>{d.aFaturar.length}</span></div>
          {d.aFaturar.length === 0 ? <p className="faint" style={{ margin: 0, fontSize: 13 }}>Todas as suas vendas do mês estão faturadas.</p> : (
            <ul className="simple-list">
              {d.aFaturar.map((v) => <li key={v.aba + v.linha}><Link className="simple-row" href={`/vendas/editar?${new URLSearchParams({ aba: v.aba, linha: String(v.linha) })}`}><span className="simple-main">{v.veiculo}<small>{v.cliente}</small></span><span className="link-more">atualizar →</span></Link></li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
