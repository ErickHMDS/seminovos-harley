"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarPreparacao, type SalvarState } from "./actions";

type Item = Record<string, string> & { etapa: string };
type Sugestao = { placa: string; modelo: string; cor: string; ano: string; km: string; loja: string };

const ETAPAS = ["INSPEÇÃO", "FORNECEDOR", "FOTOS", "FINALIZADA"];
const PROXIMA: Record<string, string> = {
  "INSPEÇÃO": "Enviar ao fornecedor",
  FORNECEDOR: "Registrar retorno do fornecedor",
  FOTOS: "Finalizar preparação",
};

/** "21/11/2026" -> "2026-11-21" para <input type="date"> */
function brParaIso(v?: string) {
  const m = (v ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function SimNao({ name, value, label }: { name: string; value?: string; label: string }) {
  const v = (value ?? "").toUpperCase();
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="toggle" role="radiogroup" aria-label={label}>
        <label><input type="radio" name={name} value="SIM" defaultChecked={v === "SIM"} /><span>Sim</span></label>
        <label><input type="radio" name={name} value="NÃO" defaultChecked={v === "NÃO" || v === "NAO"} /><span>Não</span></label>
      </div>
    </div>
  );
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

function textoEmail(f: FormData) {
  const g = (k: string) => String(f.get(k) ?? "").trim() || "—";
  const sn = (k: string) => (String(f.get(k) ?? "") ? String(f.get(k)) : "não informado");
  const data = (k: string) => {
    const v = String(f.get(k) ?? "");
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v || "—";
  };
  return [
    `Moto enviada para preparação: ${g("modelo")} — placa ${g("placa")}`,
    "",
    "DADOS DA MOTO",
    `• Modelo: ${g("modelo")}`,
    `• Placa: ${g("placa")}   • Chassi: ${g("chassi")}`,
    `• Cor: ${g("cor")}   • Ano: ${g("ano")}   • Km: ${g("km")}`,
    `• Loja: ${g("loja")}`,
    "",
    "O QUE VEIO COM A MOTO",
    `• Manual: ${sn("manual")}`,
    `• Chave reserva: ${sn("chaveReserva")}`,
    `• Última revisão: ${g("ultimaRevisao")}`,
    "",
    "INSPEÇÃO 360",
    `• Riscos/arranhões: ${g("riscos")}`,
    `• Sujeira: ${g("sujeira")}`,
    `• Detalhes estéticos: ${g("estetica")}`,
    `• Serviços necessários: ${g("servicos")}`,
    "",
    "ENVIO",
    `• Fornecedor: ${g("fornecedor")}`,
    `• Data de saída: ${data("dataSaida")}`,
    `• Prazo de entrega: ${data("prazoEntrega")}`,
    "",
    `Observações: ${g("observacoes")}`,
  ].join("\n");
}

export function PrepForm({ item, editar, sugestoes, coordenadorEmail, hoje = "" }: { item: Item | null; editar: boolean; sugestoes: Sugestao[]; coordenadorEmail: string; hoje?: string }) {
  const [state, action, pending] = useActionState<SalvarState, FormData>(salvarPreparacao, {});
  const router = useRouter();
  useEffect(() => {
    if (!state.destino) return;
    router.replace(state.destino, { scroll: true });
    router.refresh();
  }, [state.destino, state.n, router]);
  const formRef = useRef<HTMLFormElement>(null);
  const acaoRef = useRef<HTMLInputElement>(null);
  const [erroLocal, setErroLocal] = useState("");
  const definirAcao = (a: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setErroLocal("");
    const forn = (formRef.current?.elements.namedItem("fornecedor") as HTMLInputElement | null)?.value.trim();
    if (a === "avancar" && item?.etapa === "INSPEÇÃO" && !forn) {
      e.preventDefault();
      setErroLocal("Informe o fornecedor antes de enviar a moto.");
      (formRef.current?.elements.namedItem("fornecedor") as HTMLInputElement | null)?.focus();
      return;
    }
    if (acaoRef.current) acaoRef.current.value = a;
  };
  const [copiado, setCopiado] = useState(false);
  const etapaIdx = item ? ETAPAS.indexOf(item.etapa) : 0;
  const novo = !item;

  function preencherPelaPlaca(placa: string) {
    const s = sugestoes.find((x) => x.placa === placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    const f = formRef.current;
    if (!s || !f) return;
    const set = (n: string, v: string) => {
      const el = f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null;
      if (el && !el.value && v) el.value = v;
    };
    set("modelo", s.modelo); set("cor", s.cor); set("ano", s.ano); set("km", s.km); set("loja", s.loja);
  }

  function abrirEmail() {
    if (!formRef.current) return;
    const f = new FormData(formRef.current);
    const assunto = `Preparação · ${String(f.get("modelo") || "")} · ${String(f.get("placa") || "")}`;
    window.location.href = `mailto:${encodeURIComponent(coordenadorEmail)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(textoEmail(f))}`;
  }

  async function copiarTexto() {
    if (!formRef.current) return;
    await navigator.clipboard.writeText(textoEmail(new FormData(formRef.current)));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const v = (k: string) => item?.[k] ?? "";

  return (
    <form ref={formRef} action={action} className="panel">
      <fieldset disabled={!editar || pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="acao" ref={acaoRef} />

        <div className="section">
          <div className="section-title"><span className="n">1</span><h2>Recepção e inspeção 360</h2></div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="placa">Placa</label>
              <input id="placa" name="placa" className="input" defaultValue={v("placa")} list="placas-estoque" autoComplete="off"
                onBlur={(e) => preencherPelaPlaca(e.target.value)} style={{ textTransform: "uppercase" }} />
              {sugestoes.length > 0 && <datalist id="placas-estoque">{sugestoes.map((s) => <option key={s.placa} value={s.placa}>{s.modelo}</option>)}</datalist>}
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}><label htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" className="input" defaultValue={v("modelo")} /></div>
            <div className="field"><label htmlFor="chassi">Chassi</label><input id="chassi" name="chassi" className="input" defaultValue={v("chassi")} /></div>
            <div className="field"><label htmlFor="cor">Cor</label><input id="cor" name="cor" className="input" defaultValue={v("cor")} /></div>
            <div className="field"><label htmlFor="ano">Ano</label><input id="ano" name="ano" className="input" inputMode="numeric" defaultValue={v("ano")} /></div>
            <div className="field"><label htmlFor="km">Quilometragem</label><input id="km" name="km" className="input" inputMode="numeric" defaultValue={v("km")} /></div>
            <div className="field">
              <label htmlFor="loja">Loja</label>
              <select id="loja" name="loja" className="input" defaultValue={v("loja")}>
                <option value="">—</option><option>Curitiba</option><option>Londrina</option>
              </select>
            </div>
            <div className="field"><label htmlFor="dataRecepcao">Data de recepção</label><input id="dataRecepcao" name="dataRecepcao" type="date" className="input" defaultValue={brParaIso(v("dataRecepcao")) || (novo ? hoje : "")} /></div>
            <div className="field"><label htmlFor="responsavel">Responsável</label><input id="responsavel" name="responsavel" className="input" defaultValue={v("responsavel")} /></div>
            <SimNao name="manual" label="Manual" value={v("manual")} />
            <SimNao name="chaveReserva" label="Chave reserva" value={v("chaveReserva")} />
            <div className="field"><label htmlFor="ultimaRevisao">Última revisão</label><input id="ultimaRevisao" name="ultimaRevisao" className="input" placeholder="ex.: 10.000 km em 03/2026" defaultValue={v("ultimaRevisao")} /></div>
            <div className="field wide"><label htmlFor="riscos">Riscos / arranhões</label><textarea id="riscos" name="riscos" className="input" defaultValue={v("riscos")} placeholder="Onde e quais riscos superficiais foram encontrados" /></div>
            <div className="field"><label htmlFor="sujeira">Sujeira</label><textarea id="sujeira" name="sujeira" className="input" defaultValue={v("sujeira")} /></div>
            <div className="field" style={{ gridColumn: "span 2" }}><label htmlFor="estetica">Detalhes estéticos</label><textarea id="estetica" name="estetica" className="input" defaultValue={v("estetica")} /></div>
            <div className="field wide"><label htmlFor="servicos">Serviços necessários</label><textarea id="servicos" name="servicos" className="input" defaultValue={v("servicos")} placeholder="O que o fornecedor deve fazer (polimento, revisão, pneus…)" /></div>
          </div>
        </div>

        {!novo && (
          <>
            <div className="section">
              <div className={`section-title ${etapaIdx < 1 ? "locked" : ""}`}><span className="n">2</span><h2>Envio ao fornecedor</h2></div>
              <div className="form-grid">
                <div className="field" style={{ gridColumn: "span 2" }}><label htmlFor="fornecedor">Fornecedor</label><input id="fornecedor" name="fornecedor" className="input" defaultValue={v("fornecedor")} /></div>
                <div className="field"><label htmlFor="dataSaida">Data de saída</label><input id="dataSaida" name="dataSaida" type="date" className="input" defaultValue={brParaIso(v("dataSaida"))} /></div>
                <div className="field"><label htmlFor="prazoEntrega">Prazo de entrega</label><input id="prazoEntrega" name="prazoEntrega" type="date" className="input" defaultValue={brParaIso(v("prazoEntrega"))} /></div>
              </div>
              <div className="panel" style={{ background: "var(--panel-2)", marginTop: 14, padding: 14 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong>E-mail ao coordenador</strong>
                    <div className="muted" style={{ fontSize: 13 }}>Monta o e-mail com tudo o que veio com a moto e para onde ela foi.{!coordenadorEmail && " (configure COORDENADOR_EMAIL para preencher o destinatário)"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn small" onClick={abrirEmail}>Abrir e-mail</button>
                    <button type="button" className="btn small ghost" onClick={copiarTexto}>{copiado ? "Copiado ✓" : "Copiar texto"}</button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                  <Check name="emailEnviado" checked={!!v("emailEnviado")} label={`E-mail enviado ao coordenador${v("emailEnviado") ? ` (em ${v("emailEnviado")})` : ""}`} />
                  <Check name="fotoPreparacao" checked={!!v("fotoPreparacao")} label="Foto “em preparação” postada no site" />
                </div>
              </div>
            </div>

            <div className="section">
              <div className={`section-title ${etapaIdx < 2 ? "locked" : ""}`}><span className="n">3</span><h2>Retorno e fotos oficiais</h2></div>
              <div className="form-grid">
                <div className="field"><label htmlFor="dataRetorno">Data de retorno</label><input id="dataRetorno" name="dataRetorno" type="date" className="input" defaultValue={brParaIso(v("dataRetorno"))} /></div>
                <div className="field"><label htmlFor="fotosOficiais">Fotos oficiais tiradas</label><input id="fotosOficiais" name="fotosOficiais" type="number" min={0} max={50} className="input" defaultValue={v("fotosOficiais")} placeholder="10 a 12" /></div>
                <div className="field" style={{ justifyContent: "flex-end" }}><Check name="postadoRedes" checked={!!v("postadoRedes")} label="Postada no site e nas redes de venda" /></div>
              </div>
            </div>
          </>
        )}

        <div className="section">
          <div className="form-grid">
            <div className="field wide"><label htmlFor="observacoes">Observações</label><textarea id="observacoes" name="observacoes" className="input" defaultValue={v("observacoes")} /></div>
          </div>
        </div>

        {(erroLocal || state.erro) && <div className="alert bad" role="alert" style={{ marginTop: 16 }}>{erroLocal || state.erro}</div>}

        {editar && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20, justifyContent: "flex-end" }}>
            {!novo && etapaIdx > 0 && <button type="submit" onClick={definirAcao("voltar")} className="btn ghost small" style={{ marginRight: "auto" }}>← Voltar etapa</button>}
            {novo ? (
              <button type="submit" onClick={definirAcao("salvar")} className="btn">{pending ? "Salvando…" : "Registrar moto"}</button>
            ) : (
              <>
                <button type="submit" onClick={definirAcao("salvar")} className="btn ghost">{pending ? "Salvando…" : "Salvar"}</button>
                {PROXIMA[item!.etapa] && <button type="submit" onClick={definirAcao("avancar")} className="btn">Salvar e {PROXIMA[item!.etapa].toLowerCase()} →</button>}
              </>
            )}
          </div>
        )}
        {!editar && <p className="faint" style={{ marginTop: 16, fontSize: 13 }}>Somente leitura para o seu perfil.</p>}
      </fieldset>
    </form>
  );
}
