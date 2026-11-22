"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { nova, reabrir, resolver, type AtvState } from "./actions";

export type AtvVM = {
  id: string; descricao: string; placa: string; modelo: string; item: string; origem: string; criadaEm: string; resolvidaEm: string; resolucao: string; aberta: boolean; ref: string;
  responsavel?: string; lead?: string; cliente?: string; prazo?: string;
};

/** Prazo "dd/mm/aaaa" vencido ou para hoje. */
function tomPrazo(prazo?: string) {
  const m = prazo?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const d = `${m[3]}-${m[2]}-${m[1]}`;
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return d < hoje ? "bad" : d === hoje ? "warn" : "";
}

function Tarefa({ a, mostrarDono = false }: { a: AtvVM; mostrarDono?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nota, setNota] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const rodar = (fn: () => Promise<AtvState>) => start(async () => {
    const r = await fn();
    if (r.erro) setErro(r.erro); else { setAbrindo(false); router.refresh(); }
  });
  return (
    <li className={`task ${a.aberta ? "" : "done"} ${pending ? "busy" : ""}`}>
      <div className="task-main">
        <span className="task-check" aria-hidden>{a.aberta ? "" : "✓"}</span>
        <div className="task-body">
          <div className="task-desc">{a.descricao}</div>
          <div className="task-meta">
            {a.origem === "Inspeção 360" ? <span className="badge">360</span> : a.origem === "Vendedor" ? null : <span className="badge">avulsa</span>}
            {a.prazo && a.aberta && <span className={`badge ${tomPrazo(a.prazo)}`}>até {a.prazo.slice(0, 5)}</span>}
            {a.cliente && <Link href={`/leads/${a.lead}`} className="badge accent">lead: {a.cliente}</Link>}
            {mostrarDono && a.responsavel && <span className="badge">{a.responsavel}</span>}
            <span>{a.criadaEm.split(",")[0]}</span>
            {!a.aberta && <span>· resolvida {a.resolvidaEm.split(",")[0]}{a.resolucao ? ` — ${a.resolucao}` : ""}</span>}
          </div>
        </div>
        {a.aberta ? (
          <button type="button" className="btn small" onClick={() => setAbrindo((x) => !x)} disabled={pending}>Resolver</button>
        ) : (
          <button type="button" className="link-btn" onClick={() => rodar(() => reabrir(a.id))} disabled={pending}>Reabrir</button>
        )}
      </div>
      {abrindo && (
        <div className="task-resolve">
          <input className="input" placeholder="Como foi resolvido? (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
          <button type="button" className="btn small" onClick={() => rodar(() => resolver(a.id, nota))} disabled={pending}>{pending ? "Salvando…" : "Confirmar"}</button>
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
    </li>
  );
}

export function AtividadesView({ atividades, motos, rapido = true, mostrarDono = false, vazio = "As pendências da inspeção 360 aparecem aqui." }: {
  atividades: AtvVM[]; motos: Record<string, string>; rapido?: boolean; mostrarDono?: boolean; vazio?: string;
}) {
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [state, action, pending] = useActionState<AtvState, FormData>(nova, {});
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { formRef.current?.reset(); router.refresh(); } }, [state.ok, router]);

  const abertas = atividades.filter((a) => a.aberta);
  const resolvidas = atividades.filter((a) => !a.aberta).reverse();
  const grupos = new Map<string, AtvVM[]>();
  for (const a of abertas) {
    const k = a.placa || a.modelo || (a.lead ? `lead:${a.lead}` : "Gerais");
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }

  return (
    <>
      {rapido && <form ref={formRef} action={action} className="quick-add">
        <input name="descricao" className="input" placeholder="Nova atividade…" aria-label="Nova atividade" />
        <input name="placa" className="input mono quick-placa" placeholder="Placa" aria-label="Placa (opcional)" style={{ textTransform: "uppercase" }} />
        <button className="btn" disabled={pending}>{pending ? "…" : "Adicionar"}</button>
      </form>}
      {state.erro && <div className="alert bad">{state.erro}</div>}

      {abertas.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✓</div><strong>Nenhuma atividade aberta</strong><span>{vazio}</span></div>
      ) : (
        [...grupos.entries()].map(([k, lista]) => {
          const ref = lista.find((a) => a.ref)?.ref;
          return (
            <section key={k} className="task-group">
              <div className="task-group-head">
                {lista[0].placa ? <span className="plate">{lista[0].placa}</span> : null}
                <strong>{lista[0].modelo || motos[lista[0].placa] || (lista[0].placa ? "" : lista[0].lead ? `Lead · ${lista[0].cliente}` : lista[0].origem === "Vendedor" ? "Rotina" : "Gerais")}</strong>
                <span className="badge warn">{lista.length}</span>
                {ref ? <Link href={`/preparacao/${encodeURIComponent(ref)}`} className="link-more">ver moto →</Link>
                  : lista[0].placa ? <Link href={`/estoque/ver?placa=${encodeURIComponent(lista[0].placa)}`} className="link-more">ver moto →</Link>
                  : lista[0].lead ? <Link href={`/leads/${lista[0].lead}`} className="link-more">ver lead →</Link> : null}
              </div>
              <ul className="task-list">{lista.map((a) => <Tarefa key={a.id} a={a} mostrarDono={mostrarDono} />)}</ul>
            </section>
          );
        })
      )}

      {resolvidas.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button type="button" className="link-btn" onClick={() => setVerResolvidas((v) => !v)}>
            {verResolvidas ? "Ocultar" : "Ver"} resolvidas ({resolvidas.length})
          </button>
          {verResolvidas && <ul className="task-list" style={{ marginTop: 10 }}>{resolvidas.slice(0, 50).map((a) => <Tarefa key={a.id} a={a} mostrarDono={mostrarDono} />)}</ul>}
        </div>
      )}
    </>
  );
}
