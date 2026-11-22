import Link from "next/link";
import { redirect } from "next/navigation";
import { podeEditarPreparacao } from "@/lib/auth";
import { getCatalogo } from "@/lib/catalogo";
import { config } from "@/lib/config";
import { empresasPorAba, getEstoque } from "@/lib/estoque";
import { rotuloAba } from "@/lib/lojas";
import { hojeISO } from "@/lib/parse";
import { exigirPerfil } from "@/lib/sessao";
import { PrepForm } from "../PrepForm";

export const dynamic = "force-dynamic";

export default async function NovaPage() {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) redirect("/preparacao");
  const [{ motos }, { modelos }, empresas] = await Promise.all([
    getEstoque().catch(() => ({ motos: [] as Awaited<ReturnType<typeof getEstoque>>["motos"] })),
    getCatalogo(),
    empresasPorAba().catch(() => ({} as Record<string, string[]>)),
  ]);
  const sugestoes = motos.map((m) => ({
    placa: m.placa, modelo: m.modelo, cor: m.cor, ano: m.ano, km: m.km != null ? String(m.km) : "", loja: m.cidade,
    fabricante: m.fabricante, tipo: m.tipo, empresa: m.empresa,
  }));
  const lojas = config.estoqueAbas.map((aba) => ({ label: rotuloAba(aba), aba, empresas: empresas[aba] ?? [] }));
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/preparacao" className="back-link">← Preparação</Link>
          <h1>Receber moto</h1>
          <p>Inspeção 360. Digite a placa: se ela estiver no estoque, os dados vêm sozinhos.</p>
        </div>
      </div>
      <PrepForm item={null} editar sugestoes={sugestoes} hoje={hojeISO()} catalogo={modelos} lojas={lojas} />
    </>
  );
}
