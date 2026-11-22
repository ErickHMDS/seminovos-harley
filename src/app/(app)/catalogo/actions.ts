"use server";
import { excluirModelo, gravarBaseNaPlanilha, salvarModelo } from "@/lib/catalogo";
import { segmentoPadrao, TIPOS } from "@/lib/motos";
import { exigirPerfil } from "@/lib/sessao";

export type CatState = { erro?: string; ok?: number; id?: string };

const falha = (e: unknown): CatState => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
  return { erro: msg.startsWith("Google Sheets API") ? `Não foi possível gravar: ${msg.slice(0, 180)}` : msg };
};

const ano = (v: FormDataEntryValue | null) => { const n = parseInt(String(v ?? ""), 10); return n >= 1950 && n <= 2100 ? n : null; };

export async function salvarModeloAction(_: CatState, form: FormData): Promise<CatState> {
  await exigirPerfil("/catalogo");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const tipo = TIPOS.find((t) => t === g("tipo")) ?? "";
  const cc = parseInt(g("cc").replace(/\D/g, ""), 10) || null;
  if (!g("marca") || !g("modelo")) return { erro: "Informe marca e modelo." };
  if (!tipo) return { erro: "Escolha o tipo." };
  const segmento = form.get("segmentoManual") ? g("segmento") || segmentoPadrao(tipo, cc) : segmentoPadrao(tipo, cc);
  try {
    const id = await salvarModelo(g("id") || null, {
      marca: g("marca"), modelo: g("modelo"), tipo, cc, anoIni: ano(form.get("anoIni")), anoFim: ano(form.get("anoFim")), segmento,
      apelidos: g("apelidos").split(/[,;]/).map((s) => s.trim()).filter(Boolean),
    });
    return { ok: Date.now(), id };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirModeloAction(id: string): Promise<CatState> {
  await exigirPerfil("/catalogo");
  try { await excluirModelo(id); return { ok: Date.now() }; } catch (e) { return falha(e); }
}

export async function gravarBaseAction(): Promise<CatState> {
  await exigirPerfil("/catalogo");
  try { await gravarBaseNaPlanilha(); return { ok: Date.now() }; } catch (e) { return falha(e); }
}
