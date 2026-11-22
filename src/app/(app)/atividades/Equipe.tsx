"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cobreiAction, syonetAction } from "../leads/actions";

export type PendenciaVM = { id: string; cliente: string; desejo: string; criadoEm: string; status: string };
export type MonitorVM = { vendedorId: string; nome: string; pendencias: number; prioridade: "alta" | "media" | "baixa"; voltou: boolean; cobradoEm: number | null };

/** Vendedor: leads sem Syonet, resolvidos ali mesmo digitando o número. */
export function PendenciasSyonet({ itens }: { itens: PendenciaVM[] }) {
  const router = useRouter();
  if (!itens.length) return <div className="empty-state"><div className="empty-icon">✓</div><strong>Nenhuma pendência</strong><span>Todos os seus leads estão no Syonet.</span></div>;
  return (
    <ul className="task-list">
      {itens.map((p) => <PendenciaItem key={p.id} p={p} onOk={() => router.refresh()} />)}
    </ul>
  );
}

function PendenciaItem({ p, onOk }: { p: PendenciaVM; onOk: () => void }) {
  const [valor, setValor] = useState("");
  const [pending, start] = useTransition();
  const [erro, setErro] = useState("");
  return (
    <li className={`task ${pending ? "busy" : ""}`}>
      <div className="task-main">
        <span className="task-check" aria-hidden />
        <div className="task-body">
          <div className="task-desc">Cadastrar no Syonet: <Link href={`/leads/${p.id}`} className="link-more">{p.cliente}</Link></div>
          <div className="task-meta"><span className="badge bad">sem Syonet</span><span>{p.desejo}</span><span>{p.criadoEm.split(",")[0]}</span></div>
        </div>
      </div>
      <form className="task-resolve" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await syonetAction(p.id, valor); if (r.erro) setErro(r.erro); else onOk(); }); }}>
        <input className="input mono" placeholder="Nº do lead no Syonet" value={valor} onChange={(e) => setValor(e.target.value)} aria-label={`Número do Syonet de ${p.cliente}`} />
        <button className="btn small" disabled={pending || !valor.trim()}>{pending ? "…" : "Salvar"}</button>
      </form>
      {erro && <div className="alert bad">{erro}</div>}
    </li>
  );
}

/** Gestor: uma linha por vendedor, prioridade pela quantidade; "Cobrei" esconde por 24 h. */
export function CobrarEquipe({ itens }: { itens: MonitorVM[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qual, setQual] = useState("");
  if (!itens.length) return <div className="faint" style={{ fontSize: 14, marginBottom: 8 }}>Ninguém com pendência de Syonet agora. 👏</div>;
  return (
    <ul className="task-list">
      {itens.map((m) => (
        <li key={m.vendedorId} className={`task cobrar ${m.prioridade} ${pending && qual === m.vendedorId ? "busy" : ""}`}>
          <div className="task-main">
            <span className={`cobrar-n ${m.prioridade}`}>{m.pendencias}</span>
            <div className="task-body">
              <div className="task-desc">{m.nome} tem {m.pendencias} lead{m.pendencias > 1 ? "s" : ""} sem Syonet</div>
              <div className="task-meta">
                <span className={`badge ${m.prioridade === "alta" ? "bad" : m.prioridade === "media" ? "warn" : ""}`}>prioridade {m.prioridade === "media" ? "média" : m.prioridade}</span>
                {m.voltou && <span className="badge accent">voltou: segue pendente após a cobrança</span>}
                <Link href={`/leads?f=syonet&v=${encodeURIComponent(m.vendedorId)}`} className="link-more">ver leads →</Link>
              </div>
            </div>
            <button type="button" className="btn small" disabled={pending}
              onClick={() => { setQual(m.vendedorId); start(async () => { await cobreiAction(m.vendedorId); router.refresh(); }); }}>Cobrei</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
