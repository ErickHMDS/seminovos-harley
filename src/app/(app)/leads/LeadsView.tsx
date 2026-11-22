"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { contatoAction } from "./actions";
import { STATUS, statusDe } from "@/lib/leadsStatus";
import type { LeadVM } from "./dados";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function telLink(t: string) { return `tel:${t.replace(/[^\d+]/g, "")}`; }
export function waLink(t: string, msg: string) {
  const d = t.replace(/\D/g, "");
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(msg)}`;
}
export function mensagem(l: LeadVM, m: LeadVM["matches"][number], vendedor: string) {
  const moto = `${m.fabricante ? `${m.fabricante} ` : ""}${m.modelo}${m.ano ? ` ${m.ano}` : ""}`.trim();
  const extra = m.tipoMatch === "exato" ? "exatamente a moto que você procurava" : `uma opção equivalente à ${l.desejo}`;
  return `Olá, ${l.cliente.split(" ")[0]}! Aqui é ${vendedor.split(" ")[0]}, da Servopa Seminovos. ${m.emPreparacao ? "Está chegando" : "Chegou"} uma ${moto} — ${extra}. Quer que eu te mande fotos e condições?`;
}

/** Ações de contato sobre uma moto (ou geral). */
export function Contato({ l, placa = "", vendedor, compacto = false }: { l: LeadVM; placa?: string; vendedor: string; compacto?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const [proximo, setProximo] = useState("");
  const [pending, start] = useTransition();
  const [erro, setErro] = useState("");
  const m = l.matches.find((x) => x.placa === placa);
  const msg = m ? mensagem(l, m, vendedor) : `Olá, ${l.cliente.split(" ")[0]}! Aqui é ${vendedor.split(" ")[0]}, da Servopa Seminovos. Tudo bem?`;
  return (
    <div className="contato">
      <div className="contato-btns">
        <a className="btn small" href={telLink(l.telefone)}><Icon name="leads" size={14} /> Ligar</a>
        <a className="btn small ghost" href={waLink(l.telefone, msg)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button type="button" className={`btn small ghost ${aberto ? "on" : ""}`} onClick={() => setAberto((a) => !a)}>✓ Contato feito</button>
      </div>
      {aberto && (
        <div className="contato-form">
          <input className="input" placeholder={compacto ? "Como foi?" : "Como foi a conversa? (opcional)"} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          <label className="contato-prox"><span>Retornar em</span><input type="date" className="input" value={proximo} onChange={(e) => setProximo(e.target.value)} /></label>
          <button type="button" className="btn small" disabled={pending}
            onClick={() => start(async () => { const r = await contatoAction(l.id, nota, placa, proximo); if (r.erro) setErro(r.erro); else { setAberto(false); router.refresh(); } })}>
            {pending ? "Salvando…" : "Registrar"}
          </button>
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
    </div>
  );
}

export function MatchChip({ m }: { m: LeadVM["matches"][number] }) {
  return (
    <div className="match">
      <Link href={`/estoque/ver?placa=${encodeURIComponent(m.placa)}`} className="match-top" title="Ver a ficha da moto">
        <span className="plate">{m.placa}</span>
        <strong>{m.modelo}</strong>
        <span className="match-ir" aria-hidden>ver ficha →</span>
      </Link>
      <div className="match-meta">
        <span className={`badge ${m.tipoMatch === "exato" ? "ok" : "accent"}`}>{m.tipoMatch === "exato" ? "exato" : m.tipoMatch === "equivalente" ? "equivalente" : "mesmo tipo"}</span>
        {m.emPreparacao && <span className="badge warn">em preparação</span>}
        {m.nova && !m.emPreparacao && <span className="badge ok">chegou agora</span>}
        <span>{[m.fabricante, m.ano, m.cidade].filter(Boolean).join(" · ")}</span>
        {m.preco != null && <span className="strong">{brl.format(m.preco)}</span>}
      </div>
    </div>
  );
}

export function LeadsView({ leads, gestor, vendedores, nomeVendedor, filtroInicial = "", vendedorInicial = "" }: { leads: LeadVM[]; gestor: boolean; vendedores: { id: string; nome: string }[]; nomeVendedor: string; filtroInicial?: string; vendedorInicial?: string }) {
  const [status, setStatus] = useState(filtroInicial || "ativos");
  const [q, setQ] = useState("");
  const [vend, setVend] = useState(vendedorInicial);
  const base = useMemo(() => leads.filter((l) => !vend || l.vendedorId === vend), [leads, vend]);
  const oportunidades = base.filter((l) => l.matches.length > 0);
  const retornos = base.filter((l) => l.retornoHoje);
  const lista = base
    .filter((l) => (status === "ativos" ? !["VENDIDO", "PERDIDO"].includes(l.status) : status === "syonet" ? !l.syonet && l.status !== "PERDIDO" : status === "todos" || l.status === status))
    .filter((l) => !q || `${l.cliente} ${l.desejo} ${l.telefone}`.toUpperCase().includes(q.toUpperCase()))
    .sort((a, b) => b.matches.length - a.matches.length || Number(b.retornoHoje) - Number(a.retornoHoje) || b.criadoEm.localeCompare(a.criadoEm));
  const conta = (id: string) => base.filter((l) => l.status === id).length;

  return (
    <>
      <div className="grid grid-kpi kpi-strip">
        <div className="kpi accent"><div className="kpi-label">Oportunidades</div><div className="kpi-value">{oportunidades.length}</div><div className="kpi-sub">clientes com moto compatível</div></div>
        <div className={`kpi ${retornos.length ? "warn" : ""}`}><div className="kpi-label">Retornar hoje</div><div className="kpi-value">{retornos.length}</div></div>
        <div className="kpi"><div className="kpi-label">Leads ativos</div><div className="kpi-value">{base.filter((l) => !["VENDIDO", "PERDIDO"].includes(l.status)).length}</div></div>
        <div className="kpi"><div className="kpi-label">Vendidos</div><div className="kpi-value">{conta("VENDIDO")}</div></div>
      </div>

      {gestor && vendedores.length > 0 && (
        <div className="toolbar">
          <select className="input" value={vend} onChange={(e) => setVend(e.target.value)} aria-label="Vendedor" style={{ maxWidth: 260 }}>
            <option value="">Todos os vendedores</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      )}

      {oportunidades.length > 0 && (
        <section className="op-section">
          <div className="panel-head"><h2>🔥 Oportunidades agora</h2><span className="hint">ligue enquanto a moto está disponível</span></div>
          <ul className="op-list">
            {oportunidades.map((l) => (
              <li key={l.id} className="op-card">
                <div className="op-head">
                  <Link href={`/leads/${l.id}`} className="op-cliente"><strong>{l.cliente}</strong><span>quer {l.desejo}{l.anoMin ? ` · ${l.anoMin}+` : ""}{l.valorMax ? ` · até ${l.valorMax}` : ""}</span></Link>
                  {gestor && <span className="faint" style={{ fontSize: 12 }}>{l.vendedor}</span>}
                </div>
                {l.matches.slice(0, 3).map((m) => (
                  <div key={m.placa} className="op-match">
                    <MatchChip m={m} />
                    <Contato l={l} placa={m.placa} vendedor={gestor ? l.vendedor || nomeVendedor : nomeVendedor} compacto />
                  </div>
                ))}
                {l.matches.length > 3 && <Link href={`/leads/${l.id}`} className="link-more">+{l.matches.length - 3} motos compatíveis</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {retornos.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <div className="panel-head"><h2>Retornar hoje</h2></div>
          <ul className="simple-list panel">
            {retornos.map((l) => (
              <li key={l.id}><Link href={`/leads/${l.id}`} className="simple-row">
                <span className="badge warn">{l.proximoContato.slice(0, 5)}</span>
                <span className="simple-main">{l.cliente}<small>{l.desejo}</small></span>
                <span className="simple-side">{statusDe(l.status).label}</span>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <div className="panel-head"><h2>Leads</h2><Link href="/leads/novo" className="btn small desktop-only">+ Novo lead</Link></div>
        <div className="search-row">
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input className="input" placeholder="Cliente, telefone ou moto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar lead" />
          </div>
        </div>
        <div className="chips scroll" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" aria-pressed={status === "ativos"} onClick={() => setStatus("ativos")}>Ativos</button>
          <button type="button" className="chip" aria-pressed={status === "syonet"} onClick={() => setStatus("syonet")}>Sem Syonet · {base.filter((l) => !l.syonet && l.status !== "PERDIDO").length}</button>
          {STATUS.map((s) => <button key={s.id} type="button" className="chip" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>{s.label} · {conta(s.id)}</button>)}
          <button type="button" className="chip" aria-pressed={status === "todos"} onClick={() => setStatus("todos")}>Todos</button>
        </div>
        <ul className="lead-list">
          {lista.map((l) => {
            const st = statusDe(l.status);
            return (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="lead-card">
                  <div className="lead-top">
                    <strong>{l.cliente}</strong>
                    <span className={`badge ${st.tom}`}>{st.label}</span>
                  </div>
                  <div className="lead-desejo">{l.desejo}{l.aceitaEquivalente ? <span className="faint"> · aceita equivalente</span> : null}</div>
                  <div className="lead-meta">
                    {l.matches.length > 0 && <span className="badge ok">{l.matches.length} moto{l.matches.length > 1 ? "s" : ""} compatível{l.matches.length > 1 ? "is" : ""}</span>}
                    {l.retornoHoje && <span className="badge warn">retornar hoje</span>}
                    {!l.syonet && l.status !== "PERDIDO" && <span className="badge bad">sem Syonet</span>}
                    {l.ultimoContato && <span>último contato {l.ultimoContato.slice(0, 5)}</span>}
                    {gestor && <span>{l.vendedor}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li className="empty-state"><div className="empty-icon">☎</div><strong>Nenhum lead aqui</strong><span>Cadastre o cliente e a moto que ele quer — o app avisa quando chegar uma igual ou equivalente.</span>
              <Link href="/leads/novo" className="btn small" style={{ marginTop: 8 }}>Cadastrar lead</Link></li>
          )}
        </ul>
      </section>
    </>
  );
}
