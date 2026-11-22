"use client";
import Link from "next/link";
import { useState } from "react";

export type CardVM = { id: string; modelo: string; placa: string; loja: string; dias: number | null; tags: { txt: string; tom: string }[] };
export type LaneVM = { id: string; label: string; curto: string; total: number; cards: CardVM[]; mais?: number };

export function Board({ lanes }: { lanes: LaneVM[] }) {
  const inicial = lanes.find((l) => l.total > 0 && l.id !== "FINALIZADA")?.id ?? lanes[0]?.id;
  const [ativa, setAtiva] = useState(inicial);
  return (
    <>
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
    </>
  );
}
