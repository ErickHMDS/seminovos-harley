import Link from "next/link";
import { getEstoque } from "@/lib/estoque";
import { hojeISO } from "@/lib/parse";
import { exigirSessao } from "@/lib/sessao";
import { listaVendedores } from "@/lib/vendas";
import { VendaForm } from "../VendaForm";

export const dynamic = "force-dynamic";

export default async function NovaVendaPage() {
  const s = await exigirSessao("/vendas");
  const perfil = s.perfil;
  const fixo = perfil === "vendedor" ? s.vendedor : null;
  const [vendedores, est] = await Promise.all([listaVendedores(), getEstoque().catch(() => ({ motos: [] }))]);
  return (
    <>
      <div className="page-head">
        <div>
          {perfil === "vendedor" ? <Link href="/meta" className="back-link">← Minha meta</Link> : <Link href="/ranking" className="back-link">← Ranking</Link>}
          <h1>Lançar venda</h1>
          <p>Vai direto para a aba do mês na planilha MOTOS 2026.</p>
        </div>
      </div>
      <VendaForm venda={null} vendedores={vendedores} motos={est.motos.map((m) => ({ placa: m.placa, modelo: m.modelo }))} hoje={hojeISO()} podeExcluir={perfil === "gestor"} vendedorFixo={fixo} />
    </>
  );
}
