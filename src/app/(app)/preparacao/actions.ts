"use server";
import { podeEditarPreparacao } from "@/lib/auth";
import { sincronizarInspecao } from "@/lib/atividades";
import { CHECKLIST, gravarItem, type EstadoItem } from "@/lib/checklist";
import { config } from "@/lib/config";
import { atualizarStatusPorPlaca, motoPorPlaca, salvarMoto } from "@/lib/estoque";
import { rotuloAba } from "@/lib/lojas";
import { ETAPAS, atualizar, criar, excluir, getItem, hojeBR, proximaEtapa, type Campo } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";

export type SalvarState = { erro?: string; destino?: string; n?: number };

const DATAS: Campo[] = ["dataSaida", "prazoEntrega", "dataRecepcao", "dataRetorno", "dataFinalizacao"];
const CHECKS: Campo[] = ["fotoPreparacao", "postadoRedes"];
const TEXTO: Campo[] = ["modelo", "marca", "tipo", "placa", "chassi", "cor", "servicos", "fornecedor", "observacoes", "loja", "ano", "km", "responsavel", "ultimaRevisao", "fotosOficiais"];

/** "2026-11-21" -> "21/11/2026" */
function isoParaBR(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function lerFormulario(form: FormData): Partial<Record<Campo, string>> {
  const d: Partial<Record<Campo, string>> = {};
  const has = (c: string) => form.has(c) || form.has(`__${c}`);
  for (const c of TEXTO) if (form.has(c)) d[c] = String(form.get(c) ?? "").trim();
  if (d.placa) d.placa = d.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (d.modelo) d.modelo = d.modelo.toUpperCase();
  for (const c of DATAS) if (form.has(c)) d[c] = isoParaBR(String(form.get(c) ?? "").trim());
  // checkboxes: o campo oculto "__nome" indica que o checkbox estava na tela
  for (const c of CHECKS) if (has(c)) d[c] = form.get(c) ? "SIM" : "";
  // checklist 360
  for (const def of CHECKLIST) {
    if (!form.has(`ck_${def.campo}`)) continue;
    const estado = (String(form.get(`ck_${def.campo}`)) || "vazio") as EstadoItem;
    d[def.campo as Campo] = gravarItem(def, estado, String(form.get(`ckobs_${def.campo}`) ?? ""));
  }
  return d;
}

function erroPlanilha(e: unknown): SalvarState {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
  return { erro: `Não foi possível gravar na planilha: ${msg.slice(0, 200)}` };
}

export async function salvarPreparacao(_: SalvarState, form: FormData): Promise<SalvarState> {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) return { erro: "Seu perfil só pode visualizar a preparação." };

  const id = String(form.get("id") ?? "");
  const acao = String(form.get("acao") || "salvar");
  const anterior = id ? await getItem(id) : null;
  if (id && !anterior) return { erro: "Esta moto não foi encontrada na planilha (ela pode ter sido apagada)." };

  const dados = lerFormulario(form);
  if (!id && (!dados.placa || !dados.modelo)) return { erro: "Informe a placa e o modelo." };
  if (!id && !dados.loja) return { erro: "Escolha a loja." };

  let novoId: string;
  let estoque = "";
  try {
    if (!id) {
      novoId = await criar(dados);
      // o preparador coloca a moto no estoque ao receber (se a placa ainda não estiver lá)
      try {
        if (!(await motoPorPlaca(dados.placa!))) {
          const aba = config.estoqueAbas.find((a) => rotuloAba(a) === dados.loja) ?? config.estoqueAbas[0];
          await salvarMoto(aba, null, null, {
            empresa: String(form.get("empresa") ?? ""), placa: dados.placa!, modelo: dados.modelo!, km: dados.km ?? "", ano: dados.ano ?? "",
            cor: dados.cor ?? "", dataEntrada: dados.dataRecepcao || hojeBR(), custo: "", ultimoValorVenda: "", fipe: "", realinhamento: "",
            status: "EM PREPARAÇÃO", observacao: "", fabricante: dados.marca ?? "", tipo: dados.tipo ?? "",
          });
          estoque = "ok";
        } else estoque = "existente";
      } catch (e) {
        console.error("Falha ao incluir no estoque", e);
        estoque = "erro";
      }
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
        // finalizada e postada nas redes -> anunciada no estoque
        if (prox === "FINALIZADA" && merged.postadoRedes && merged.placa) {
          try { if (await atualizarStatusPorPlaca(merged.placa, "ANUNCIADO")) estoque = "anunciado"; } catch (e) { console.error(e); }
        }
      } else if (acao === "voltar") {
        const i = ETAPAS.findIndex((e) => e.id === anterior!.etapa);
        if (i > 0) dados.etapa = ETAPAS[i - 1].id;
      }
      novoId = await atualizar(id, dados);
    }
  } catch (e) {
    return erroPlanilha(e);
  }

  // pendências do checklist viram atividades do gestor
  if (CHECKLIST.some((def) => dados[def.campo as Campo] !== undefined)) {
    try {
      const base: Record<string, string> = {};
      if (anterior) for (const [k, v] of Object.entries(anterior)) if (typeof v === "string") base[k] = v;
      await sincronizarInspecao({ ...base, ...dados, id: novoId });
    } catch (e) {
      console.error("Falha ao sincronizar atividades", e);
    }
  }
  const salvo = !id ? "registrar" : acao;
  return { destino: `/preparacao/${encodeURIComponent(novoId)}?salvo=${salvo}${estoque ? `&estoque=${estoque}` : ""}`, n: Date.now() };
}

