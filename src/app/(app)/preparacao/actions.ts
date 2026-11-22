"use server";
import { podeEditarPreparacao } from "@/lib/auth";
import { ETAPAS, atualizar, criar, getItem, hojeBR, proximaEtapa, type Campo } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";

export type SalvarState = { erro?: string; destino?: string; n?: number };

const DATAS: Campo[] = ["dataSaida", "prazoEntrega", "dataRecepcao", "ultimaRevisao", "dataRetorno", "dataFinalizacao"];
const SIM_NAO: Campo[] = ["manual", "chaveReserva"];
const CHECKS: Campo[] = ["fotoPreparacao", "postadoRedes"];
const TEXTO: Campo[] = ["modelo", "placa", "chassi", "cor", "servicos", "fornecedor", "observacoes", "loja", "ano", "km", "responsavel", "riscos", "sujeira", "estetica", "fotosOficiais"];

/** "2026-11-21" -> "21/11/2026" */
function isoParaBR(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function lerFormulario(form: FormData, anterior: { emailEnviado?: string } | null): Partial<Record<Campo, string>> {
  const d: Partial<Record<Campo, string>> = {};
  const has = (c: string) => form.has(c) || form.has(`__${c}`);
  for (const c of TEXTO) if (form.has(c)) d[c] = String(form.get(c) ?? "").trim();
  if (d.placa) d.placa = d.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (d.modelo) d.modelo = d.modelo.toUpperCase();
  for (const c of DATAS) if (form.has(c)) d[c] = isoParaBR(String(form.get(c) ?? "").trim());
  for (const c of SIM_NAO) if (form.has(c)) d[c] = String(form.get(c));
  // checkboxes: o campo oculto "__nome" indica que o checkbox estava na tela
  for (const c of CHECKS) if (has(c)) d[c] = form.get(c) ? "SIM" : "";
  if (has("emailEnviado")) d.emailEnviado = form.get("emailEnviado") ? anterior?.emailEnviado || hojeBR() : "";
  return d;
}

export async function salvarPreparacao(_: SalvarState, form: FormData): Promise<SalvarState> {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) return { erro: "Seu perfil só pode visualizar a preparação." };

  const id = String(form.get("id") ?? "");
  const acao = String(form.get("acao") || "salvar");
  const anterior = id ? await getItem(id) : null;
  if (id && !anterior) return { erro: "Esta moto não foi encontrada na planilha (ela pode ter sido apagada)." };

  const dados = lerFormulario(form, anterior);
  if (!id && !dados.placa && !dados.modelo) return { erro: "Informe pelo menos a placa ou o modelo." };

  let novoId: string;
  try {
    if (!id) {
      novoId = await criar(dados);
    } else {
      if (acao === "avancar") {
        const prox = proximaEtapa(anterior!.etapa);
        if (!prox) return { erro: "Esta moto já está finalizada." };
        const merged = { ...anterior!, ...dados };
        if (prox === "FORNECEDOR" && !merged.fornecedor) return { erro: "Informe o fornecedor antes de enviar a moto." };
        if (prox === "FORNECEDOR" && !merged.dataSaida) dados.dataSaida = hojeBR();
        if (prox === "FOTOS" && !merged.dataRetorno) dados.dataRetorno = hojeBR();
        if (prox === "FINALIZADA") dados.dataFinalizacao = merged.dataFinalizacao || hojeBR();
        dados.etapa = prox;
      } else if (acao === "voltar") {
        const i = ETAPAS.findIndex((e) => e.id === anterior!.etapa);
        if (i > 0) dados.etapa = ETAPAS[i - 1].id;
      }
      novoId = await atualizar(id, dados);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
    return { erro: `Não foi possível gravar na planilha: ${msg.slice(0, 200)}` };
  }
  // a navegação é feita pelo formulário (redirect dentro da action travava a 1ª gravação em alguns casos)
  return { destino: `/preparacao/${encodeURIComponent(novoId)}?salvo=${acao}`, n: Date.now() };
}
