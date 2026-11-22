"use client";
import { useFormAction } from "@/components/useFormAction";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ModeloPicker } from "@/components/ModeloPicker";
import { TIPOS, type ModeloCat } from "@/lib/motos";
import { salvarLeadAction, type LeadState } from "./actions";
import type { LeadVM } from "./dados";
import { STATUS } from "@/lib/leadsStatus";

const PAGAMENTOS = ["À vista", "Financiamento", "Consórcio", "Troca + diferença"];
const iso = (br: string) => { const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

export function LeadForm({ lead, catalogo, vendedores }: { lead: LeadVM | null; catalogo: ModeloCat[]; vendedores: { id: string; nome: string }[] }) {
  const [state, onSubmit, pending] = useFormAction<LeadState>(salvarLeadAction, {});
  const router = useRouter();
  useEffect(() => { if (state.destino) { router.replace(state.destino); router.refresh(); } }, [state.destino, state.n, router]);
  return (
    <form onSubmit={onSubmit} className="prep-form">
      {lead && <input type="hidden" name="id" value={lead.id} />}
      <fieldset disabled={pending}>
        <section className="sec">
          <h2 className="sec-title">Cliente</h2>
          <div className="form-grid">
            <div className="field span-2"><label htmlFor="cliente">Nome</label><input id="cliente" name="cliente" className="input" defaultValue={lead?.cliente} required /></div>
            <div className="field"><label htmlFor="telefone">Telefone / WhatsApp</label><input id="telefone" name="telefone" className="input" inputMode="tel" defaultValue={lead?.telefone} required placeholder="41 99999-9999" /></div>
            <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={lead?.email} /></div>
            <div className="field">
              <label htmlFor="syonet">Syonet (nº do lead)</label>
              <input id="syonet" name="syonet" className="input mono" defaultValue={lead?.syonet} placeholder="ainda não cadastrado" />
              {!lead?.syonet && <span className="combo-hint">Sem o número, o lead vira uma pendência sua em Tarefas.</span>}
            </div>
            {vendedores.length > 0 && (
              <div className="field">
                <label htmlFor="vendedorId">Vendedor responsável</label>
                <select id="vendedorId" name="vendedorId" className="input" defaultValue={lead?.vendedorId ?? ""}>
                  <option value="">{lead ? "— manter —" : "Eu (gestor)"}</option>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Moto desejada</h2>
          <div className="form-grid">
            <ModeloPicker catalogo={catalogo} marcaInicial={lead?.marca} modeloInicial={lead?.modelo} tipoInicial={lead?.tipo} />
            <div className="field">
              <label htmlFor="tipoLivre">Ou só o tipo</label>
              <select id="tipoLivre" name="tipoLivre" className="input" defaultValue={!lead?.modelo ? lead?.tipo ?? "" : ""}>
                <option value="">—</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="anoMin">Ano a partir de</label><input id="anoMin" name="anoMin" className="input" inputMode="numeric" defaultValue={lead?.anoMin} placeholder="2020" /></div>
            <div className="field"><label htmlFor="valorMax">Valor até (R$)</label><input id="valorMax" name="valorMax" className="input" inputMode="decimal" defaultValue={lead?.valorMax} placeholder="80.000" /></div>
          </div>
          <div className="switches">
            <label className="switch">
              <input type="checkbox" name="aceitaEquivalente" defaultChecked={lead ? lead.aceitaEquivalente : true} />
              <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
              <span className="switch-label">Aceita moto equivalente de outra marca</span>
            </label>
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Negociação</h2>
          <div className="form-grid">
            <div className="field span-2">
              <span className="label">Status</span>
              <div className="chips">
                {STATUS.map((s) => (
                  <label key={s.id} className="chip radio-chip"><input type="radio" name="status" value={s.id} defaultChecked={(lead?.status ?? "NOVO") === s.id} />{s.label}</label>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="pagamento">Pagamento</label>
              <select id="pagamento" name="pagamento" className="input" defaultValue={lead?.pagamento ?? ""}>
                <option value="">—</option>{PAGAMENTOS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="proximoContato">Próximo contato</label><input id="proximoContato" name="proximoContato" type="date" className="input" defaultValue={iso(lead?.proximoContato ?? "")} /></div>
            <div className="field span-2"><label htmlFor="usado">Usado na troca</label><input id="usado" name="usado" className="input" defaultValue={lead?.usado} placeholder="Ex.: CB 500F 2021, 18 mil km" /></div>
            <div className="field wide"><label htmlFor="observacoes">Observações</label><textarea id="observacoes" name="observacoes" className="input" defaultValue={lead?.observacoes} /></div>
          </div>
        </section>
      </fieldset>
      {state.erro && <div className="alert bad" role="alert">{state.erro}</div>}
      <div className="action-bar"><div className="action-bar-main"><button className="btn" disabled={pending}>{pending ? "Salvando…" : lead ? "Salvar" : "Cadastrar lead"}</button></div></div>
    </form>
  );
}