export async function marcarEmailEnviado(id: string, enviado: boolean): Promise<SalvarState> {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) return { erro: "Seu perfil só pode visualizar a preparação." };
  try {
    const novoId = await atualizar(id, { emailEnviado: enviado ? hojeBR() : "" });
    return { destino: `/preparacao/${encodeURIComponent(novoId)}`, n: Date.now() };
  } catch (e) {
    return erroPlanilha(e);
  }
}

/**
 * Moto antiga (já no estoque, sem registro de preparação): cria a preparação já FINALIZADA,
 * com os dados do estoque preenchidos, para o preparador completar o checklist 360, chave, manual e fotos.
 */
export async function criarPreparacaoDoEstoque(placa: string): Promise<SalvarState> {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) return { erro: "Só gestor e preparador podem criar a preparação." };
  const m = await motoPorPlaca(placa);
  if (!m) return { erro: "Moto não encontrada no estoque." };
  const { getPreparacao } = await import("@/lib/preparacao");
  const existente = (await getPreparacao()).itens.filter((p) => p.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === m.placa).pop();
  if (existente) return { destino: `/preparacao/${encodeURIComponent(existente.id)}`, n: Date.now() };
  const { fotosDaPlaca } = await import("@/lib/fotos");
  const fotos = (await fotosDaPlaca(m.placa).catch(() => [])).length;
  const br = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "");
  const anunciada = m.anunciada;
  try {
    const id = await criar({
      modelo: m.modelo.toUpperCase(), placa: m.placa, cor: m.cor, ano: m.ano, km: m.km != null ? String(m.km) : "",
      marca: m.fabricante ?? "", tipo: m.tipo ?? "", loja: rotuloAba(m.aba), dataRecepcao: br(m.dataEntrada), dataFinalizacao: hojeBR(),
      fotoPreparacao: "SIM", postadoRedes: anunciada ? "SIM" : "", fotosOficiais: fotos ? String(fotos) : "",
      observacoes: "Preparação registrada depois (moto já estava no estoque).",
    }, "FINALIZADA");
    return { destino: `/preparacao/${encodeURIComponent(id)}?salvo=retroativa`, n: Date.now() };
  } catch (e) {
    return erroPlanilha(e);
  }
}

/** Gestor exclui uma preparação (ex.: lançada por engano). Não mexe no estoque nem nas fotos. */
export async function excluirPreparacao(id: string): Promise<SalvarState> {
  const perfil = await exigirPerfil("/preparacao");
  if (perfil !== "gestor") return { erro: "Só o gestor pode excluir uma preparação." };
  try {
    await excluir(id);
    // pendências abertas da inspeção dessa moto deixam de fazer sentido
    const { getAtividades, resolverAtividade } = await import("@/lib/atividades");
    for (const a of (await getAtividades()).filter((x) => x.ref === id && x.aberta)) await resolverAtividade(a.id, "Preparação excluída pelo gestor");
  } catch (e) {
    return erroPlanilha(e);
  }
  return { destino: "/preparacao?salvo=excluida", n: Date.now() };
}
