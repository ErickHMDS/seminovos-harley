import Link from "next/link";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { empresasPorAba, getMoto } from "@/lib/estoque";
import { hojeISO } from "@/lib/parse";
import { exigirPerfil } from "@/lib/sessao";
import { MotoForm, type MotoVM } from "../MotoForm";

export const dynamic = "force-dynamic";

import { rotuloAba as rotulo } from "@/lib/lojas";

export default async function MotoPage({ searchParams }: { searchParams: Promise<{ aba?: string; linha?: string }> }) {
  await exigirPerfil("/estoque/moto");
  const { aba, linha } = await searchParams;
  const empresas = await empresasPorAba();
  let vm: MotoVM | null = null;
  if (aba && linha) {
    const m = await getMoto(aba, Number(linha));
    if (!m) notFound();
    const n = (x: number | null) => (x == null ? "" : String(x).replace(".", ","));
    vm = {
      aba: m.aba, linha: m.linha, empresa: m.empresa, placa: m.placa, modelo: m.modelo, km: n(m.km), ano: m.ano, cor: m.cor,
      dataEntrada: m.dataEntrada ? new Date(m.dataEntrada).toLocaleDateString("pt-BR") : "", custo: n(m.custo), ultimoValorVenda: n(m.ultimoValorVenda),
      fipe: n(m.fipe), realinhamento: n(m.realinhamento), status: m.status, observacao: m.observacao, dias: m.dias,
    };
  }
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/estoque" className="back-link">← Estoque</Link>
          <h1>{vm ? vm.modelo : "Nova moto"} {vm?.placa && <span className="plate">{vm.placa}</span>}</h1>
          {vm && <p>{vm.dias != null ? `${vm.dias} dias em estoque` : ""}</p>}
        </div>
      </div>
      <MotoForm moto={vm} abas={config.estoqueAbas.map((a) => ({ id: a, label: rotulo(a) }))} empresas={empresas} hoje={hojeISO()} />
    </>
  );
}
