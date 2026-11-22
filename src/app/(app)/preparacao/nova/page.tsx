import Link from "next/link";
import { redirect } from "next/navigation";
import { podeEditarPreparacao } from "@/lib/auth";
import { getEstoque } from "@/lib/estoque";
import { hojeISO } from "@/lib/parse";
import { exigirPerfil } from "@/lib/sessao";
import { PrepForm } from "../PrepForm";

export const dynamic = "force-dynamic";

export default async function NovaPage() {
  const perfil = await exigirPerfil("/preparacao");
  if (!podeEditarPreparacao(perfil)) redirect("/preparacao");
  const { motos } = await getEstoque().catch(() => ({ motos: [] }));
  const sugestoes = motos.map((m) => ({ placa: m.placa, modelo: m.modelo, cor: m.cor, ano: m.ano, km: m.km != null ? String(m.km) : "", loja: m.cidade }));
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/preparacao" className="back-link">← Preparação</Link>
          <h1>Receber moto</h1>
          <p>Inspeção 360. Digite a placa: se ela estiver no estoque, os dados vêm sozinhos.</p>
        </div>
      </div>
      <PrepForm item={null} editar sugestoes={sugestoes} hoje={hojeISO()} />
    </>
  );
}
