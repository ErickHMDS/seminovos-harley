"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormAction } from "@/components/useFormAction";
import { lancarAtividade, type AtvState } from "../actions";

type MotoOp = { placa: string; modelo: string };
type LeadOp = { id: string; cliente: string; desejo: string };

export function NovaAtividadeForm({ motos, leads, inicial, volta, hoje }: { motos: MotoOp[]; leads: LeadOp[]; inicial: { placa: string; lead: string }; volta: string; hoje: string }) {
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction<AtvState>(lancarAtividade, {});
  const [vinculo, setVinculo] = useState(inicial.placa ? "moto" : inicial.lead ? "lead" : "nenhum");
  const [placa, setPlaca] = useState(inicial.placa);
  useEffect(() => { if (state.destino) { router.replace(state.destino); router.refresh(); } }, [state.destino, state.ok, router]);
  const motoEscolhida = motos.find((m) => m.placa === placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));

  return (
    <form onSubmit={onSubmit} className="sec stack" style={{ maxWidth: 640 }}>
      <input type="hidden" name="volta" value={volta} />
      <div className="field">
        <label htmlFor="descricao">O que precisa ser feito?</label>
        <textarea id="descricao" name="descricao" className="input" rows={3} required placeholder="Ex.: ligar para o cliente amanhã às 10h; conferir documento da moto…" />
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="prazo">Para quando (opcional)</label>
        <input id="prazo" name="prazo" type="date" className="input" min={hoje} />
      </div>
      <div className="field">
        <span className="label">Ligada a</span>
        <div className="toggle wide-toggle" role="radiogroup" aria-label="Ligada a">
          {([["nenhum", "Nada (rotina)"], ["moto", "Uma moto"], ["lead", "Um lead"]] as const).map(([v, txt]) => (
            <label key={v} className={vinculo === v ? "on" : ""}>
              <input type="radio" name="vinculo" value={v} checked={vinculo === v} onChange={() => setVinculo(v)} /> {txt}
            </label>
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
            <select id="lead" name="lead" className="input" defaultValue={inicial.lead} required>
              <option value="" disabled>Escolha o cliente…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.cliente}{l.desejo ? ` — ${l.desejo}` : ""}</option>)}
            </select>
          ) : <div className="faint">Nenhum lead ativo.</div>}
        </div>
      )}
      {state.erro && <div className="alert bad">{state.erro}</div>}
      <div><button className="btn" disabled={pending}>{pending ? "Salvando…" : "Lançar atividade"}</button></div>
    </form>
  );
}
