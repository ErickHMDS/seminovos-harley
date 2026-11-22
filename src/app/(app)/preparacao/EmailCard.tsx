"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarEmailEnviado } from "./actions";

export function EmailCard({ id, para, assunto, corpo, enviadoEm, editar, destaque }: {
  id: string; para: string; assunto: string; corpo: string; enviadoEm: string; editar: boolean; destaque: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");

  const mailto = `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  const whats = `https://wa.me/?text=${encodeURIComponent(`*${assunto}*\n\n${corpo}`)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${assunto}\n\n${corpo}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAberto(true);
    }
  }

  function marcar(enviado: boolean) {
    setErro("");
    start(async () => {
      const r = await marcarEmailEnviado(id, enviado);
      if (r.erro) setErro(r.erro);
      else if (r.destino) { router.replace(r.destino); router.refresh(); }
    });
  }

  return (
    <section className={`email-card ${destaque && !enviadoEm ? "destaque" : ""} ${enviadoEm ? "enviado" : ""}`}>
      <div className="email-head">
        <div className="email-icon" aria-hidden>✉</div>
        <div style={{ minWidth: 0 }}>
          <strong>{enviadoEm ? "E-mail enviado aos coordenadores" : "E-mail para os coordenadores pronto"}</strong>
          <div className="email-sub">{enviadoEm ? `Marcado como enviado em ${enviadoEm}` : para ? para.replace(/,/g, ", ") : "Destinatário não configurado (COORDENADOR_EMAIL)"}</div>
        </div>
      </div>
      <div className="email-actions">
        <a className="btn small" href={mailto}>Abrir e-mail</a>
        <a className="btn small ghost" href={whats} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button type="button" className="btn small ghost" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
        <button type="button" className="link-btn" onClick={() => setAberto((a) => !a)}>{aberto ? "Ocultar texto" : "Ver texto"}</button>
      </div>
      {aberto && <pre className="email-preview">{assunto}{"\n\n"}{corpo}</pre>}
      {editar && (
        <div className="email-foot">
          {enviadoEm ? (
            <button type="button" className="link-btn" onClick={() => marcar(false)} disabled={pending}>Desfazer “enviado”</button>
          ) : (
            <button type="button" className="btn small ghost" onClick={() => marcar(true)} disabled={pending}>{pending ? "Salvando…" : "✓ Já enviei"}</button>
          )}
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
    </section>
  );
}
