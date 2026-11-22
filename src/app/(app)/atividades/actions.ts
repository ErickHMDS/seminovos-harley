"use server";
import { criarAtividade, getAtividades, reabrirAtividade, resolverAtividade } from "@/lib/atividades";
import { motoPorPlaca } from "@/lib/estoque";
import { getLead } from "@/lib/leads";
import { getPreparacao } from "@/lib/preparacao";
import { exigirSessao } from "@/lib/sessao";

export type AtvState = { erro?: string; ok?: number; destino?: string };

const falha = (e: unknown): AtvState => ({ erro: `Não foi possível gravar: ${(e instanceof Error ? e.message : String(e)).slice(0, 180)}` });

/** Vendedor só mexe nas próprias tarefas; gestor em todas. */
async function podeMexer(id: string) {
  const s = await exigirSessao("/atividades");
  if (s.perfil === "gestor") return;
  const a = (await getAtividades()).find((x) => x.id === id);
  if (!a || a.responsavelId !== s.uid) throw new Error("Essa atividade não é sua.");
}

export async function resolver(id: string, nota: string): Promise<AtvState> {
  try { await podeMexer(id); await resolverAtividade(id, nota); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function reabrir(id: string): Promise<AtvState> {
  try { await podeMexer(id); await reabrirAtividade(id); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

/** Atividade rápida do gestor (linha da tela de Atividades). */
export async function nova(_: AtvState, form: FormData): Promise<AtvState> {
  const s = await exigirSessao("/atividades");
  const descricao = String(form.get("descricao") ?? "").trim();
  if (!descricao) return { erro: "Descreva a atividade." };
  try {
    await criarAtividade({ descricao, placa: String(form.get("placa") ?? ""), ...(s.perfil === "vendedor" ? { origem: "Vendedor", responsavelId: s.uid, responsavel: s.nome } : {}) });
    return { ok: Date.now() };
  } catch (e) { return falha(e); }
}

function isoParaBR(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Atividade completa: com vínculo opcional a uma moto (placa) ou a um lead. */
export async function lancarAtividade(_: AtvState, form: FormData): Promise<AtvState> {
  const s = await exigirSessao("/atividades");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const descricao = g("descricao");
  if (!descricao) return { erro: "Descreva a atividade." };
  const vinculo = g("vinculo");
  let placa = "", modelo = "", lead = "", cliente = "";
  try {
    if (vinculo === "moto") {
      placa = g("placa").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (placa.length < 7) return { erro: "Escolha a moto (placa)." };
      const m = await motoPorPlaca(placa).catch(() => null);
      const p = m ? null : (await getPreparacao().catch(() => ({ itens: [] }))).itens.find((x) => x.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === placa);
      if (!m && !p) return { erro: `Placa ${placa} não está no estoque nem na preparação.` };
      modelo = m?.modelo ?? p?.modelo ?? "";
    } else if (vinculo === "lead") {
      const l = await getLead(g("lead"), s);
      if (!l) return { erro: "Escolha o lead." };
      lead = l.id; cliente = l.cliente;
    }
    await criarAtividade({
      descricao, placa, modelo, lead, cliente, prazo: isoParaBR(g("prazo")),
      ...(s.perfil === "vendedor" ? { origem: "Vendedor", responsavelId: s.uid, responsavel: s.nome } : {}),
    });
  } catch (e) { return falha(e); }
  const volta = g("volta");
  const destino = volta.startsWith("/") && !volta.startsWith("//") ? volta : "/atividades";
  return { destino: `${destino}${destino.includes("?") ? "&" : "?"}salvo=atividade`, ok: Date.now() };
}
