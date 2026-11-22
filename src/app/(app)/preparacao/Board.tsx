"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type CardVM = { id: string; modelo: string; placa: string; loja: string; dias: number | null; tags: { txt: string; tom: string }[] };
export type LaneVM = { id: string; label: string; curto: string; total: number; cards: CardVM[]; mais?: number };

export type AchadoVM = { id: string; modelo: string; placa: string; loja: string; etapa: number; etapaLabel: string; dias: number | null; finalizada: boolean; quando: string; fabricante: string };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const so = (s: string) => norm(s).replace(/[^A-Z0-9]/g, "");

export function Board({ lanes, todos = [], etapas = 4 }: { lanes: LaneVM[]; todos?: AchadoVM[]; etapas?: number }) {
  const inicial = lanes.find((l) => l.total > 0 && l.id !== "FINALIZADA")?.id ?? lanes[0]?.id;
  const [ativa, setAtiva] = useState(inicial);
  const [q, setQ] = useState("");
  const achados = useMemo(() => {
    const t = norm(q.trim());
    if (t.length < 2) return null;
    const compacto = so(t);
    const palavras = t.split(/\s+/).filter(Boolean);
    return todos.filter((a) => {
      const alvo = norm(`${a.modelo} ${a.fabricante} ${a.loja}`);
      return (compacto.length >= 3 && so(a.placa).includes(compacto)) || palavras.every((w) => alvo.includes(w) || so(a.placa).includes(so(w)));
    }).slice(0, 30);
  }, [q, todos]);

  return (
    <>
      <div className="prep-busca">
        <input className="input" type="search" placeholder="Pesquisar placa ou moto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar placa ou moto" />
        {q && <button type="button" className="btn small ghost" onClick={() => setQ("")}>Limpar</button>}
      </div>
      {achados && (
        <div className="prep-achados" role="region" aria-label="Resultado da pesquisa">
          {achados.length === 0 && <div className="faint" style={{ fontSize: 14 }}>Nenhuma moto encontrada na preparação para “{q}”.</div>}
          {achados.map((a) => (
            <Link key={a.id} href={`/preparacao/${encodeURIComponent(a.id)}`} className="prep-achado">
              <span className="plate">{a.placa || "s/ placa"}</span>
              <span>
                <strong>{a.modelo || "Modelo não informado"}</strong>
                <small>
                  {a.finalizada ? `Finalizada${a.quando ? ` em ${a.quando.slice(0, 10)}` : ""}` : `Etapa ${a.etapa + 1} de ${etapas} · ${a.etapaLabel}${a.dias != null ? ` · ${a.dias} dia(s) na etapa` : ""}`}
                  {a.loja ? ` · ${a.loja}` : ""}
                </small>
              </span>
              <span className="etapa-passos" aria-label={`Etapa ${a.etapa + 1} de ${etapas}`}>
                {Array.from({ length: etapas }, (_, n) => <i key={n} className={a.finalizada || n < a.etapa ? "feito" : n === a.etapa ? "on" : ""} />)}
                <span aria-hidden style={{ marginLeft: 6, color: "var(--muted)" }}>›</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {!achados && <>
      <div className="lane-tabs mobile-only" role="tablist">
        {lanes.map((l, i) => (
          <button key={l.id} type="button" role="tab" aria-selected={ativa === l.id} className="lane-tab" onClick={() => setAtiva(l.id)}>
            <span className="lane-tab-n">{l.total}</span>
            <span className="lane-tab-txt">{l.curto}</span>
          </button>
        ))}
      </div>
      <div className="board">
        {lanes.map((l, i) => (
          <section className={`lane ${ativa === l.id ? "is-active" : ""}`} key={l.id} aria-label={l.label}>
            <div className="lane-head">
              <h3><span className="lane-step">{i + 1}</span>{l.label}</h3>
              <span className="lane-count">{l.total}</span>
            </div>
            <div className="lane-body">
              {l.cards.map((c) => (
                <Link key={c.id} href={`/preparacao/${encodeURIComponent(c.id)}`} className="card">
                  <div className="card-top">
                    <div className="card-title">{c.modelo || "Modelo não informado"}</div>
                    {c.dias != null && <span className="card-days">{c.dias}d</span>}
                  </div>
                  <div className="card-meta">
                    {c.placa && <span className="plate">{c.placa}</span>}
                    {c.loja && <span>{c.loja}</span>}
                  </div>
                  {c.tags.length > 0 && <div className="card-tags">{c.tags.map((t) => <span key={t.txt} className={`badge ${t.tom}`}>{t.txt}</span>)}</div>}
                </Link>
              ))}
              {l.total === 0 && <div className="empty">Nenhuma moto</div>}
              {l.mais ? <Link href="?finalizadas=1" className="link-btn" style={{ textAlign: "center" }}>Ver todas ({l.total})</Link> : null}
            </div>
          </section>
        ))}
      </div>
      </>}
    </>
  );
}
