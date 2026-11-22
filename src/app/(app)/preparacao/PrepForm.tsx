"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHECKLIST, lerItem, type EstadoItem } from "@/lib/checklist";
import { salvarPreparacao, type SalvarState } from "./actions";

type Item = Record<string, string> & { etapa: string };
type Sugestao = { placa: string; modelo: string; cor: string; ano: string; km: string; loja: string };

const ETAPAS = ["INSPEÇÃO", "FORNECEDOR", "FOTOS", "FINALIZADA"];
const PROXIMA: Record<string, string> = {
  "INSPEÇÃO": "Enviar ao fornecedor",
  FORNECEDOR: "Moto voltou do fornecedor",
  FOTOS: "Finalizar preparação",
};

/** "21/11/2026" -> "2026-11-21" para <input type="date"> */
function brParaIso(v?: string) {
  const m = (v ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function Check({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  return (
    <label className="check">
      <input type="hidden" name={`__${name}`} value="1" />
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

type Estado = Record<string, { estado: EstadoItem; obs: string }>;

export function PrepForm({ item, editar, sugestoes, hoje = "" }: { item: Item | null; editar: boolean; sugestoes: Sugestao[]; hoje?: string }) {
  const [state, action, pending] = useActionState<SalvarState, FormData>(salvarPreparacao, {});
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const acaoRef = useRef<HTMLInputElement>(null);
  const [erroLocal, setErroLocal] = useState("");
  const [ck, setCk] = useState<Estado>(() =>
    Object.fromEntries(CHECKLIST.map((d) => [d.campo, lerItem(d, item?.[d.campo])])),
  );

  useEffect(() => {
    if (!state.destino) return;
    router.replace(state.destino, { scroll: true });
    router.refresh();
  }, [state.destino, state.n, router]);

  const novo = !item;
  const etapaIdx = item ? ETAPAS.indexOf(item.etapa) : 0;
  const v = (k: string) => item?.[k] ?? "";
  const nPend = Object.values(ck).filter((x) => x.estado === "pendente").length;
  const nFalta = Object.values(ck).filter((x) => x.estado === "vazio").length;

  const definirAcao = (a: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setErroLocal("");
    const f = formRef.current;
    const forn = (f?.elements.namedItem("fornecedor") as HTMLInputElement | null)?.value.trim();
    if (novo && nFalta > 0) {
      e.preventDefault();
      setErroLocal(`Marque todos os itens do checklist (falta${nFalta > 1 ? "m" : ""} ${nFalta}).`);
      document.getElementById("checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (a === "avancar" && item?.etapa === "INSPEÇÃO" && !forn) {
      e.preventDefault();
      setErroLocal("Informe o fornecedor antes de enviar a moto.");
      (f?.elements.namedItem("fornecedor") as HTMLInputElement | null)?.focus();
      return;
    }
    if (acaoRef.current) acaoRef.current.value = a;
  };

  function preencherPelaPlaca(placa: string) {
    const s = sugestoes.find((x) => x.placa === placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    const f = formRef.current;
    if (!s || !f) return;
    const set = (n: string, val: string) => {
      const el = f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
      if (el && !el.value && val) el.value = val;
    };
    set("modelo", s.modelo); set("cor", s.cor); set("ano", s.ano); set("km", s.km); set("loja", s.loja);
  }

  const marcar = (campo: string, estado: EstadoItem) => {
    setErroLocal("");
    setCk((prev) => ({ ...prev, [campo]: { ...prev[campo], estado: prev[campo].estado === estado ? "vazio" : estado } }));
  };

  return (
    <form ref={formRef} action={action} className="prep-form">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="acao" ref={acaoRef} />
      <fieldset disabled={!editar || pending}>
        <section className="sec">
          <h2 className="sec-title">Moto</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="placa">Placa</label>
              <input id="placa" name="placa" className="input mono" defaultValue={v("placa")} list="placas-estoque" autoComplete="off"
                onBlur={(e) => preencherPelaPlaca(e.target.value)} style={{ textTransform: "uppercase" }} placeholder="ABC1D23" />
              {sugestoes.length > 0 && <datalist id="placas-estoque">{sugestoes.map((s) => <option key={s.placa} value={s.placa}>{s.modelo}</option>)}</datalist>}
            </div>
            <div className="field span-2"><label htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" className="input" defaultValue={v("modelo")} /></div>
            <div className="field"><label htmlFor="cor">Cor</label><input id="cor" name="cor" className="input" defaultValue={v("cor")} /></div>
            <div className="field"><label htmlFor="ano">Ano</label><input id="ano" name="ano" className="input" inputMode="numeric" defaultValue={v("ano")} /></div>
            <div className="field"><label htmlFor="km">Km</label><input id="km" name="km" className="input" inputMode="numeric" defaultValue={v("km")} /></div>
            <div className="field">
              <label htmlFor="loja">Loja</label>
              <select id="loja" name="loja" className="input" defaultValue={v("loja")}>
                <option value="">—</option><option>Curitiba</option><option>Londrina</option>
              </select>
            </div>
            <div className="field"><label htmlFor="chassi">Chassi</label><input id="chassi" name="chassi" className="input mono" defaultValue={v("chassi")} /></div>
            <div className="field"><label htmlFor="responsavel">Responsável</label><input id="responsavel" name="responsavel" className="input" defaultValue={v("responsavel")} /></div>
            <div className="field"><label htmlFor="dataRecepcao">Recebida em</label><input id="dataRecepcao" name="dataRecepcao" type="date" className="input" defaultValue={brParaIso(v("dataRecepcao")) || (novo ? hoje : "")} /></div>
          </div>
        </section>

        <section className="sec" id="checklist">
          <div className="sec-head">
            <h2 className="sec-title">Checklist 360</h2>
            <span className={`badge ${nPend ? "warn" : nFalta ? "" : "ok"}`}>
              {nPend ? `${nPend} pendente${nPend > 1 ? "s" : ""}` : nFalta ? `${CHECKLIST.length - nFalta}/${CHECKLIST.length}` : "tudo OK"}
            </span>
          </div>
          <div className="ck-list">
            {CHECKLIST.map((def) => {
              const st = ck[def.campo];
              const sim = def.tipo === "simnao";
              return (
                <div key={def.campo} className={`ck ${st.estado}`}>
                  <input type="hidden" name={`ck_${def.campo}`} value={st.estado === "vazio" ? "" : st.estado} />
                  <div className="ck-row">
                    <span className="ck-label">{def.label}</span>
                    <div className="ck-seg" role="group" aria-label={def.label}>
                      <button type="button" className="ck-ok" aria-pressed={st.estado === "ok"} onClick={() => marcar(def.campo, "ok")}>{sim ? "Tem" : "OK"}</button>
                      <button type="button" className="ck-pend" aria-pressed={st.estado === "pendente"} onClick={() => marcar(def.campo, "pendente")}>{sim ? "Falta" : "Pendente"}</button>
                    </div>
                  </div>
                  {st.estado === "pendente" && (
                    <input className="input ck-obs" name={`ckobs_${def.campo}`} placeholder="O que precisa ser feito?" defaultValue={st.obs}
                      onChange={(e) => { const obs = e.target.value; setCk((prev) => ({ ...prev, [def.campo]: { ...prev[def.campo], obs } })); }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="ultimaRevisao">Última revisão</label>
            <input id="ultimaRevisao" name="ultimaRevisao" className="input" placeholder="ex.: 10.000 km em 03/2026" defaultValue={v("ultimaRevisao")} />
          </div>
          {nPend > 0 && <p className="hint-line">As pendências viram atividades para o gestor resolver.</p>}
        </section>

        <section className="sec">
          <h2 className="sec-title">Serviços para o fornecedor</h2>
          <textarea name="servicos" className="input" defaultValue={v("servicos")} placeholder="Polimento, revisão, troca de pneus…" aria-label="Serviços para o fornecedor" />
        </section>

        {!novo && (
          <>
            <section className={`sec ${etapaIdx < 1 ? "sec-future" : ""}`}>
              <h2 className="sec-title">Fornecedor</h2>
              <div className="form-grid">
                <div className="field span-2"><label htmlFor="fornecedor">Fornecedor</label><input id="fornecedor" name="fornecedor" className="input" defaultValue={v("fornecedor")} /></div>
                <div className="field"><label htmlFor="dataSaida">Saída</label><input id="dataSaida" name="dataSaida" type="date" className="input" defaultValue={brParaIso(v("dataSaida"))} /></div>
                <div className="field"><label htmlFor="prazoEntrega">Prazo</label><input id="prazoEntrega" name="prazoEntrega" type="date" className="input" defaultValue={brParaIso(v("prazoEntrega"))} /></div>
              </div>
              <div style={{ marginTop: 12 }}><Check name="fotoPreparacao" checked={!!v("fotoPreparacao")} label="Foto “em preparação” postada no site" /></div>
            </section>

            <section className={`sec ${etapaIdx < 2 ? "sec-future" : ""}`}>
              <h2 className="sec-title">Retorno e fotos oficiais</h2>
              <div className="form-grid">
                <div className="field"><label htmlFor="dataRetorno">Voltou em</label><input id="dataRetorno" name="dataRetorno" type="date" className="input" defaultValue={brParaIso(v("dataRetorno"))} /></div>
                <div className="field"><label htmlFor="fotosOficiais">Fotos tiradas</label><input id="fotosOficiais" name="fotosOficiais" type="number" min={0} max={50} className="input" defaultValue={v("fotosOficiais")} placeholder="10 a 12" /></div>
              </div>
              <div style={{ marginTop: 12 }}><Check name="postadoRedes" checked={!!v("postadoRedes")} label="Postada no site e nas redes de venda" /></div>
            </section>
          </>
        )}

        <section className="sec">
          <h2 className="sec-title">Observações</h2>
          <textarea name="observacoes" className="input" defaultValue={v("observacoes")} aria-label="Observações" />
        </section>
      </fieldset>

      {(erroLocal || state.erro) && <div className="alert bad" role="alert">{erroLocal || state.erro}</div>}

      {editar ? (
        <div className="action-bar">
          {!novo && etapaIdx > 0 && <button type="submit" onClick={definirAcao("voltar")} className="btn ghost small" disabled={pending}>← Voltar</button>}
          <div className="action-bar-main">
            {novo ? (
              <button type="submit" onClick={definirAcao("salvar")} className="btn" disabled={pending}>{pending ? "Salvando…" : "Concluir inspeção 360"}</button>
            ) : (
              <>
                <button type="submit" onClick={definirAcao("salvar")} className="btn ghost" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</button>
                {PROXIMA[item!.etapa] && <button type="submit" onClick={definirAcao("avancar")} className="btn" disabled={pending}>{PROXIMA[item!.etapa]} →</button>}
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="faint" style={{ fontSize: 13 }}>Somente leitura para o seu perfil.</p>
      )}
    </form>
  );
}
