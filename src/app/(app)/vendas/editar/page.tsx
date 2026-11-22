import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstoque } from "@/lib/estoque";
import { fmt, hojeISO } from "@/lib/parse";
import { exigirSessao } from "@/lib/sessao";
import { getVendas, listaVendedores } from "@/lib/vendas";
import { VendaForm, type VendaVM } from "../VendaForm";

export const dynamic = "force-dynamic";

export default async function EditarVendaPage({ searchParams }: { searchParams: Promise<{ aba?: string; linha?: string }> }) {
  const s = await exigirSessao("/vendas");
  const perfil = s.perfil;
  const fixo = perfil === "vendedor" ? s.vendedor : null;
  const { aba = "", linha = "" } = await searchParams;
  const [base, vendedores, est] = await Promise.all([getVendas(), listaVendedores(), getEstoque().catch(() => ({ motos: [] }))]);
  const v = base.vendas.find((x) => x.aba === aba && x.linha === Number(linha));
  if (!v || (fixo && v.vendedor !== fixo)) notFound();
  const vm: VendaVM = {
    aba: v.aba, linha: v.linha, mes: v.mes, data: fmt.date(v.data ? new Date(v.data) : null).replace("—", ""), vendedor: v.vendedor, pedido: v.pedido,
    loja: v.loja, situacao: v.situacao, cliente: v.cliente, veiculo: v.veiculo, placa: v.placa, ge: v.ge, fin: v.fin, usado: v.usado,
    seguro: v.seguro, prevFaturamento: v.prevFaturamento, observacoes: v.observacoes,
  };
  return (
    <>
      <div className="page-head">
        <div>
          {perfil === "vendedor" ? <Link href="/meta" className="back-link">← Minha meta</Link> : <Link href={`/ranking?mes=${v.mes}`} className="back-link">← Ranking</Link>}
          <h1>Editar venda</h1>
          <p>Aba “{v.aba.trim()}”, linha {v.linha}.</p>
        </div>
      </div>
      <VendaForm venda={vm} vendedores={vendedores} motos={est.motos.map((m) => ({ placa: m.placa, modelo: m.modelo }))} hoje={hojeISO()} podeExcluir={perfil === "gestor"} vendedorFixo={fixo} />
    </>
  );
}
