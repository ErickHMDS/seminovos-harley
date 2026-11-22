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
          <Link href="/preparacao" className="muted" style={{ fontSize: 13 }}>← Preparação</Link>
          <div className="eyebrow" style={{ marginTop: 8 }}>Etapa 1</div>
          <h1>Receber moto</h1>
          <p>Registre a chegada e a inspeção 360. Se a placa já estiver no estoque, os dados são preenchidos automaticamente.</p>
        </div>
      </div>
      <PrepForm item={null} editar sugestoes={sugestoes} coordenadorEmail="" hoje={hojeISO()} />
    </>
  );
}
