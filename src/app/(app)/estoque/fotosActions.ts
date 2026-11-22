"use server";
import { adicionarFoto, definirCapa, importarDoDrive, removerFoto } from "@/lib/fotos";
import { exigirSessao } from "@/lib/sessao";

export type FotoState = { erro?: string; ok?: number; msg?: string };

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

export async function importarDriveAction(placa: string): Promise<FotoState> {
  try {
    const s = await editor();
    const r = await importarDoDrive(placa, null, s);
    if (!r.achadas) return { erro: `Nenhuma foto encontrada no Drive para ${placa}. Crie uma subpasta com a placa no nome dentro da pasta de fotos (ou cole o link da pasta abaixo).` };
    return { ok: Date.now(), msg: r.novas ? `${r.novas} foto(s) importada(s) do Drive${r.pastas.length ? ` (pasta “${r.pastas[0]}”)` : ""}.` : "As fotos do Drive já estavam importadas." };
  } catch (e) { return falha(e); }
}
