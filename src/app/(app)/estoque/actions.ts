"use server";
import { removerMoto, salvarMoto, type MotoInput } from "@/lib/estoque";
import { exigirPerfil } from "@/lib/sessao";

export type MotoState = { erro?: string; destino?: string; n?: number };

function isoParaBR(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const falha = (e: unknown): MotoState => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
  return { erro: msg.startsWith("Google Sheets API") ? `Não foi possível gravar: ${msg.slice(0, 180)}` : msg };
};

export async function salvarMotoAction(_: MotoState, form: FormData): Promise<MotoState> {
  await exigirPerfil("/estoque/moto");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const m: MotoInput = {
    empresa: g("empresa"), placa: g("placa").toUpperCase().replace(/[^A-Z0-9]/g, ""), modelo: g("modelo"), km: g("km"), ano: g("ano"),
    cor: g("cor"), dataEntrada: isoParaBR(g("dataEntrada")), custo: g("custo"), ultimoValorVenda: g("ultimoValorVenda"), fipe: g("fipe"),
    realinhamento: g("realinhamento"), status: g("status"), observacao: g("observacao"),
  };
  const aba = g("aba");
  const linha = Number(g("linha")) || null;
  if (!aba) return { erro: "Escolha a loja." };
  if (!m.placa || !m.modelo) return { erro: "Informe placa e modelo." };
  try {
    await salvarMoto(aba, linha, linha ? g("placaOriginal") : null, m);
  } catch (e) {
    return falha(e);
  }
  return { destino: `/estoque?salvo=${linha ? "editada" : "nova"}&q=${m.placa}`, n: Date.now() };
}

export async function removerMotoAction(aba: string, linha: number, placa: string): Promise<MotoState> {
  await exigirPerfil("/estoque/moto");
  try { await removerMoto(aba, linha, placa); } catch (e) { return falha(e); }
  return { destino: "/estoque?salvo=removida", n: Date.now() };
}
