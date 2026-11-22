import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, PERFIS, lerToken, podeAcessar } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const perfil = await lerToken(req.cookies.get(COOKIE)?.value);

  if (pathname === "/login") {
    return perfil ? NextResponse.redirect(new URL(PERFIS[perfil].inicio, req.url)) : NextResponse.next();
  }
  if (!perfil) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname === "/" || !podeAcessar(perfil, pathname)) {
    return NextResponse.redirect(new URL(PERFIS[perfil].inicio, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)"],
};
