"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PERFIS, algumaSenhaConfigurada, criarToken, perfilPelaSenha } from "@/lib/auth";
import { opcoesCookie } from "@/lib/cookie";

export type LoginState = { erro?: string };

export async function entrar(_: LoginState, form: FormData): Promise<LoginState> {
  const senha = String(form.get("senha") ?? "");
  if (!algumaSenhaConfigurada()) return { erro: "Nenhuma senha configurada no servidor (SENHA_GESTOR, SENHA_VENDEDOR, SENHA_PREPARADOR)." };
  const perfil = perfilPelaSenha(senha);
  if (!perfil) {
    await new Promise((r) => setTimeout(r, 600)); // atrasa tentativas repetidas
    return { erro: "Senha incorreta." };
  }
  const { token, maxAge } = await criarToken(perfil);
  (await cookies()).set(COOKIE, token, await opcoesCookie(maxAge));
  redirect(PERFIS[perfil].inicio);
}

export async function sair() {
  // apaga com os mesmos atributos usados na criação (cookie particionado só some assim)
  (await cookies()).set(COOKIE, "", await opcoesCookie(0));
  redirect("/login");
}
