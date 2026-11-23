"use server";
import {
  PERIODOS, STATUS, criarAtividade, editarAtividade, escreverPrazo, excluirAtividade, getAtividades, mudarStatus, podeExcluir, podeMexer,
  type StatusAtv,
} from "@/lib/atividades";
import { motoPorPlaca } from "@/lib/estoque";
import { getLead } from "@/lib/leads";
import { getPreparacao } from "@/lib/preparacao";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";

export type AtvState = { erro?: string; ok?: number; destino?: string; msg?: string };

const falha = (e: unknown): AtvState => ({ erro: `Não foi possível gravar: ${(e instanceof Error ? e.message : String(e)).slice(0, 180)}` });

async function daSessao(id: string) {
  const s = await exigirSessao("/atividades");
  const a = (await getAtividades()).find((x) => x.id === id);
  if (!a) throw new Error("Atividade não encontrada.");
  if (!podeMexer(a, s)) throw new Error("Essa atividade não é sua.");
  return { s, a };
}

export async function mudarStatusAction(id: string, status: string): Promise<AtvState> {
  try {
    if (!STATUS.includes(status as StatusAtv)) throw new Error("Status inválido.");
    await daSessao(id);
    const r = await mudarStatus(id, status as StatusAtv);
    return { ok: Date.now(), msg: r.proxima ? `Próxima criada para ${r.proxima}.` : undefined };
  } catch (e) { return falha(e); }
}

export async function excluirAction(id: string): Promise<AtvState> {
  try {
    const { s, a } = await daSessao(id);
    if (!podeExcluir(a, s)) throw new Error("Só o gestor ou quem criou pode excluir.");
    await excluirAtividade(id);
    return { ok: Date.now(), destino: "/atividades?salvo=excluida" };
  } catch (e) { return falha(e); }
}

// compatibilidade com telas que ainda chamam "resolver"/"reabrir"
export async function resolver(id: string, _nota: string): Promise<AtvState> { return mudarStatusAction(id, "FINALIZADO"); }
export async function reabrir(id: string): Promise<AtvState> { return mudarStatusAction(id, "A FAZER"); }

/** Cria ou edita (campo "id") uma atividade completa. */
export async function salvarAtividade(_: AtvState, form: FormData): Promise<AtvState> {
  const s = await exigirSessao("/atividades");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const id = g("id");
  const descricao = g("descricao");
  if (!descricao) return { erro: "Descreva a atividade." };
  const prazo = escreverPrazo(g("data"), g("hora"));
  if (g("hora") && !prazo) return { erro: "Para colocar hora, escolha também a data." };
  const periodicidade = g("periodicidade").toUpperCase();
  if (!PERIODOS.includes(periodicidade as (typeof PERIODOS)[number])) return { erro: "Periodicidade inválida." };
  if (periodicidade && !prazo) return { erro: "Atividade que se repete precisa de data." };

  // pessoas marcadas (somente usuários ativos)
  const usuarios = (await getUsuarios().catch(() => [])).filter((u) => u.ativo);
  const ids = form.getAll("pessoas").map(String);
  const pessoas = usuarios.filter((u) => ids.includes(u.id)).map((u) => ({ id: u.id, nome: u.nome }));
  if (s.perfil !== "gestor" && !pessoas.some((p) => p.id === s.uid) && !id) pessoas.unshift({ id: s.uid, nome: s.nome });

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
    const dados = {
      descricao, placa, modelo, lead, cliente, prazo, pessoas,
      prioridade: g("prioridade") === "URGENTE" ? "URGENTE" : "NORMAL", observacao: g("observacao"), periodicidade,
    };
    if (id) {
      await daSessao(id);
      await editarAtividade(id, dados);
      const novo = g("status");
      const atual = (await getAtividades()).find((x) => x.id === id);
      if (novo && atual && STATUS.includes(novo as StatusAtv) && atual.etapa !== novo) await mudarStatus(id, novo as StatusAtv);
    } else {
      await criarAtividade({ ...dados, origem: s.perfil === "gestor" ? "Gestor" : s.perfil === "vendedor" ? "Vendedor" : "Preparador", criadoPorId: s.uid, criadoPor: s.nome });
    }
  } catch (e) { return falha(e); }
  const volta = g("volta");
  const destino = volta.startsWith("/") && !volta.startsWith("//") ? volta : "/atividades";
  return { destino: `${destino}${destino.includes("?") ? "&" : "?"}salvo=${id ? "editada" : "atividade"}`, ok: Date.now() };
}

// nome antigo usado pelo formulário de "Lançar atividade"
export const lancarAtividade = salvarAtividade;
