"use server";
import { criarAtividade, reabrirAtividade, resolverAtividade } from "@/lib/atividades";
import { exigirPerfil } from "@/lib/sessao";

export type AtvState = { erro?: string; ok?: number };

const falha = (e: unknown): AtvState => ({ erro: `Não foi possível gravar: ${(e instanceof Error ? e.message : String(e)).slice(0, 180)}` });

export async function resolver(id: string, nota: string): Promise<AtvState> {
  await exigirPerfil("/atividades");
  try { await resolverAtividade(id, nota); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function reabrir(id: string): Promise<AtvState> {
  await exigirPerfil("/atividades");
  try { await reabrirAtividade(id); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function nova(_: AtvState, form: FormData): Promise<AtvState> {
  await exigirPerfil("/atividades");
  const descricao = String(form.get("descricao") ?? "").trim();
  if (!descricao) return { erro: "Descreva a atividade." };
  try { await criarAtividade(descricao, String(form.get("placa") ?? "").trim()); return { ok: Date.now() }; } catch (e) { return falha(e); }
}
