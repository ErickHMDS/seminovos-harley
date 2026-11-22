"use client";
import { useState } from "react";

export function Compartilhar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="ficha-share">
      <a className="btn small ghost" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Enviar descrição (WhatsApp)</a>
      <button type="button" className="btn small ghost" onClick={async () => { await navigator.clipboard.writeText(texto).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 2000); }}>{ok ? "Copiado ✓" : "Copiar descrição"}</button>
    </div>
  );
}
