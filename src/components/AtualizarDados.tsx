"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { atualizarDados } from "@/app/actions";

/** Botão que relê a planilha na hora (sem esperar o cache de 60 s). */
export function AtualizarDados({ em }: { em?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hora = em ? new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
  return (
    <button type="button" className={`refresh ${pending ? "spin" : ""}`} disabled={pending}
      onClick={() => start(async () => { await atualizarDados(); router.refresh(); })}
      title="Reler a planilha agora">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
      </svg>
      <span>{pending ? "Atualizando…" : hora ? `Atualizado ${hora}` : "Atualizar"}</span>
    </button>
  );
}
