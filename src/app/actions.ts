"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, PERFIS, criarToken } from "@/lib/auth";
import { autenticar } from "@/lib/usuarios";
import { opcoesCookie } from "@/lib/cookie";
import { invalidate } from "@/lib/cache";
import { perfilAtual } from "@/lib/sessao";

export type LoginState = { erro?: string };

export async function entrar(_: LoginState, form: FormData): Promise<LoginState> {
  const senha = String(form.get("senha") ?? "");
  const quem = await autenticar(senha).catch(() => null);
  if (!quem) {
    await new Promise((r) => setTimeout(r, 700)); // atrasa tentativas repetidas
    return { erro: "Senha incorreta." };
  }
  const { token, maxAge } = await criarToken(quem.perfil, quem.uid, quem.ver);
  (await cookies()).set(COOKIE, token, await opcoesCookie(maxAge));
  redirect(PERFIS[quem.perfil].inicio);
}

export async function sair() {
  // apaga com os mesmos atributos usados na criação (cookie particionado só some assim)
  (await cookies()).set(COOKIE, "", await opcoesCookie(0));
  redirect("/login");
}

/** Esquece os dados em cache para reler a planilha na próxima renderização. */
export async function atualizarDados() {
  if (!(await perfilAtual())) return;
  invalidate("");
}
