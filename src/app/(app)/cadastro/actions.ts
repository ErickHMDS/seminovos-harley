"use server";
import { PERFIS, type Perfil } from "@/lib/auth";
import { salvarConfiguracao } from "@/lib/configuracoes";
import { exigirPerfil } from "@/lib/sessao";
import { atualizarUsuario, criarUsuario, gerarSenha, redefinirSenha } from "@/lib/usuarios";

export type CadState = { erro?: string; ok?: number; senha?: string; nome?: string; telefone?: string };

const falha = (e: unknown): CadState => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/403|PERMISSION_DENIED/.test(msg)) return { erro: "A conta de serviço não tem permissão de edição na planilha de estoque." };
  return { erro: msg.startsWith("Google Sheets API") ? `Não foi possível gravar: ${msg.slice(0, 180)}` : msg };
};

function ler(form: FormData) {
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const perfil = (g("perfil") in PERFIS ? g("perfil") : "vendedor") as Perfil;
  return { nome: g("nome"), perfil, vendedor: perfil === "vendedor" ? g("vendedor") : "", telefone: g("telefone").replace(/[^\d+]/g, "") };
}

export async function criarPessoa(_: CadState, form: FormData): Promise<CadState> {
  await exigirPerfil("/cadastro");
  const d = ler(form);
  const senha = String(form.get("senha") ?? "").trim();
  if (!d.nome) return { erro: "Informe o nome." };
  if (d.perfil === "vendedor" && !d.vendedor) return { erro: "Escolha o nome do vendedor como aparece na planilha de vendas (para ligar ranking e leads)." };
  try { await criarUsuario(d, senha); } catch (e) { return falha(e); }
  return { ok: Date.now(), senha, nome: d.nome, telefone: d.telefone };
}

export async function editarPessoa(_: CadState, form: FormData): Promise<CadState> {
  await exigirPerfil("/cadastro");
  const d = ler(form);
  if (!d.nome) return { erro: "Informe o nome." };
  try { await atualizarUsuario(String(form.get("id")), { ...d, ativo: form.get("ativo") === "on" }); } catch (e) { return falha(e); }
  return { ok: Date.now() };
}

export async function novaSenha(id: string, senha: string, nome: string, telefone: string): Promise<CadState> {
  await exigirPerfil("/cadastro");
  try { await redefinirSenha(id, senha); } catch (e) { return falha(e); }
  return { ok: Date.now(), senha, nome, telefone };
}

export async function sugerirSenha(): Promise<string> {
  await exigirPerfil("/cadastro");
  return gerarSenha();
}

export async function salvarCoordenadores(_: CadState, form: FormData): Promise<CadState> {
  await exigirPerfil("/cadastro");
  const emails = String(form.get("emails") ?? "").split(/[;,\s]+/).map((s) => s.trim()).filter(Boolean);
  const invalido = emails.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (invalido) return { erro: `E-mail inválido: ${invalido}` };
  try { await salvarConfiguracao("coordenadores", emails.join(", ")); } catch (e) { return falha(e); }
  return { ok: Date.now() };
}

export async function salvarPastaDrive(_: CadState, form: FormData): Promise<CadState & { msg?: string }> {
  await exigirPerfil("/cadastro");
  const link = String(form.get("pasta") ?? "").trim();
  try {
    if (!link) { await salvarConfiguracao("pastaDrive", ""); return { ok: Date.now(), msg: "Pasta removida." }; }
    const { conferirPasta } = await import("@/lib/drive");
    const r = await conferirPasta(link);
    await salvarConfiguracao("pastaDrive", `https://drive.google.com/drive/folders/${r.id}`);
    if (!r.editor) return { ok: Date.now(), msg: `Pasta “${r.nome}” conectada só para leitura. Para o app criar as pastas das motos, compartilhe como EDITOR.` };
    return { ok: Date.now(), msg: `Pasta “${r.nome}” conectada (${r.subpastas} subpasta(s)). Novas motos já ganham a pasta automaticamente.` };
  } catch (e) { return falha(e); }
}

/** Cria no Drive as pastas que faltam para todas as motos do estoque e da preparação. */
export async function criarPastasAction(): Promise<CadState & { msg?: string }> {
  await exigirPerfil("/cadastro");
  try {
    const [{ getEstoque }, { getPreparacao }, { criarPastasEmLote }] = await Promise.all([import("@/lib/estoque"), import("@/lib/preparacao"), import("@/lib/drive")]);
    const [{ motos }, prep] = await Promise.all([getEstoque(), getPreparacao().catch(() => ({ itens: [] }))]);
    const lista = [
      ...motos.map((m) => ({ placa: m.placa, modelo: m.modelo })),
      ...prep.itens.filter((p) => p.etapa !== "FINALIZADA").map((p) => ({ placa: p.placa, modelo: p.modelo })),
    ];
    const r = await criarPastasEmLote(lista);
    return { ok: Date.now(), msg: `${r.criadas.length} pasta(s) criada(s), ${r.existentes} já existia(m)${r.ignoradas ? `, ${r.ignoradas} moto(s) sem placa válida` : ""}.` };
  } catch (e) { return falha(e); }
}

/** Salva o endereço da ponte do Drive depois de testar (ping com o segredo). */
export async function salvarPonteDrive(_: CadState, form: FormData): Promise<CadState & { msg?: string }> {
  await exigirPerfil("/cadastro");
  const url = String(form.get("ponte") ?? "").trim();
  try {
    if (!url) { await salvarConfiguracao("ponteDrive", ""); return { ok: Date.now(), msg: "Ponte removida." }; }
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url) && !(process.env.SHEETS_API_BASE && /^http:\/\/127\.0\.0\.1/.test(url))) return { erro: "Cole o endereço do App da Web (termina em /exec)." };
    const { chamarPonte } = await import("@/lib/drive");
    const r = await chamarPonte(url, { ping: true });
    if (!r.ok) return { erro: `A ponte respondeu, mas recusou: ${r.erro ?? "?"}. Confira se colou o código inteiro (com o SEGREDO).` };
    await salvarConfiguracao("ponteDrive", url);
    return { ok: Date.now(), msg: "Ponte funcionando: as fotos enviadas pelo app vão direto para a pasta de cada moto." };
  } catch (e) { return falha(e); }
}
