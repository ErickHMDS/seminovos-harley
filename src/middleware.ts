import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, PERFIS, lerToken, podeAcessar } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // agendador da Vercel (protegido na própria rota pelo CRON_SECRET)
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  const t = await lerToken(req.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    // ?sair=1: sessão inválida (usuário desativado ou senha redefinida) -> apaga o cookie e mostra o login
    if (searchParams.has("sair")) {
      const res = NextResponse.next();
      res.headers.append("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
      res.headers.append("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`);
      return res;
    }
    return t ? NextResponse.redirect(new URL(PERFIS[t.perfil].inicio, req.url)) : NextResponse.next();
  }
  if (!t) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname === "/" || !podeAcessar(t.perfil, pathname)) {
    return NextResponse.redirect(new URL(PERFIS[t.perfil].inicio, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|apple-icon|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
