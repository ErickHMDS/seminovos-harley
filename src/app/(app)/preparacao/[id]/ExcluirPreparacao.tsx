"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirPreparacao } from "../actions";

/** Gestor: exclui a preparação (com confirmação). */
export function ExcluirPreparacao({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState("");
  return (
    <div className="excluir-prep">
      {!confirmar ? (
        <button type="button" className="link-btn perigo" onClick={() => setConfirmar(true)}>Excluir esta preparação</button>
      ) : (
        <div className="excluir-confirma">
          <span>Excluir a preparação de <b>{nome}</b>? A moto continua no estoque e as fotos continuam salvas.</span>
          <button type="button" className="btn small perigo" disabled={pending}
            onClick={() => start(async () => { const r = await excluirPreparacao(id); if (r.erro) setErro(r.erro); else if (r.destino) { router.replace(r.destino); router.refresh(); } })}>
            {pending ? "Excluindo…" : "Confirmar exclusão"}
          </button>
          <button type="button" className="btn small ghost" disabled={pending} onClick={() => setConfirmar(false)}>Cancelar</button>
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
    </div>
  );
}
