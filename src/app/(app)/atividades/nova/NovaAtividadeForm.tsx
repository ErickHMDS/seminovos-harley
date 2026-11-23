"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useFormAction } from "@/components/useFormAction";
import { excluirAction, salvarAtividade, type AtvState } from "../actions";

type MotoOp = { placa: string; modelo: string };
type LeadOp = { id: string; cliente: string; desejo: string };
export type PessoaOp = { id: string; nome: string; perfil: string };
export type AtvForm = {
  id: string; descricao: string; data: string; hora: string; prioridade: string; periodicidade: string; observacao: string;
  pessoas: string[]; placa: string; lead: string; status: string; podeExcluir: boolean;
};

const PERIODOS = [["", "Não repete"], ["DIÁRIA", "Diária"], ["SEMANAL", "Semanal"], ["QUINZENAL", "Quinzenal"], ["MENSAL", "Mensal"]] as const;
const STATUS = [["A FAZER", "A fazer"], ["EM ANDAMENTO", "Em andamento"], ["FINALIZADO", "Finalizado"]] as const;
const PERFIL: Record<string, string> = { gestor: "Gestor", vendedor: "Vendedor", preparador: "Preparador" };

export function NovaAtividadeForm({ motos, leads, pessoas, inicial, volta, hoje, eu }: {
  motos: MotoOp[]; leads: LeadOp[]; pessoas: PessoaOp[]; inicial: Partial<AtvForm>; volta: string; hoje: string; eu: string | null;
}) {
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction<AtvState>(salvarAtividade, {});
  const editando = !!inicial.id;
  const [vinculo, setVinculo] = useState(inicial.placa ? "moto" : inicial.lead ? "lead" : "nenhum");
  const [placa, setPlaca] = useState(inicial.placa ?? "");
  const [urgente, setUrgente] = useState(inicial.prioridade === "URGENTE");
  const [marcadas, setMarcadas] = useState<string[]>(inicial.pessoas ?? (eu ? [eu] : []));
  const [excluindo, startEx] = useTransition();
  const [erroEx, setErroEx] = useState("");
  useEffect(() => { if (state.destino) { router.replace(state.destino); router.refresh(); } }, [state.destino, state.ok, router]);
  const motoEscolhida = motos.find((m) => m.placa === placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const grupos = ["vendedor", "preparador", "gestor"].map((p) => ({ p, lista: pessoas.filter((x) => x.perfil === p) })).filter((g) => g.lista.length);

  return (
    <form onSubmit={onSubmit} className="atv-form">
      <input type="hidden" name="volta" value={volta} />
      {editando && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="prioridade" value={urgente ? "URGENTE" : "NORMAL"} />

      <section className="sec stack">
        <div className="field">
          <label htmlFor="descricao">O que precisa ser feito?</label>
          <textarea id="descricao" name="descricao" className="input" rows={2} required defaultValue={inicial.descricao}
            placeholder="Ex.: ligar para o cliente; conferir documento da moto; reunião de alinhamento…" />
        </div>
        <div className="atv-linha">
          <div className="field"><label htmlFor="data">Data</label><input id="data" name="data" type="date" className="input" defaultValue={inicial.data ?? hoje} /></div>
          <div className="field"><label htmlFor="hora">Hora</label><input id="hora" name="hora" type="time" className="input" defaultValue={inicial.hora} /></div>
          <div className="field">
            <span className="label">Prioridade</span>
            <div className="toggle" role="radiogroup" aria-label="Prioridade">
              <label><input type="radio" checked={!urgente} onChange={() => setUrgente(false)} /> Normal</label>
              <label className="urg"><input type="radio" checked={urgente} onChange={() => setUrgente(true)} /> Urgente</label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="periodicidade">Repetir</label>
            <select id="periodicidade" name="periodicidade" className="input" defaultValue={inicial.periodicidade ?? ""}>
              {PERIODOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {editando && (
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" className="input" defaultValue={inicial.status}>
                {STATUS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="sec stack">
        <div className="field">
          <span className="label">Pessoas marcadas <small className="faint">(cada uma vê a atividade nas suas Tarefas)</small></span>
          {grupos.length === 0 && <div className="faint">Ninguém cadastrado na equipe ainda.</div>}
          {grupos.map((g) => (
            <div key={g.p} className="pessoas-grupo">
              <span className="pessoas-titulo">{PERFIL[g.p]}es</span>
              <div className="chips">
                {g.lista.map((p) => {
                  const on = marcadas.includes(p.id);
                  return (
                    <label key={p.id} className={`chip ${on ? "active" : ""}`}>
                      <input type="checkbox" name="pessoas" value={p.id} checked={on} hidden
                        onChange={() => setMarcadas((m) => (on ? m.filter((x) => x !== p.id) : [...m, p.id]))} />
                      {p.nome}{p.id === eu ? " (você)" : ""}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="observacao">Observação</label>
          <textarea id="observacao" name="observacao" className="input" rows={3} defaultValue={inicial.observacao} placeholder="Detalhes, combinados, o que já foi feito…" />
        </div>
      </section>

      <section className="sec stack">
        <div className="field">
          <span className="label">Ligada a</span>
          <div className="toggle wide-toggle" role="radiogroup" aria-label="Ligada a">
            {([["nenhum", "Nada (rotina)"], ["moto", "Uma moto"], ["lead", "Um lead"]] as const).map(([v, txt]) => (
              <label key={v}><input type="radio" name="vinculo" value={v} checked={vinculo === v} onChange={() => setVinculo(v)} /> {txt}</label>
            ))}
          </div>
        </div>
        {vinculo === "moto" && (
          <div className="field">
            <label htmlFor="placa">Moto (placa ou modelo)</label>
            <input id="placa" name="placa" className="input mono" list="motos-lista" value={placa} onChange={(e) => setPlaca(e.target.value.split(" ")[0].toUpperCase())}
              placeholder="Digite a placa ou escolha" autoComplete="off" style={{ textTransform: "uppercase" }} required />
            <datalist id="motos-lista">{motos.map((m) => <option key={m.placa} value={m.placa}>{m.modelo}</option>)}</datalist>
            {motoEscolhida && <small className="faint">{motoEscolhida.modelo}</small>}
          </div>
        )}
        {vinculo === "lead" && (
          <div className="field">
            <label htmlFor="lead">Lead</label>
            {leads.length ? (
              <select id="lead" name="lead" className="input" defaultValue={inicial.lead ?? ""} required>
                <option value="" disabled>Escolha o cliente…</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.cliente}{l.desejo ? ` — ${l.desejo}` : ""}</option>)}
              </select>
            ) : <div className="faint">Nenhum lead ativo.</div>}
          </div>
        )}
      </section>

      {state.erro && <div className="alert bad">{state.erro}</div>}
      {erroEx && <div className="alert bad">{erroEx}</div>}
      <div className="atv-form-acoes">
        <button className="btn" disabled={pending}>{pending ? "Salvando…" : editando ? "Salvar alterações" : "Lançar atividade"}</button>
        {editando && inicial.podeExcluir && (
          <button type="button" className="btn ghost small perigo-txt" disabled={excluindo}
            onClick={() => { if (confirm("Excluir esta atividade?")) startEx(async () => { const r = await excluirAction(inicial.id!); if (r.erro) setErroEx(r.erro); else if (r.destino) { router.replace(r.destino); router.refresh(); } }); }}>
            {excluindo ? "Excluindo…" : "Excluir atividade"}
          </button>
        )}
      </div>
    </form>
  );
}
