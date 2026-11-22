"use client";
import { useFormAction } from "@/components/useFormAction";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { apagarVenda, salvarVenda, type VendaState } from "./actions";

export type VendaVM = {
  aba: string; linha: number; mes: string; data: string; vendedor: string; pedido: string; loja: string; situacao: string; cliente: string;
  veiculo: string; placa: string; ge: boolean; fin: boolean; usado: boolean; seguro: string; prevFaturamento: string; observacoes: string;
};

const SITUACOES = [
  { id: "ESTOQUE", label: "Vendida", sub: "aguardando faturar" },
  { id: "FATURADO", label: "Faturado", sub: "concluída" },
  { id: "TRANSFERENCIA", label: "Transferência", sub: "" },
  { id: "CANCELADA", label: "Cancelada", sub: "não conta" },
];

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="switch">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
      <span className="switch-label">{label}</span>
    </label>
  );
}

export function VendaForm({ venda, vendedores, motos, hoje, podeExcluir, vendedorFixo = null }: {
  venda: VendaVM | null; vendedores: string[]; motos: { placa: string; modelo: string }[]; hoje: string; podeExcluir: boolean; vendedorFixo?: string | null;
}) {
  const [state, onSubmit, pending] = useFormAction<VendaState>(salvarVenda, {});
  const router = useRouter();
  const [excluindo, startExcluir] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [erroEx, setErroEx] = useState("");
  const [placa, setPlaca] = useState(venda?.placa ?? "");
  const [veiculo, setVeiculo] = useState(venda?.veiculo ?? "");

  useEffect(() => {
    if (!state.destino) return;
    router.replace(state.destino);
    router.refresh();
  }, [state.destino, state.n, router]);

  const iso = (br: string) => { const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
  const situacaoInicial = venda?.situacao && SITUACOES.some((s) => s.id === venda.situacao) ? venda.situacao : "ESTOQUE";
  const lojaInicial = venda?.loja && ["HARLEY", "TRIUMPH"].includes(venda.loja) ? venda.loja : "HARLEY";

  function onPlaca(v: string) {
    const p = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setPlaca(p);
    const m = motos.find((x) => x.placa === p);
    if (m && !veiculo) setVeiculo(m.modelo);
  }

  return (
    <form onSubmit={onSubmit} className="prep-form">
      {venda && <>
        <input type="hidden" name="aba" value={venda.aba} />
        <input type="hidden" name="linha" value={venda.linha} />
        <input type="hidden" name="orig_vendedor" value={venda.vendedor} />
        <input type="hidden" name="orig_veiculo" value={venda.veiculo} />
        <input type="hidden" name="orig_pedido" value={venda.pedido} />
      </>}
      <fieldset disabled={pending || excluindo}>
        <section className="sec">
          <h2 className="sec-title">Situação</h2>
          <div className="seg-grid">
            {SITUACOES.map((s) => (
              <label key={s.id} className={`seg-card ${s.id === "CANCELADA" ? "seg-bad" : ""}`}>
                <input type="radio" name="situacao" value={s.id} defaultChecked={s.id === situacaoInicial} />
                <strong>{s.label}</strong>{s.sub && <small>{s.sub}</small>}
              </label>
            ))}
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Venda</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="data">Data</label><input id="data" name="data" type="date" className="input" defaultValue={venda ? iso(venda.data) : hoje} required /></div>
            <div className="field span-2">
              <label htmlFor="vendedor">Vendedor</label>
              {vendedorFixo ? (
                <><input type="hidden" name="vendedor" value={vendedorFixo} /><input id="vendedor" className="input" value={vendedorFixo} readOnly /></>
              ) : (
              <select id="vendedor" name="vendedor" className="input" defaultValue={venda?.vendedor ?? ""} required>
                <option value="" disabled>Escolha…</option>
                {[...new Set([...(venda ? [venda.vendedor] : []), ...vendedores])].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              )}
            </div>
            <div className="field">
              <span className="label">Loja</span>
              <div className="toggle wide-toggle" role="radiogroup" aria-label="Loja">
                <label><input type="radio" name="loja" value="HARLEY" defaultChecked={lojaInicial === "HARLEY"} /><span>Harley</span></label>
                <label><input type="radio" name="loja" value="TRIUMPH" defaultChecked={lojaInicial === "TRIUMPH"} /><span>Triumph</span></label>
              </div>
            </div>
            <div className="field"><label htmlFor="pedido">Pedido</label><input id="pedido" name="pedido" className="input" inputMode="numeric" defaultValue={venda?.pedido} /></div>
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Moto e cliente</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="placa">Placa</label>
              <input id="placa" name="placa" className="input mono" value={placa} onChange={(e) => onPlaca(e.target.value)} list="placas-est" autoComplete="off" placeholder="ABC1D23" />
              <datalist id="placas-est">{motos.map((m) => <option key={m.placa} value={m.placa}>{m.modelo}</option>)}</datalist>
            </div>
            <div className="field span-2"><label htmlFor="veiculo">Veículo</label><input id="veiculo" name="veiculo" className="input" value={veiculo} onChange={(e) => setVeiculo(e.target.value)} required /></div>
            <div className="field span-2"><label htmlFor="cliente">Cliente</label><input id="cliente" name="cliente" className="input" defaultValue={venda?.cliente} /></div>
          </div>
          <div className="switches">
            <Toggle name="fin" label="Financiamento" defaultChecked={venda?.fin ?? false} />
            <Toggle name="ge" label="Garantia estendida" defaultChecked={venda?.ge ?? false} />
            <Toggle name="usado" label="Usado na troca" defaultChecked={venda?.usado ?? false} />
          </div>
        </section>

        <section className="sec">
          <h2 className="sec-title">Mais detalhes</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="seguro">Seguro</label>
              <input id="seguro" name="seguro" className="input" list="seguros" defaultValue={venda?.seguro} placeholder="—" />
              <datalist id="seguros"><option value="INDICADO" /><option value="VENDIDO" /><option value="NÃO" /></datalist>
            </div>
            <div className="field"><label htmlFor="prevFaturamento">Prev. faturamento</label><input id="prevFaturamento" name="prevFaturamento" className="input" defaultValue={venda?.prevFaturamento} /></div>
            <div className="field wide"><label htmlFor="observacoes">Observações</label><textarea id="observacoes" name="observacoes" className="input" defaultValue={venda?.observacoes} /></div>
          </div>
        </section>
      </fieldset>

      {(state.erro || erroEx) && <div className="alert bad" role="alert">{state.erro || erroEx}</div>}

      <div className="action-bar">
        {venda && podeExcluir && (
          confirmar ? (
            <button type="button" className="btn small danger" disabled={excluindo}
              onClick={() => startExcluir(async () => {
                const r = await apagarVenda(venda.aba, venda.linha, { vendedor: venda.vendedor, veiculo: venda.veiculo, pedido: venda.pedido }, venda.mes);
                if (r.erro) setErroEx(r.erro); else if (r.destino) { router.replace(r.destino); router.refresh(); }
              })}>{excluindo ? "Excluindo…" : "Confirmar exclusão"}</button>
          ) : (
            <button type="button" className="btn small ghost" onClick={() => setConfirmar(true)}>Excluir</button>
          )
        )}
        <div className="action-bar-main">
          <button type="submit" className="btn" disabled={pending}>{pending ? "Salvando…" : venda ? "Salvar alterações" : "Lançar venda"}</button>
        </div>
      </div>
    </form>
  );
}
