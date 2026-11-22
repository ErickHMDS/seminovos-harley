import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, lerToken, podeAcessar, type Perfil } from "./auth";

export async function perfilAtual(): Promise<Perfil | null> {
  return lerToken((await cookies()).get(COOKIE)?.value);
}

/** Usa em páginas e ações: garante login e permissão para a área. */
export async function exigirPerfil(path: string): Promise<Perfil> {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!podeAcessar(perfil, path)) redirect("/");
  return perfil;
}
