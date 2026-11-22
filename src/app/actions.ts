"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PERFIS, criarToken, senhaConfere, senhaDoPerfil, type Perfil } from "@/lib/auth";

export type LoginState = { erro?: string };

export async function entrar(_: LoginState, form: FormData): Promise<LoginState> {
  const perfil = String(form.get("perfil") ?? "") as Perfil;
  const senha = String(form.get("senha") ?? "");
  if (!(perfil in PERFIS)) return { erro: "Escolha um perfil." };
  if (!senhaDoPerfil(perfil)) return { erro: `A senha do perfil ${PERFIS[perfil].label} ainda não foi configurada no servidor.` };
  if (!senhaConfere(perfil, senha)) {
    await new Promise((r) => setTimeout(r, 600)); // atrasa tentativas por força bruta
    return { erro: "Senha incorreta." };
  }
  const { token, maxAge } = await criarToken(perfil);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge, path: "/" });
  redirect(PERFIS[perfil].inicio);
}

export async function sair() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
