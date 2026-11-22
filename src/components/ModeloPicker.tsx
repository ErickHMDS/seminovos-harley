"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buscar, compacto, marcas as listaMarcas, type ModeloCat } from "@/lib/motos";

/**
 * Marca + Modelo com sugestões do catálogo.
 * Ao escolher um modelo de outra montadora, a marca é corrigida automaticamente.
 * Envia no formulário: marca, modelo e tipo (campos ocultos/visíveis com esses nomes).
 */
export function ModeloPicker({ catalogo, marcaInicial = "", modeloInicial = "", tipoInicial = "", obrigatorio = false, onEscolher }: {
  catalogo: ModeloCat[]; marcaInicial?: string; modeloInicial?: string; tipoInicial?: string; obrigatorio?: boolean;
  onEscolher?: (m: ModeloCat | null) => void;
}) {
  const marcas = useMemo(() => listaMarcas(catalogo), [catalogo]);
  const [marca, setMarca] = useState(marcaInicial);
  const [modelo, setModelo] = useState(modeloInicial);
  const [tipo, setTipo] = useState(tipoInicial);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [aviso, setAviso] = useState("");
  const [escolhido, setEscolhido] = useState<ModeloCat | null>(null);
  const lid = useId();
  const caixa = useRef<HTMLDivElement>(null);

  const sugestoes = useMemo(() => (aberto ? buscar(catalogo, modelo, marca, 8) : []), [catalogo, modelo, marca, aberto]);
  useEffect(() => setAtivo(0), [modelo, marca]);
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function escolher(m: ModeloCat) {
    if (marca && compacto(marca) !== compacto(m.marca)) setAviso(`Marca ajustada de ${marca} para ${m.marca}`);
    else setAviso("");
    setMarca(m.marca);
    setModelo(m.modelo);
    setTipo(m.tipo);
    setEscolhido(m);
    setAberto(false);
    onEscolher?.(m);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!sugestoes.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setAtivo((a) => Math.min(a + 1, sugestoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && aberto) { e.preventDefault(); escolher(sugestoes[ativo]); }
    else if (e.key === "Escape") setAberto(false);
  }

  const foraDoCatalogo = modelo.trim().length > 2 && !escolhido && !aberto && !catalogo.some((c) => compacto(c.modelo) === compacto(modelo));

  return (
    <div className="modelo-picker" ref={caixa}>
      <div className="field">
        <label htmlFor={`${lid}-marca`}>Marca</label>
        <input id={`${lid}-marca`} name="marca" className="input" list={`${lid}-marcas`} value={marca} autoComplete="off" placeholder="Ex.: Yamaha"
          onChange={(e) => { setMarca(e.target.value); setAviso(""); }} />
        <datalist id={`${lid}-marcas`}>{marcas.map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <div className="field span-2 combo">
        <label htmlFor={`${lid}-modelo`}>Modelo</label>
        <input id={`${lid}-modelo`} name="modelo" className="input" value={modelo} autoComplete="off" required={obrigatorio}
          placeholder={marca ? `Comece a digitar um modelo ${marca}…` : "Comece a digitar: CB 300, Fazer, GS…"}
          role="combobox" aria-expanded={aberto && sugestoes.length > 0} aria-controls={`${lid}-lista`} aria-autocomplete="list"
          onFocus={() => setAberto(true)} onKeyDown={onKey}
          onChange={(e) => { setModelo(e.target.value); setEscolhido(null); setTipo(""); setAberto(true); onEscolher?.(null); }} />
        {aberto && sugestoes.length > 0 && (
          <ul className="combo-list" id={`${lid}-lista`} role="listbox">
            {sugestoes.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === ativo} className={i === ativo ? "on" : ""}
                onMouseDown={(e) => { e.preventDefault(); escolher(m); }} onMouseEnter={() => setAtivo(i)}>
                <span className="combo-marca">{m.marca}</span>
                <span className="combo-modelo">{m.modelo}</span>
                <span className="combo-meta">{m.tipo}{m.cc ? ` · ${m.cc} cc` : ""}</span>
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" name="tipo" value={tipo} />
        {aviso && <span className="combo-aviso">↻ {aviso}</span>}
        {!aviso && escolhido && <span className="combo-ok">✓ {escolhido.tipo}{escolhido.cc ? ` · ${escolhido.cc} cc` : ""} · {escolhido.segmento}</span>}
        {foraDoCatalogo && <span className="combo-hint">Modelo fora do catálogo — o gestor pode cadastrá-lo.</span>}
      </div>
    </div>
  );
}
