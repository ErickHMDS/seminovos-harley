"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PERFIS, algumaSenhaConfigurada, criarToken, perfilPelaSenha } from "@/lib/auth";

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
  // cookie "secure" só quando o acesso é por https (em http o navegador recusaria o cookie)
  const h = await headers();
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: https, sameSite: "lax", maxAge, path: "/" });
  redirect(PERFIS[perfil].inicio);
}

export async function sair() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
