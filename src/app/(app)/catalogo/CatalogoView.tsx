"use client";
import { useFormAction } from "@/components/useFormAction";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { anosTexto, buscar, equivalentes, marcas as listaMarcas, segmentoPadrao, TIPOS, type ModeloCat } from "@/lib/motos";
import { excluirModeloAction, gravarBaseAction, salvarModeloAction, type CatState } from "./actions";

export type MotoEstoqueVM = {
  placa: string; modelo: string; fabricante: string; segmento: string; catalogoId: string | null; dias: number | null;
  preco: number | null; cidade: string; ano: string; aba: string; linha: number;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Form({ inicial, marcas, onFechar }: { inicial: ModeloCat | null; marcas: string[]; onFechar: () => void }) {
  const [state, onSubmit, pending] = useFormAction<CatState>(salvarModeloAction, {});
  const router = useRouter();
  const [tipo, setTipo] = useState(inicial?.tipo ?? "");
  const [cc, setCc] = useState(inicial?.cc ? String(inicial.cc) : "");
  const auto = segmentoPadrao(tipo, parseInt(cc, 10) || null);
  const [manual, setManual] = useState(!!inicial && inicial.segmento !== segmentoPadrao(inicial.tipo, inicial.cc));
  const [excluindo, startEx] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [erroEx, setErroEx] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  useEffect(() => { if (state.ok) { router.refresh(); onFechar(); } }, [state.ok, router, onFechar]);

  return (
    <form ref={ref} onSubmit={onSubmit} className="sec cat-form">
      <div className="sec-head"><h2 className="sec-title">{inicial ? "Editar modelo" : "Novo modelo"}</h2><button type="button" className="link-btn" onClick={onFechar}>Fechar</button></div>
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <fieldset disabled={pending || excluindo} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <div className="field"><label htmlFor="c-marca">Marca</label><input id="c-marca" name="marca" className="input" list="c-marcas" defaultValue={inicial?.marca} required />
            <datalist id="c-marcas">{marcas.map((m) => <option key={m} value={m} />)}</datalist></div>
          <div className="field span-2"><label htmlFor="c-modelo">Modelo</label><input id="c-modelo" name="modelo" className="input" defaultValue={inicial?.modelo} required /></div>
          <div className="field">
            <label htmlFor="c-tipo">Tipo</label>
            <select id="c-tipo" name="tipo" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)} required>
              <option value="">Escolha…</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="c-cc">Cilindrada (cc)</label><input id="c-cc" name="cc" className="input" inputMode="numeric" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
          <div className="field"><label htmlFor="c-ai">Ano início</label><input id="c-ai" name="anoIni" className="input" inputMode="numeric" defaultValue={inicial?.anoIni ?? ""} placeholder="2020" /></div>
          <div className="field"><label htmlFor="c-af">Ano fim</label><input id="c-af" name="anoFim" className="input" inputMode="numeric" defaultValue={inicial?.anoFim ?? ""} placeholder="vazio = atual" /></div>
          <div className="field span-2">
            <label htmlFor="c-seg">Segmento de equivalência</label>
            {manual ? (
              <input id="c-seg" name="segmento" className="input" defaultValue={inicial?.segmento || auto} />
            ) : (
              <div className="input seg-auto">{auto || "defina tipo e cilindrada"}</div>
            )}
            <label className="check small"><input type="checkbox" name="segmentoManual" checked={manual} onChange={(e) => setManual(e.target.checked)} /> definir manualmente</label>
          </div>
          <div className="field wide"><label htmlFor="c-ap">Apelidos / códigos (separados por vírgula)</label><input id="c-ap" name="apelidos" className="input" defaultValue={inicial?.apelidos.join(", ")} placeholder="Ex.: FXBB, CB300F, FAZER 250" /></div>
        </div>
      </fieldset>
      {(state.erro || erroEx) && <div className="alert bad" style={{ marginTop: 12 }}>{state.erro || erroEx}</div>}
      <div className="cat-form-actions">
        {inicial && (confirmar ? (
          <button type="button" className="btn small danger" disabled={excluindo}
            onClick={() => startEx(async () => { const r = await excluirModeloAction(inicial.id); if (r.erro) setErroEx(r.erro); else { router.refresh(); onFechar(); } })}>
            {excluindo ? "Excluindo…" : "Confirmar exclusão"}
          </button>
        ) : <button type="button" className="btn small ghost" onClick={() => setConfirmar(true)}>Excluir</button>)}
        <button type="submit" className="btn" disabled={pending} style={{ marginLeft: "auto" }}>{pending ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}

export function CatalogoView({ modelos, fonte, estoque, aba }: { modelos: ModeloCat[]; fonte: "planilha" | "base"; estoque: MotoEstoqueVM[]; aba: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [marca, setMarca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [form, setForm] = useState<{ item: ModeloCat | null } | null>(null);
  const [limite, setLimite] = useState(60);
  const [gravando, startGravar] = useTransition();
  const [erro, setErro] = useState("");
  const marcas = useMemo(() => listaMarcas(modelos), [modelos]);

  const porModelo = useMemo(() => {
    const m = new Map<string, MotoEstoqueVM[]>();
    for (const e of estoque) if (e.catalogoId) m.set(e.catalogoId, [...(m.get(e.catalogoId) ?? []), e]);
    return m;
  }, [estoque]);
  const porSegmento = useMemo(() => {
    const m = new Map<string, MotoEstoqueVM[]>();
    for (const e of estoque) if (e.segmento) m.set(e.segmento, [...(m.get(e.segmento) ?? []), e]);
    return m;
  }, [estoque]);
  const semCatalogo = estoque.filter((e) => !e.catalogoId);

  const lista = useMemo(() => {
    const base = q.trim() ? buscar(modelos, q, marca, 500) : [...modelos].sort((a, b) => a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo));
    return base.filter((m) => (!tipo || m.tipo === tipo) && (!marca || m.marca === marca || !!q.trim()));
  }, [modelos, q, tipo, marca]);

  return (
    <>
      {fonte === "base" && (
        <div className="alert cat-base">
          <div><strong>Catálogo base ({modelos.length} modelos)</strong> montado a partir de pesquisa. Para editar ou acrescentar, ele é salvo na aba “{aba}” da planilha de estoque.</div>
          <button type="button" className="btn small" disabled={gravando}
            onClick={() => startGravar(async () => { const r = await gravarBaseAction(); if (r.erro) setErro(r.erro); else router.refresh(); })}>
            {gravando ? "Salvando…" : "Salvar na planilha"}
          </button>
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}

      <div className="search-row">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input className="input" placeholder="Buscar modelo: CB 300, Fazer, GS, Street Glide…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar modelo" />
          {q && <button type="button" className="search-clear" onClick={() => setQ("")} aria-label="Limpar">×</button>}
        </div>
        <select className="input sort-select" value={marca} onChange={(e) => setMarca(e.target.value)} aria-label="Marca">
          <option value="">Todas as marcas</option>{marcas.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => setForm({ item: null })}>+ Modelo</button>
      </div>
      <div className="chips scroll" style={{ marginBottom: 14 }}>
        <button type="button" className="chip" aria-pressed={!tipo} onClick={() => setTipo("")}>Todos</button>
        {TIPOS.map((t) => <button key={t} type="button" className="chip" aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? "" : t)}>{t}</button>)}
      </div>

      {form && <Form key={form.item?.id ?? "novo"} inicial={form.item} marcas={marcas} onFechar={() => setForm(null)} />}

      {semCatalogo.length > 0 && !q && (
        <details className="cat-warn">
          <summary>{semCatalogo.length} moto(s) do estoque sem modelo identificado no catálogo</summary>
          <ul>{semCatalogo.slice(0, 30).map((e) => <li key={e.placa + e.linha}><span className="plate">{e.placa}</span> {e.modelo}</li>)}</ul>
          <p className="faint">Cadastre o modelo (ou um apelido) para que essas motos entrem nas equivalências.</p>
        </details>
      )}

      <ul className="cat-list">
        {lista.slice(0, limite).map((m) => {
          const noEstoque = porModelo.get(m.id) ?? [];
          const segEstoque = (porSegmento.get(m.segmento) ?? []).filter((e) => e.catalogoId !== m.id);
          const isOpen = aberto === m.id;
          const eq = isOpen ? equivalentes(modelos, m) : [];
          return (
            <li key={m.id} className={`cat-item ${isOpen ? "open" : ""}`}>
              <button type="button" className="cat-row" onClick={() => setAberto(isOpen ? null : m.id)} aria-expanded={isOpen}>
                <span className="cat-main">
                  <span className="cat-marca">{m.marca}</span>
                  <strong className="cat-modelo">{m.modelo}</strong>
                  <span className="cat-meta">{[m.cc && `${m.cc} cc`, anosTexto(m)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="cat-tags">
                  <span className="badge">{m.tipo}</span>
                  {noEstoque.length > 0 && <span className="badge ok">{noEstoque.length} no estoque</span>}
                  {segEstoque.length > 0 && <span className="badge accent">{segEstoque.length} equivalente{segEstoque.length > 1 ? "s" : ""} no estoque</span>}
                </span>
              </button>
              {isOpen && (
                <div className="cat-detail">
                  <div className="cat-seg"><span className="filter-label">Segmento</span> <strong>{m.segmento || "—"}</strong>{m.apelidos.length > 0 && <span className="faint"> · apelidos: {m.apelidos.join(", ")}</span>}</div>
                  {(noEstoque.length > 0 || segEstoque.length > 0) && (
                    <div className="cat-block">
                      <span className="filter-label">No estoque agora</span>
                      <ul className="simple-list">
                        {[...noEstoque, ...segEstoque].map((e) => (
                          <li key={e.aba + e.linha}>
                            <Link className="simple-row" href={`/estoque/moto?${new URLSearchParams({ aba: e.aba, linha: String(e.linha) })}`}>
                              <span className="plate">{e.placa}</span>
                              <span className="simple-main">{e.modelo}<small>{[e.fabricante, e.ano, e.cidade, e.dias != null ? `${e.dias}d` : ""].filter(Boolean).join(" · ")}</small></span>
                              <span className="simple-side strong">{e.preco != null ? brl.format(e.preco) : ""}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="cat-block">
                    <span className="filter-label">Equivalentes de outras marcas ({eq.filter((x) => x.marca !== m.marca).length})</span>
                    <div className="chips">
                      {eq.length === 0 && <span className="faint">Nenhum modelo no mesmo segmento.</span>}
                      {eq.sort((a, b) => a.marca.localeCompare(b.marca)).map((x) => (
                        <button key={x.id} type="button" className={`chip ${x.marca === m.marca ? "" : "eq"}`} onClick={() => setAberto(x.id)}>{x.marca} {x.modelo}</button>
                      ))}
                    </div>
                  </div>
                  <div className="cat-form-actions"><button type="button" className="btn small ghost" onClick={() => setForm({ item: m })}>Editar modelo</button></div>
                </div>
              )}
            </li>
          );
        })}
        {lista.length === 0 && <li className="empty">Nenhum modelo encontrado. <button type="button" className="link-btn" onClick={() => setForm({ item: null })}>Cadastrar</button></li>}
      </ul>
      {lista.length > limite && <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setLimite((l) => l + 100)}>Mostrar mais ({lista.length - limite})</button>}
    </>
  );
}
