"use server";
import { exigirPerfil, exigirSessao } from "@/lib/sessao";
import { editarVenda, excluirVenda, lancarVenda, type VendaInput } from "@/lib/vendas";
import { date, monthKey } from "@/lib/parse";

export type VendaState = { erro?: string; destino?: string; n?: number };

function isoParaBR(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function ler(form: FormData): VendaInput {
  const g = (k: string) => String(form.get(k) ?? "").trim();
  return {
    data: isoParaBR(g("data")), vendedor: g("vendedor"), pedido: g("pedido"), loja: g("loja"), situacao: g("situacao"),
    cliente: g("cliente"), veiculo: g("veiculo"), placa: g("placa").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ge: form.get("ge") === "on", fin: form.get("fin") === "on", usado: form.get("usado") === "on",
    seguro: g("seguro"), prevFaturamento: g("prevFaturamento"), observacoes: g("observacoes"),
  };
}

const falha = (e: unknown): VendaState => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de vendas." };
  return { erro: msg.startsWith("Google Sheets API") ? `Não foi possível gravar: ${msg.slice(0, 180)}` : msg };
};

export async function salvarVenda(_: VendaState, form: FormData): Promise<VendaState> {
  const sess = await exigirSessao("/vendas");
  const v = ler(form);
  // vendedor lança e edita só as próprias vendas
  const proprio = sess.perfil === "vendedor" ? sess.vendedor : null;
  if (proprio) {
    v.vendedor = proprio;
    if (form.get("aba") && String(form.get("orig_vendedor")) !== proprio) return { erro: "Você só pode editar as suas vendas." };
  }
  if (!date(v.data)) return { erro: "Informe a data da venda." };
  if (!v.vendedor) return { erro: "Escolha o vendedor." };
  if (!v.veiculo) return { erro: "Informe o veículo." };
  if (!v.situacao) return { erro: "Escolha a situação." };
  const aba = String(form.get("aba") ?? "");
  const linha = Number(form.get("linha") ?? 0);
  try {
    if (aba && linha) {
      await editarVenda(aba, linha, { vendedor: String(form.get("orig_vendedor")), veiculo: String(form.get("orig_veiculo")), pedido: String(form.get("orig_pedido")) }, v);
    } else {
      await lancarVenda(v);
    }
  } catch (e) {
    return falha(e);
  }
  const salvo = aba ? "editada" : "lancada";
  return { destino: sess.perfil === "vendedor" ? `/meta?salvo=${salvo}` : `/ranking?mes=${monthKey(date(v.data)!)}&salvo=${salvo}`, n: Date.now() };
}

export async function apagarVenda(aba: string, linha: number, original: { vendedor: string; veiculo: string; pedido: string }, mes: string): Promise<VendaState> {
  const perfil = await exigirPerfil("/vendas");
  if (perfil !== "gestor") return { erro: "Só o gestor pode excluir lançamentos." };
  try { await excluirVenda(aba, linha, original); } catch (e) { return falha(e); }
  return { destino: `/ranking?mes=${mes}&salvo=excluida`, n: Date.now() };
}
