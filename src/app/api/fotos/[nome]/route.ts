import fs from "node:fs/promises";
import path from "node:path";

/** Serve fotos gravadas em disco (somente uso local/testes, com FOTOS_DIR). Em produção as fotos ficam no Vercel Blob. */
export async function GET(_: Request, { params }: { params: Promise<{ nome: string }> }) {
  const dir = process.env.FOTOS_DIR;
  const { nome } = await params;
  if (!dir || !/^[A-Za-z0-9._-]+$/.test(nome)) return new Response("Não encontrado", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(dir, nome));
    const tipo = nome.endsWith(".png") ? "image/png" : nome.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
