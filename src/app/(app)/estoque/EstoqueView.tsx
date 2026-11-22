"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChecklistResumo } from "@/components/ChecklistResumo";
import type { ResumoChecklist } from "@/lib/checklist";
import { Icon } from "@/components/Icon";
import type { Moto } from "@/lib/estoque";
import { fmt } from "@/lib/parse";

const FAIXAS = [
  { id: "0-30", label: "≤ 30 dias", min: 0, max: 30 },
  { id: "31-60", label: "31–60", min: 31, max: 60 },
  { id: "61-90", label: "61–90", min: 61, max: 90 },
  { id: "90+", label: "> 90 dias", min: 91, max: Infinity },
];

const tomDias = (d: number | null) => (d == null ? "" : d > 90 ? "bad" : d > 60 ? "warn" : "ok");
type Ordem = "dias" | "preco" | "modelo" | "margem";

export function EstoqueView({ motos, verCusto, editar, emPreparacao, buscaInicial = "", checklists = {}, capas = {} }: {
  motos: Moto[]; verCusto: boolean; editar: boolean; emPreparacao: Record<string, string>; buscaInicial?: string;
  checklists?: Record<string, ResumoChecklist>; capas?: Record<string, string>;
}) {
  const router = useRouter();
  const [ckAberto, setCkAberto] = useState<string | null>(null);
  const fichaHref = (m: Moto) => `/estoque/ver?${new URLSearchParams({ aba: m.aba, linha: String(m.linha) })}`;
  const ponto = (placa: string) => {
    const r = checklists[placa];
    if (!r) return null;
    return <span className={`ck-ponto ${r.geral}`} title={r.geral === "ok" ? "Preparação: tudo OK" : r.geral === "pendente" ? `Preparação: ${r.pendentes} pendência(s)` : "Checklist incompleto"} />;
  };
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (!ckAberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setCkAberto(null); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [ckAberto]);
  const motoCk = motos.find((x) => x.id === ckAberto);
  const gaveta = montado && motoCk ? createPortal(
    <div className="ck-gaveta-fundo desktop-only" onClick={() => setCkAberto(null)}>
      <aside className="ck-gaveta" role="dialog" aria-label={`Preparação de ${motoCk.modelo}`} onClick={(e) => e.stopPropagation()}>
        <div className="ck-gaveta-head">
          <div><div className="eyebrow">Preparação</div><strong>{motoCk.modelo}</strong> <span className="plate">{motoCk.placa}</span></div>
          <button type="button" className="lightbox-fechar" style={{ position: "static" }} onClick={() => setCkAberto(null)} aria-label="Fechar">×</button>
        </div>
        <ChecklistResumo r={checklists[motoCk.placa]} />
        <Link href={fichaHref(motoCk)} className="btn" style={{ marginTop: 14 }}>Abrir ficha da moto</Link>
      </aside>
    </div>,
    document.body,
  ) : null;
  const BotaoCk = ({ m }: { m: Moto }) => (
    <button type="button" className={`ck-btn ${ckAberto === m.id ? "on" : ""} ${checklists[m.placa]?.geral ?? ""}`} aria-expanded={ckAberto === m.id}
      title="Ver preparação desta moto" aria-label={`Ver preparação de ${m.modelo}`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setCkAberto(ckAberto === m.id ? null : m.id); }}>
      <Icon name="lista" size={18} />
    </button>
  );
  const [busca, setBusca] = useState(buscaInicial);
  const [cidade, setCidade] = useState("");
  const [marca, setMarca] = useState("");
  const [status, setStatus] = useState("");
  const [faixa, setFaixa] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("dias");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const cidades = useMemo(() => [...new Set(motos.map((m) => m.cidade))].sort(), [motos]);
  const statuses = useMemo(() => [...new Set(motos.map((m) => m.status))].sort(), [motos]);
  const nFiltros = [cidade, marca, status, faixa].filter(Boolean).length;

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const f = FAIXAS.find((x) => x.id === faixa);
    const out = motos.filter(
      (m) =>
        (!q || m.placa.includes(q) || m.modelo.includes(q) || m.cor.includes(q)) &&
        (!cidade || m.cidade === cidade) && (!marca || m.marca === marca) && (!status || m.status === status) &&
        (!f || (m.dias != null && m.dias >= f.min && m.dias <= f.max)),
    );
    const margem = (m: Moto) => (m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : -Infinity);
    out.sort((a, b) =>
      ordem === "dias" ? (b.dias ?? -1) - (a.dias ?? -1)
      : ordem === "preco" ? (b.realinhamento ?? 0) - (a.realinhamento ?? 0)
      : ordem === "margem" ? margem(b) - margem(a)
      : a.modelo.localeCompare(b.modelo),
    );
    return out;
  }, [motos, busca, cidade, marca, status, faixa, ordem]);

  const idadeMedia = lista.length ? Math.round(lista.reduce((s, m) => s + (m.dias ?? 0), 0) / lista.length) : 0;
  const acima90 = lista.filter((m) => (m.dias ?? 0) > 90).length;
  const naoAnunciadas = lista.filter((m) => !m.anunciada).length;
  const custoTotal = lista.reduce((s, m) => s + (m.custo ?? 0), 0);
  const precoTotal = lista.reduce((s, m) => s + (m.realinhamento ?? 0), 0);
  const margemTotal = lista.reduce((s, m) => s + (m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : 0), 0);

  const chip = (ativo: boolean, onClick: () => void, label: string) => (
    <button type="button" className="chip" aria-pressed={ativo} onClick={onClick} key={label}>{label}</button>
  );
  const limpar = () => { setCidade(""); setMarca(""); setStatus(""); setFaixa(""); };

  return (
    <>
      <div className="grid grid-kpi kpi-strip">
        <div className="kpi accent"><div className="kpi-label">Motos</div><div className="kpi-value">{lista.length}</div><div className="kpi-sub">{naoAnunciadas} sem anúncio</div></div>
        <div className="kpi"><div className="kpi-label">Idade média</div><div className="kpi-value">{idadeMedia}<small> dias</small></div></div>
        <div className={`kpi ${acima90 ? "bad" : ""}`}><div className="kpi-label">+ de 90 dias</div><div className="kpi-value">{acima90}</div><div className="kpi-sub">{fmt.pct(lista.length ? acima90 / lista.length : null)} do estoque</div></div>
        {verCusto ? (
          <>
            <div className="kpi"><div className="kpi-label">Custo em estoque</div><div className="kpi-value money">{fmt.brl(custoTotal)}</div></div>
            <div className="kpi"><div className="kpi-label">Margem potencial</div><div className="kpi-value money">{fmt.brl(margemTotal)}</div></div>
          </>
        ) : (
          <div className="kpi"><div className="kpi-label">Valor anunciado</div><div className="kpi-value money">{fmt.brl(precoTotal)}</div></div>
        )}
      </div>

      <div className="search-row">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input className="input" placeholder="Placa, modelo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
          {busca && <button type="button" className="search-clear" onClick={() => setBusca("")} aria-label="Limpar busca">×</button>}
        </div>
        <button type="button" className={`btn ghost filter-btn ${nFiltros ? "on" : ""}`} onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}>
          <Icon name="filtro" size={16} /> <span>Filtros{nFiltros ? ` · ${nFiltros}` : ""}</span>
        </button>
        <select className="input sort-select" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
          <option value="dias">Mais parados</option>
          <option value="preco">Maior preço</option>
          {verCusto && <option value="margem">Maior margem</option>}
          <option value="modelo">Modelo A–Z</option>
        </select>
      </div>

      <div className={`filter-panel ${filtrosAbertos ? "open" : ""}`}>
        <div className="filter-group"><span className="filter-label">Cidade</span><div className="chips">{cidades.map((c) => chip(cidade === c, () => setCidade(cidade === c ? "" : c), c))}</div></div>
        <div className="filter-group"><span className="filter-label">Marca</span><div className="chips">
          {chip(marca === "HARLEY", () => setMarca(marca === "HARLEY" ? "" : "HARLEY"), "Freedom / Harley")}
          {chip(marca === "TRIUMPH", () => setMarca(marca === "TRIUMPH" ? "" : "TRIUMPH"), "Triumph")}
        </div></div>
        <div className="filter-group"><span className="filter-label">Tempo parado</span><div className="chips">{FAIXAS.map((f) => chip(faixa === f.id, () => setFaixa(faixa === f.id ? "" : f.id), f.label))}</div></div>
        <div className="filter-group"><span className="filter-label">Status</span><div className="chips">{statuses.map((s) => chip(status === s, () => setStatus(status === s ? "" : s), s.toLowerCase()))}</div></div>
        {nFiltros > 0 && <button type="button" className="link-btn" onClick={limpar}>Limpar filtros</button>}
      </div>

      {/* celular */}
      <ul className="moto-list mobile-only">
        {lista.map((m) => {
          const prep = emPreparacao[m.placa];
          const conteudo = (
            <>
              {capas[m.placa]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={capas[m.placa]} alt="" className="moto-thumb" loading="lazy" />
                : <div className={`moto-days ${tomDias(m.dias)}`}><b>{m.dias ?? "—"}</b><small>dias</small></div>}
              <div className="moto-info">
                <div className="moto-name">{ponto(m.placa)}{m.modelo}</div>
                <div className="moto-meta">
                  <span className="plate">{m.placa || "—"}</span>
                  <span>{m.ano}</span>
                  {m.km != null && <span>{fmt.int(m.km)} km</span>}
                  <span>{m.cidade === "Curitiba" ? "CTBA" : m.cidade === "Londrina" ? "LDA" : m.cidade}</span>
                  {capas[m.placa] && <span className={`badge ${tomDias(m.dias)}`}>{m.dias ?? "—"}d</span>}
                </div>
                <div className="moto-tags">
                  {!m.anunciada && <span className="badge warn">sem anúncio</span>}
                  {prep && <span className="badge accent">em preparação</span>}
                  {verCusto && m.realinhamento != null && m.custo != null && <span className={`badge ${m.realinhamento - m.custo < 0 ? "bad" : ""}`}>margem {fmt.brl(m.realinhamento - m.custo)}</span>}
                </div>
              </div>
              <div className="moto-price">{m.realinhamento != null ? fmt.brl(m.realinhamento) : <span className="faint">sem preço</span>}</div>
            </>
          );
          return (
            <li key={m.id}>
              <div className="moto-card-wrap">
                <Link href={fichaHref(m)} className="moto-card">{conteudo}</Link>
                <BotaoCk m={m} />
              </div>
              {ckAberto === m.id && <div className="ck-pop"><ChecklistResumo r={checklists[m.placa]} compacto /></div>}
            </li>
          );
        })}
        {lista.length === 0 && <li className="empty">Nenhuma moto com esses filtros.</li>}
      </ul>

      {gaveta}
      {/* computador */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              <th>Placa</th><th>Modelo</th><th>Ano</th><th className="r">Km</th><th className="col-opc">Cor</th><th>Loja</th>
              <th className="col-opc">Entrada</th><th className="r">Dias</th><th className="r">Preço</th><th className="r col-opc">FIPE</th>
              {verCusto && <><th className="r">Custo</th><th className="r">Margem</th></>}
              <th>Status</th><th className="c" title="Preparação">Prep.</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const margem = m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : null;
              const prep = emPreparacao[m.placa];
              return (
                <Fragment key={m.id}>
                <tr className="row-link" onClick={() => router.push(fichaHref(m))}>
                  <td><span className="plate">{m.placa || "—"}</span></td>
                  <td style={{ minWidth: 180 }}>
                    {ponto(m.placa)}<span className="strong">{m.modelo}</span>{prep && <> <span className="badge accent">⚙ {prep.toLowerCase()}</span></>}
                    {m.observacao && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{m.observacao}</div>}
                  </td>
                  <td className="num">{m.ano}</td>
                  <td className="r">{fmt.int(m.km)}</td>
                  <td className="muted col-opc">{m.cor}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{m.marca === "TRIUMPH" ? "Triumph" : "Freedom"} · {m.cidade}</td>
                  <td className="num muted col-opc">{fmt.date(m.dataEntrada ? new Date(m.dataEntrada) : null)}</td>
                  <td className="r"><span className={`badge ${tomDias(m.dias)}`}>{m.dias ?? "—"}</span></td>
                  <td className="r strong">{fmt.brl(m.realinhamento)}</td>
                  <td className="r muted col-opc">{fmt.brl(m.fipe)}</td>
                  {verCusto && (
                    <>
                      <td className="r muted">{fmt.brl(m.custo)}</td>
                      <td className="r" style={{ color: margem == null ? undefined : margem < 0 ? "var(--bad)" : "var(--ok)" }}>
                        {fmt.brl(margem)}
                        {margem != null && m.realinhamento ? <div className="faint" style={{ fontSize: 11 }}>{fmt.pct(margem / m.realinhamento)}</div> : null}
                      </td>
                    </>
                  )}
                  <td><span className={`badge ${m.anunciada ? "ok" : "warn"}`}>{m.status.toLowerCase()}</span></td>
                  <td className="c"><BotaoCk m={m} /></td>
                </tr>
                </Fragment>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={14} className="empty">Nenhuma moto com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
