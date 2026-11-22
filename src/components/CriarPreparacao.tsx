"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarPreparacaoDoEstoque } from "@/app/(app)/preparacao/actions";

/** Moto antiga sem preparação: cria a preparação com os dados do estoque e abre para completar. */
export function CriarPreparacao({ placa }: { placa: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState("");
  return (
    <div className="criar-prep">
      <button type="button" className="btn small" disabled={pending}
        onClick={() => { setErro(""); start(async () => { const r = await criarPreparacaoDoEstoque(placa); if (r.erro) setErro(r.erro); else if (r.destino) router.push(r.destino); }); }}>
        {pending ? "Criando…" : "+ Criar preparação desta moto"}
      </button>
      <small className="faint">Para motos antigas: já vem com modelo, placa, ano, km e cor; você completa o checklist 360 e as fotos.</small>
      {erro && <div className="alert bad">{erro}</div>}
    </div>
  );
}
