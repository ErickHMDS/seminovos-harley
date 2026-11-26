import { NextResponse } from "next/server";
import { atualizarMesReferencia } from "@/lib/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chamado todo dia pelo agendador da Vercel (vercel.json → crons). Nos 3 primeiros dias do mês troca a
 * data de referência do PAINEL GERAL (célula L3) para o dia 1º do mês atual — a planilha não usa mais abas por mês. Protegido pelo CRON_SECRET (a Vercel envia
 * "Authorization: Bearer <CRON_SECRET>"); sem CRON_SECRET configurado, aceita só o agendador da Vercel.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const agendador = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (segredo ? auth !== `Bearer ${segredo}` : !agendador) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const forcar = new URL(req.url).searchParams.get("forcar") === "1" && !!segredo;
  try {
    const r = await atualizarMesReferencia(forcar);
    console.log("[mes-referencia]", r);
    return NextResponse.json(r);
  } catch (e) {
    console.error("[mes-referencia] falhou", e);
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
