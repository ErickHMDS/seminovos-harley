import { NextResponse } from "next/server";
import { prepararProximoMes } from "@/lib/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chamado todo dia pelo agendador da Vercel (vercel.json → crons). Nos últimos 3 dias do mês cria a aba
 * do mês seguinte na planilha MOTOS 2026. Protegido pelo CRON_SECRET (a Vercel envia
 * "Authorization: Bearer <CRON_SECRET>"); sem CRON_SECRET configurado, aceita só o agendador da Vercel.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const agendador = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (segredo ? auth !== `Bearer ${segredo}` : !agendador) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const forcar = new URL(req.url).searchParams.get("forcar") === "1" && !!segredo;
  try {
    const r = await prepararProximoMes(forcar);
    console.log("[aba-mes]", r);
    return NextResponse.json(r);
  } catch (e) {
    console.error("[aba-mes] falhou", e);
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
