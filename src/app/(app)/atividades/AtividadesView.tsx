"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { mudarStatusAction } from "./actions";

export type StatusAtv = "A FAZER" | "EM ANDAMENTO" | "FINALIZADO";
export type AtvVM = {
  id: string; descricao: string; status: StatusAtv; urgente: boolean; data: string; hora: string; atrasada: boolean;
  pessoas: string[]; placa: string; modelo: string; lead: string; cliente: string; observacao: string; periodicidade: string;
  origem: string; ref: string; resolvidaEm: string; criadoPor: string; podeExcluir: boolean;
};
type PessoaF = { id: string; nome: string; perfil: string };

const ROTULO: Record<StatusAtv, string> = { "A FAZER": "A fazer", "EM ANDAMENTO": "Em andamento", FINALIZADO: "Finalizado" };
const PERIODO: Record<string, string> = { "DIÁRIA": "diária", SEMANAL: "semanal", QUINZENAL: "quinzenal", MENSAL: "mensal" };

/** "23/11/2026, 10:00:00" → "2026-11-23" */
const isoDeBR = (s: string) => { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const somaDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function nomeDia(iso: string, hoje: string) {
  const sem = new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  const cap = sem.charAt(0).toUpperCase() + sem.slice(1);
  const rel = iso === hoje ? "Hoje · " : iso === somaDias(hoje, 1) ? "Amanhã · " : iso === somaDias(hoje, -1) ? "Ontem · " : "";
  return `${rel}${cap}, ${ddmm(iso)}`;
}
/** Ordem dentro de um grupo: abertas primeiro (urgente, depois hora); finalizadas por último. */
const ordem = (a: AtvVM, b: AtvVM) =>
  Number(a.status === "FINALIZADO") - Number(b.status === "FINALIZADO") ||
  Number(b.urgente) - Number(a.urgente) ||
  `${a.data || "9"}${a.hora || "99"}`.localeCompare(`${b.data || "9"}${b.hora || "99"}`) ||
  a.resolvidaEm.localeCompare(b.resolvidaEm);

function useAcoes() {
  const router = useRouter();
  const [pend, start] = useTransition();
  const [local, setLocal] = useState<Record<string, StatusAtv>>({});
  const [aviso, setAviso] = useState<{ tom: string; txt: string } | null>(null);
  const mudar = (id: string, status: StatusAtv) => {
    setLocal((l) => ({ ...l, [id]: status })); setAviso(null);
    start(async () => {
      const r = await mudarStatusAction(id, status);
      if (r.erro) { setAviso({ tom: "bad", txt: r.erro }); setLocal((l) => { const n = { ...l }; delete n[id]; return n; }); }
      else { if (r.msg) setAviso({ tom: "ok", txt: r.msg }); router.refresh(); }
    });
  };
  return { pend, local, mudar, aviso };
}

function Meta({ a, hoje, compacto = false }: { a: AtvVM; hoje: string; compacto?: boolean }) {
  return (
    <div className="atv-meta">
      {a.urgente && <span className="badge bad">urgente</span>}
      {a.atrasada && <span className="badge bad solido">atrasada</span>}
      {a.data && (compacto || a.data !== hoje || a.hora) && <span className="atv-quando">{compacto && a.data !== hoje ? ddmm(a.data) : ""}{compacto && a.data !== hoje && a.hora ? " · " : ""}{a.hora}</span>}
      {a.origem === "Inspeção 360" && <span className="badge">360</span>}
      {a.periodicidade && <span className="badge" title="Repete ao finalizar">↻ {PERIODO[a.periodicidade] ?? a.periodicidade.toLowerCase()}</span>}
      {a.placa && <Link href={a.ref ? `/preparacao/${encodeURIComponent(a.ref)}` : `/estoque/ver?placa=${encodeURIComponent(a.placa)}`} className="badge link">{a.placa}{a.modelo ? ` · ${a.modelo}` : ""}</Link>}
      {a.cliente && <Link href={`/leads/${a.lead}`} className="badge accent link">lead: {a.cliente}</Link>}
      {a.pessoas.length > 0 && <span className="atv-pessoas">{a.pessoas.map((p) => <span key={p} className="pessoa" title={p}>{p.split(" ")[0]}</span>)}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Lista: atrasadas no topo; um bloco por dia; dia todo concluído fica recolhido
// ---------------------------------------------------------------------------------------------
function Linha({ a, hoje, status, mudar, pend }: { a: AtvVM; hoje: string; status: StatusAtv; mudar: (id: string, s: StatusAtv) => void; pend: boolean }) {
  const feita = status === "FINALIZADO";
  return (
    <li className={`atv-linha-item ${feita ? "feita" : ""} ${a.urgente && !feita ? "urgente" : ""} ${a.atrasada && !feita ? "atrasada" : ""}`}>
      <button type="button" className="atv-check" aria-label={feita ? "Reabrir" : "Finalizar"} disabled={pend} onClick={() => mudar(a.id, feita ? "A FAZER" : "FINALIZADO")}>{feita ? "✓" : ""}</button>
      <div className="atv-corpo">
        <Link href={`/atividades/${encodeURIComponent(a.id)}`} className="atv-titulo">{a.descricao}</Link>
        <Meta a={a} hoje={hoje} />
        {a.observacao && !feita && <div className="atv-obs">{a.observacao}</div>}
      </div>
      {!feita && (
        <button type="button" className={`atv-status st-${status === "EM ANDAMENTO" ? "and" : "faz"}`} disabled={pend} title="Mudar status"
          onClick={() => mudar(a.id, status === "A FAZER" ? "EM ANDAMENTO" : "A FAZER")}>{ROTULO[status]}</button>
      )}
    </li>
  );
}

function Lista({ itens, hoje, acoes }: { itens: AtvVM[]; hoje: string; acoes: ReturnType<typeof useAcoes> }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const st = (a: AtvVM) => acoes.local[a.id] ?? a.status;
  const grupos = useMemo(() => {
    const atrasadas: AtvVM[] = [];
    const dias = new Map<string, AtvVM[]>();
    for (const a of itens) {
      if (a.atrasada && st(a) !== "FINALIZADO") { atrasadas.push(a); continue; }
      const dia = a.data || (a.status === "FINALIZADO" ? isoDeBR(a.resolvidaEm) : "") || "sem-data";
      dias.set(dia, [...(dias.get(dia) ?? []), a]);
    }
    const limite = somaDias(hoje, -21);
    const chaves = [...dias.keys()];
    const futuros = chaves.filter((d) => d !== "sem-data" && d >= hoje).sort();
    const passados = chaves.filter((d) => d !== "sem-data" && d < hoje && d >= limite).sort().reverse();
    return { atrasadas, futuros, passados, semData: dias.get("sem-data") ?? [], dias };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, hoje, acoes.local]);

  const bloco = (chave: string, titulo: string, lista: AtvVM[], extra = "") => {
    const ord = [...lista].sort((x, y) => ordem({ ...x, status: st(x) }, { ...y, status: st(y) }));
    const tudoFeito = ord.length > 0 && ord.every((a) => st(a) === "FINALIZADO");
    const aberto = abertos.has(chave) || !tudoFeito;
    const feitas = ord.filter((a) => st(a) === "FINALIZADO").length;
    return (
      <section key={chave} className={`atv-dia ${extra} ${tudoFeito ? "concluido" : ""}`}>
        <button type="button" className="atv-dia-head" onClick={() => tudoFeito && setAbertos((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; })} aria-expanded={aberto}>
          <strong>{titulo}</strong>
          <span className="atv-dia-cont">{tudoFeito ? `${feitas} atividade${feitas > 1 ? "s" : ""} concluída${feitas > 1 ? "s" : ""} ${aberto ? "▴" : "▾"}` : `${ord.length - feitas} aberta${ord.length - feitas !== 1 ? "s" : ""}${feitas ? ` · ${feitas} concluída${feitas > 1 ? "s" : ""}` : ""}`}</span>
        </button>
        {aberto && <ul className="atv-dia-lista">{ord.map((a) => <Linha key={a.id} a={a} hoje={hoje} status={st(a)} mudar={acoes.mudar} pend={acoes.pend} />)}</ul>}
      </section>
    );
  };

  if (!itens.length) return <div className="empty-state"><div className="empty-icon">✓</div><strong>Nenhuma atividade</strong><span>Use “Nova atividade” para lançar a primeira.</span></div>;
  return (
    <div className="atv-dias">
      {grupos.atrasadas.length > 0 && bloco("atrasadas", `Atrasadas`, grupos.atrasadas, "atrasadas")}
      {grupos.futuros.map((d) => bloco(d, nomeDia(d, hoje), grupos.dias.get(d)!, d === hoje ? "hoje" : ""))}
      {grupos.semData.length > 0 && bloco("sem-data", "Sem data", grupos.semData)}
      {grupos.passados.length > 0 && <div className="atv-sep">Dias anteriores</div>}
      {grupos.passados.map((d) => bloco(d, nomeDia(d, hoje), grupos.dias.get(d)!))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Kanban: Atrasadas · A fazer · Em andamento · Finalizado (últimos 7 dias). Arraste entre colunas.
// ---------------------------------------------------------------------------------------------
function Cartao({ a, hoje, status, acoes }: { a: AtvVM; hoje: string; status: StatusAtv; acoes: ReturnType<typeof useAcoes> }) {
  const { mudar, pend } = acoes;
  return (
    <article className={`kb-card ${a.urgente && status !== "FINALIZADO" ? "urgente" : ""} ${status === "FINALIZADO" ? "feita" : ""}`} draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}>
      <Link href={`/atividades/${encodeURIComponent(a.id)}?volta=${encodeURIComponent("/atividades?v=kanban")}`} className="kb-titulo">{a.descricao}</Link>
      <Meta a={a} hoje={hoje} compacto />
      {a.observacao && status !== "FINALIZADO" && <div className="atv-obs">{a.observacao}</div>}
      <div className="kb-acoes">
        {a.atrasada && status !== "FINALIZADO" && <span className="kb-st">{ROTULO[status]}</span>}
        {status === "A FAZER" && <button type="button" className="btn small ghost" disabled={pend} onClick={() => mudar(a.id, "EM ANDAMENTO")}>Iniciar ›</button>}
        {status === "EM ANDAMENTO" && <button type="button" className="btn small ghost" disabled={pend} onClick={() => mudar(a.id, "A FAZER")}>‹ A fazer</button>}
        {status !== "FINALIZADO" && <button type="button" className="btn small" disabled={pend} onClick={() => mudar(a.id, "FINALIZADO")}>Finalizar ✓</button>}
        {status === "FINALIZADO" && <button type="button" className="btn small ghost" disabled={pend} onClick={() => mudar(a.id, "A FAZER")}>Reabrir</button>}
      </div>
    </article>
  );
}

function Kanban({ itens, hoje, acoes }: { itens: AtvVM[]; hoje: string; acoes: ReturnType<typeof useAcoes> }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const st = (a: AtvVM) => acoes.local[a.id] ?? a.status;
  const seteDias = somaDias(hoje, -7);
  const ordK = (x: AtvVM, y: AtvVM) => Number(y.urgente) - Number(x.urgente) || `${x.data || "9"}${x.hora || "99"}`.localeCompare(`${y.data || "9"}${y.hora || "99"}`);
  const fin = itens.filter((a) => st(a) === "FINALIZADO");
  const finRecentes = fin.filter((a) => (isoDeBR(a.resolvidaEm) || hoje) >= seteDias).sort((x, y) => y.resolvidaEm.localeCompare(x.resolvidaEm));
  const colunas: { id: string; titulo: string; lista: AtvVM[]; alvo: StatusAtv | null; tom: string; nota?: string }[] = [
    { id: "atrasadas", titulo: "Atrasadas", lista: itens.filter((a) => a.atrasada && st(a) !== "FINALIZADO").sort(ordK), alvo: null, tom: "bad" },
    { id: "fazer", titulo: "A fazer", lista: itens.filter((a) => !a.atrasada && st(a) === "A FAZER").sort(ordK), alvo: "A FAZER", tom: "" },
    { id: "andamento", titulo: "Em andamento", lista: itens.filter((a) => !a.atrasada && st(a) === "EM ANDAMENTO").sort(ordK), alvo: "EM ANDAMENTO", tom: "warn" },
    { id: "fim", titulo: "Finalizado", lista: finRecentes, alvo: "FINALIZADO", tom: "ok", nota: fin.length > finRecentes.length ? `últimos 7 dias · ${fin.length - finRecentes.length} mais antigas na Lista` : "últimos 7 dias" },
  ];
  return (
    <div className="kanban">
      {colunas.map((c) => (
        <section key={c.id} className={`kb-col kb-${c.id} ${sobre === c.id ? "sobre" : ""}`}
          onDragOver={(e) => { if (c.alvo) { e.preventDefault(); setSobre(c.id); } }} onDragLeave={() => setSobre(null)}
          onDrop={(e) => { e.preventDefault(); setSobre(null); const id = e.dataTransfer.getData("text/plain"); const a = itens.find((x) => x.id === id); if (a && c.alvo && st(a) !== c.alvo) acoes.mudar(id, c.alvo); }}>
          <header className="kb-head"><span className={`kb-dot ${c.tom}`} /><strong>{c.titulo}</strong><span className="count-pill">{c.lista.length}</span></header>
          {c.nota && <div className="kb-nota">{c.nota}</div>}
          <div className="kb-cards">
            {c.lista.map((a) => <Cartao key={a.id} a={a} hoje={hoje} status={st(a)} acoes={acoes} />)}
            {c.lista.length === 0 && <div className="kb-vazio">{c.id === "atrasadas" ? "Nada atrasado 👏" : "—"}</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AtividadesView({ atividades, visao, filtro, pessoas, hoje }: { atividades: AtvVM[]; visao: "lista" | "kanban"; filtro: string; pessoas: PessoaF[]; hoje: string }) {
  const router = useRouter();
  const acoes = useAcoes();
  const q = (v: string, p: string) => { const s = new URLSearchParams(); if (v === "kanban") s.set("v", v); if (p) s.set("p", p); const t = s.toString(); return `/atividades${t ? `?${t}` : ""}`; };
  return (
    <>
      <div className="atv-barra">
        <div className="seg" role="tablist" aria-label="Visualização">
          <Link href={q("lista", filtro)} className={visao === "lista" ? "on" : ""} role="tab" aria-selected={visao === "lista"}>Lista</Link>
          <Link href={q("kanban", filtro)} className={visao === "kanban" ? "on" : ""} role="tab" aria-selected={visao === "kanban"}>Kanban</Link>
        </div>
        {pessoas.length > 0 && (
          <select className="input atv-filtro" value={filtro} onChange={(e) => router.push(q(visao, e.target.value))} aria-label="Ver atividades de">
            <option value="">Toda a equipe</option>
            <option value="gestao">Da gestão (sem pessoa marcada)</option>
            <optgroup label="Vendedores">{pessoas.filter((p) => p.perfil === "vendedor").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
            <optgroup label="Preparadores">{pessoas.filter((p) => p.perfil === "preparador").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
            <optgroup label="Gestores">{pessoas.filter((p) => p.perfil === "gestor").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
          </select>
        )}
      </div>
      {acoes.aviso && <div className={`alert ${acoes.aviso.tom}`} style={{ marginBottom: 12 }}>{acoes.aviso.txt}</div>}
      {visao === "kanban" ? <Kanban itens={atividades} hoje={hoje} acoes={acoes} /> : <Lista itens={atividades} hoje={hoje} acoes={acoes} />}
    </>
  );
}
