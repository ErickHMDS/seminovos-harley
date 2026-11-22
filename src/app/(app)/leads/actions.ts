"use server";
import { concluirCobranca } from "@/lib/cobrancas";
import { registrarContato, registrarSyonet, salvarLead, type LeadInput } from "@/lib/leads";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";

export type LeadState = { erro?: string; destino?: string; n?: number; ok?: number };

const falha = (e: unknown): LeadState => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
  return { erro: msg.startsWith("Google Sheets API") ? `Não foi possível gravar: ${msg.slice(0, 180)}` : msg };
};

function isoParaBR(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export async function salvarLeadAction(_: LeadState, form: FormData): Promise<LeadState> {
  const s = await exigirSessao("/leads");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const d: LeadInput = {
    cliente: g("cliente"), telefone: g("telefone"), email: g("email"), syonet: g("syonet"), marca: g("marca"), modelo: g("modelo"), tipo: g("tipo") || g("tipoLivre"),
    anoMin: g("anoMin"), valorMax: g("valorMax"), aceitaEquivalente: form.get("aceitaEquivalente") === "on", pagamento: g("pagamento"),
    usado: g("usado"), status: g("status") || "NOVO", proximoContato: isoParaBR(g("proximoContato")), observacoes: g("observacoes"),
  };
  if (!d.cliente) return { erro: "Informe o nome do cliente." };
  if (!d.telefone) return { erro: "Informe o telefone (para ligar quando a moto chegar)." };
  if (!d.modelo && !d.tipo) return { erro: "Informe a moto desejada (modelo) ou pelo menos o tipo." };
  if (s.perfil === "gestor" && g("vendedorId")) {
    const u = (await getUsuarios()).find((x) => x.id === g("vendedorId"));
    if (u) { d.vendedorId = u.id; d.vendedor = u.nome; }
  }
  try {
    const id = await salvarLead(g("id") || null, d, s);
    return { destino: `/leads/${id}?salvo=${g("id") ? "1" : "novo"}`, n: Date.now() };
  } catch (e) { return falha(e); }
}

export async function contatoAction(id: string, nota: string, placa: string, proximo: string): Promise<LeadState> {
  const s = await exigirSessao("/leads");
  try { await registrarContato(id, s, nota, placa, isoParaBR(proximo)); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function syonetAction(id: string, valor: string): Promise<LeadState> {
  const s = await exigirSessao("/leads");
  try { await registrarSyonet(id, s, valor); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function cobreiAction(vendedorId: string): Promise<LeadState> {
  const s = await exigirSessao("/atividades");
  if (s.perfil !== "gestor") return { erro: "Só o gestor conclui cobranças." };
  try { await concluirCobranca(vendedorId, s); return { ok: Date.now() }; } catch (e) { return falha(e); }
}
