"use client";
import { useFormAction } from "@/components/useFormAction";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removerMotoAction, salvarMotoAction, type MotoState } from "./actions";

export type MotoVM = {
  aba: string; linha: number; empresa: string; placa: string; modelo: string; km: string; ano: string; cor: string; dataEntrada: string;
  custo: string; ultimoValorVenda: string; fipe: string; realinhamento: string; status: string; observacao: string; dias: number | null;
};

const STATUS = ["ANUNCIADO", "NÃO ANUNCIADO", "RESERVADA", "EM PREPARAÇÃO"];

export function MotoForm({ moto, abas, empresas, hoje }: { moto: MotoVM | null; abas: { id: string; label: string }[]; empresas: Record<string, string[]>; hoje: string }) {
  const [state, onSubmit, pending] = useFormAction<MotoState>(salvarMotoAction, {});
  const router = useRouter();
  const [aba, setAba] = useState(moto?.aba ?? abas[0]?.id ?? "");
  const [confirmar, setConfirmar] = useState(false);
  const [removendo, startRemover] = useTransition();
  const [erroRm, setErroRm] = useState("");
  useEffect(() => { if (state.destino) { router.replace(state.destino); router.refresh(); } }, [state.destino, state.n, router]);
  const iso = (br: string) => { const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const v = (k: keyof MotoVM) => (moto ? String(moto[k] ?? "") : "");

  return (
    <form onSubmit={onSubmit} className="prep-form">
      {moto && <><input type="hidden" name="linha" value={moto.linha} /><input type="hidden" name="placaOriginal" value={moto.placa} /><input type="hidden" name="aba" value={moto.aba} /></>}
      <fieldset disabled={pending || removendo}>
        <section className="sec">
          <h2 className="sec-title">Loja</h2>
          {moto ? (
            <p className="muted" style={{ margin: 0 }}>{abas.find((a) => a.id === moto.aba)?.label} · {moto.empresa}</p>
          ) : (
            <div className="form-grid">
              <div className="field">
                <span className="label">Estoque</span>
                <div className="toggle wide-toggle" role="radiogroup" aria-label="Estoque">
                  {abas.map((a) => (
                    <label key={a.id}><input type="radio" name="aba" value={a.id} checked={aba === a.id} onChange={() => setAba(a.id)} /><span>{a.label}</span></label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="empresa">Empresa</label>
                <select id="empresa" name="empresa" className="input" key={aba} defaultValue={empresas[aba]?.[0] ?? ""}>
                  {(empresas[aba] ?? []).map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>
          )}
          {moto && <input type="hidden" name="empresa" value={moto.empresa} />}
        </section>

        <section className="sec">
          <h2 className="sec-title">Moto</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="placa">Placa</label><input id="placa" name="placa" className="input mono" defaultValue={v("placa")} required style={{ textTransform: "uppercase" }} /></div>
            <div className="field span-2"><label htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" className="input" defaultValue={v("modelo")} required /></div>
            <div className="field"><label htmlFor="ano">Ano</label><input id="ano" name="ano" className="input" inputMode="numeric" defaultValue={v("ano")} /></div>
            <div className="field"><label htmlFor="km">Km</label><input id="km" name="km" className="input" inputMode="numeric" defaultValue={v("km")} /></div>
            <div className="field"><label htmlFor="cor">Cor</label><input id="cor" name="cor" className="input" defaultValue={v("cor")} /></div>
            <div className="field"><label htmlFor="dataEntrada">Entrada</label><input id="dataEntrada" name="dataEntrada" type="date" className="input" defaultValue={moto ? iso(moto.dataEntrada) : hoje} /></div>
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Valores</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="realinhamento">Preço (realinhamento)</label><input id="realinhamento" name="realinhamento" className="input" inputMode="decimal" defaultValue={v("realinhamento")} placeholder="R$" /></div>
            <div className="field"><label htmlFor="custo">Custo</label><input id="custo" name="custo" className="input" inputMode="decimal" defaultValue={v("custo")} placeholder="R$" /></div>
            <div className="field"><label htmlFor="fipe">FIPE</label><input id="fipe" name="fipe" className="input" inputMode="decimal" defaultValue={v("fipe")} placeholder="R$" /></div>
            <div className="field"><label htmlFor="ultimoValorVenda">Último valor de venda</label><input id="ultimoValorVenda" name="ultimoValorVenda" className="input" inputMode="decimal" defaultValue={v("ultimoValorVenda")} placeholder="R$" /></div>
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Anúncio</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="status">Status</label>
              <input id="status" name="status" className="input" list="status-list" defaultValue={v("status") === "SEM STATUS" ? "" : v("status")} />
              <datalist id="status-list">{STATUS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="field wide"><label htmlFor="observacao">Observação</label><textarea id="observacao" name="observacao" className="input" defaultValue={v("observacao")} /></div>
          </div>
        </section>
      </fieldset>

      {(state.erro || erroRm) && <div className="alert bad" role="alert">{state.erro || erroRm}</div>}

      <div className="action-bar">
        {moto && (confirmar ? (
          <button type="button" className="btn small danger" disabled={removendo}
            onClick={() => startRemover(async () => {
              const r = await removerMotoAction(moto.aba, moto.linha, moto.placa);
              if (r.erro) setErroRm(r.erro); else if (r.destino) { router.replace(r.destino); router.refresh(); }
            })}>{removendo ? "Removendo…" : "Confirmar: apagar linha"}</button>
        ) : (
          <button type="button" className="btn small ghost" onClick={() => setConfirmar(true)}>Remover do estoque</button>
        ))}
        <div className="action-bar-main">
          <button type="submit" className="btn" disabled={pending}>{pending ? "Salvando…" : moto ? "Salvar" : "Adicionar ao estoque"}</button>
        </div>
      </div>
    </form>
  );
}
