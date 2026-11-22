import { baixar } from "@/lib/drive";
import { sessaoAtual } from "@/lib/sessao";

export const runtime = "nodejs";

/**
 * Serve uma foto do Google Drive (lida pela conta de serviço), reduzida.
 * ?w=480 para miniaturas; padrão 1600 px. Só para quem está logado.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{10,}$/.test(id)) return new Response("Não encontrado", { status: 404 });
  if (!(await sessaoAtual().catch(() => null))) return new Response("Não autorizado", { status: 401 });
  const w = Math.min(2400, Math.max(120, Number(new URL(req.url).searchParams.get("w")) || 1600));
  try {
    const { dados, tipo } = await baixar(id);
    let corpo: Uint8Array = new Uint8Array(dados);
    let ct = tipo;
    try {
      const sharp = (await import("sharp")).default;
      corpo = new Uint8Array(await sharp(Buffer.from(dados)).rotate().resize({ width: w, height: w, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer());
      ct = "image/jpeg";
    } catch { /* formato que o sharp não lê (ex.: HEIC): devolve o original */ }
    return new Response(corpo as BodyInit, { headers: { "Content-Type": ct, "Cache-Control": "private, max-age=604800, immutable" } });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
