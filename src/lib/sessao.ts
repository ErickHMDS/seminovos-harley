import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PERFIS, lerToken, podeAcessar, type Perfil } from "./auth";
import { getUsuarios } from "./usuarios";

export type Sessao = { perfil: Perfil; uid: string; nome: string; vendedor: string | null };

/**
 * Sessão válida = token assinado + pessoa ainda ativa no cadastro, com o mesmo perfil e a mesma versão de senha.
 * (Redefinir a senha, mudar o perfil ou desativar derruba as sessões abertas.)
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const t = await lerToken((await cookies()).get(COOKIE)?.value);
  if (!t) return null;
  if (t.uid === "admin") return { perfil: "gestor", uid: "admin", nome: "Administrador", vendedor: null };
  if (t.uid.startsWith("env-")) return { perfil: t.perfil, uid: t.uid, nome: PERFIS[t.perfil].label, vendedor: null };
  const u = (await getUsuarios().catch(() => [])).find((x) => x.id === t.uid);
  if (!u || !u.ativo || u.versao !== t.ver || u.perfil !== t.perfil) return null;
  return { perfil: u.perfil, uid: u.id, nome: u.nome, vendedor: u.vendedor || null };
}

export async function perfilAtual(): Promise<Perfil | null> {
  return (await sessaoAtual())?.perfil ?? null;
}

/** Usa em páginas e ações: garante login e permissão para a área. */
export async function exigirSessao(path: string): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/login?sair=1");
  if (!podeAcessar(s.perfil, path)) redirect("/");
  return s;
}

export async function exigirPerfil(path: string): Promise<Perfil> {
  return (await exigirSessao(path)).perfil;
}
