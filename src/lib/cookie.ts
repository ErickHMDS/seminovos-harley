import "server-only";
import { headers } from "next/headers";

/**
 * Opções do cookie de sessão.
 * Em https o cookie é emitido como SameSite=None + Secure + Partitioned: assim ele funciona
 * também quando o app roda dentro de um iframe de outro site (ex.: Google AI Studio),
 * onde cookies "Lax" são bloqueados e o app pediria a senha a cada clique.
 * Em http (localhost) usa Lax, porque navegadores recusam cookies Secure sem https.
 */
export async function opcoesCookie(maxAge: number) {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const origem = h.get("origin") ?? h.get("referer") ?? "";
  const https = proto === "https" || origem.startsWith("https://");
  return https
    ? ({ httpOnly: true, secure: true, sameSite: "none", partitioned: true, maxAge, path: "/" } as const)
    : ({ httpOnly: true, secure: false, sameSite: "lax", maxAge, path: "/" } as const);
}
