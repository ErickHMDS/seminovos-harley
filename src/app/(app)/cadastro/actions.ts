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
    return { ok: Date.now(), msg: `Pasta “${r.nome}” conectada (${r.subpastas} subpasta(s)).` };
  } catch (e) { return falha(e); }
}
