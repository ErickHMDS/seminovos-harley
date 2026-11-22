"use server";
import { adicionarFoto, definirCapa, removerFoto } from "@/lib/fotos";
import { exigirSessao } from "@/lib/sessao";

export type FotoState = { erro?: string; ok?: number };

async function editor() {
  const s = await exigirSessao("/estoque");
  if (s.perfil === "vendedor") throw new Error("Só gestor e preparador podem alterar as fotos.");
  return s;
}
const falha = (e: unknown): FotoState => ({ erro: (e instanceof Error ? e.message : String(e)).slice(0, 220) });

export async function enviarFotoAction(fd: FormData): Promise<FotoState> {
  try {
    const s = await editor();
    const placa = String(fd.get("placa") ?? "");
    const link = String(fd.get("link") ?? "").trim();
    const arquivo = fd.get("arquivo");
    await adicionarFoto(placa, link || (arquivo as File), s);
    return { ok: Date.now() };
  } catch (e) { return falha(e); }
}

export async function removerFotoAction(id: string): Promise<FotoState> {
  try { await editor(); await removerFoto(id); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function capaAction(id: string): Promise<FotoState> {
  try { await editor(); await definirCapa(id); return { ok: Date.now() }; } catch (e) { return falha(e); }
}
