import { Atualizado } from "@/components/ui";
import { podeVerCusto } from "@/lib/auth";
import { getEstoque, semCusto } from "@/lib/estoque";
import { getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { EstoqueView } from "./EstoqueView";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const perfil = await exigirPerfil("/estoque");
  const [{ motos, atualizadoEm }, prep] = await Promise.all([getEstoque(), getPreparacao().catch(() => null)]);
  const verCusto = podeVerCusto(perfil);
  const emPreparacao = Object.fromEntries(
    (prep?.itens ?? []).filter((p) => p.etapa !== "FINALIZADA" && p.placa).map((p) => [p.placa.toUpperCase(), p.etapa]),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Estoque de seminovos</div>
          <h1>Estoque</h1>
          <p>Motos das abas {"“Estoque CTBA”"} e {"“Estoque LOND”"}. Dias em estoque calculados a partir da data de entrada.</p>
        </div>
        <Atualizado em={atualizadoEm} />
      </div>
      <EstoqueView motos={verCusto ? motos : motos.map(semCusto)} verCusto={verCusto} emPreparacao={emPreparacao} />
    </>
  );
}
