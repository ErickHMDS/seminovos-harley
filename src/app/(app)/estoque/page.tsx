import Link from "next/link";
import { AtualizarDados } from "@/components/AtualizarDados";
import { Fab } from "@/components/Fab";
import { Icon } from "@/components/Icon";
import { podeVerCusto } from "@/lib/auth";
import { getEstoque, semCusto } from "@/lib/estoque";
import { capas } from "@/lib/fotos";
import { checklistPorPlaca, getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { EstoqueView } from "./EstoqueView";

export const dynamic = "force-dynamic";

const SALVO: Record<string, string> = { nova: "Moto adicionada ao estoque.", editada: "Moto atualizada.", removida: "Moto removida do estoque." };

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ salvo?: string; q?: string; faixa?: string; cidade?: string; marca?: string }> }) {
  const perfil = await exigirPerfil("/estoque");
  const sp = await searchParams;
  const [{ motos, atualizadoEm }, prep, checklists, fotos] = await Promise.all([
    getEstoque(), getPreparacao().catch(() => null), checklistPorPlaca().catch(() => ({})), capas().catch(() => ({})),
  ]);
  const verCusto = podeVerCusto(perfil);
  const editar = perfil === "gestor";
  const emPreparacao = Object.fromEntries(
    (prep?.itens ?? []).filter((p) => p.etapa !== "FINALIZADA" && p.placa).map((p) => [p.placa.toUpperCase(), p.etapa]),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Seminovos</div>
          <h1>Estoque</h1>
        </div>
        <div className="head-actions">
          <AtualizarDados em={atualizadoEm} />
          {editar && <Link href="/estoque/moto" className="btn desktop-only"><Icon name="plus" size={16} /> Nova moto</Link>}
        </div>
      </div>
      {sp.salvo && SALVO[sp.salvo] && <div className="alert ok toast" role="status">{SALVO[sp.salvo]}</div>}
      <EstoqueView motos={verCusto ? motos : motos.map(semCusto)} verCusto={verCusto} editar={editar} emPreparacao={emPreparacao} buscaInicial={sp.salvo && sp.salvo !== "removida" ? sp.q ?? "" : ""} checklists={checklists} capas={fotos}
        key={`${sp.faixa ?? ""}|${sp.cidade ?? ""}|${sp.marca ?? ""}`} inicial={{ faixa: sp.faixa, cidade: sp.cidade, marca: sp.marca }} resumo={perfil !== "vendedor"} />
      {editar && <Fab href="/estoque/moto" label="Nova moto" />}
    </>
  );
}
