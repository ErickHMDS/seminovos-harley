import { AtualizarDados } from "@/components/AtualizarDados";
import { getAtividades } from "@/lib/atividades";
import { getEstoque } from "@/lib/estoque";
import { exigirPerfil } from "@/lib/sessao";
import { AtividadesView, type AtvVM } from "./AtividadesView";

export const dynamic = "force-dynamic";

export default async function AtividadesPage() {
  await exigirPerfil("/atividades");
  const [atividades, est] = await Promise.all([getAtividades(), getEstoque().catch(() => ({ motos: [] }))]);
  const motos = Object.fromEntries(est.motos.map((m) => [m.placa, m.modelo]));
  const vm: AtvVM[] = atividades.map(({ linha: _l, ...a }) => a);
  const abertas = vm.filter((a) => a.aberta).length;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gestor</div>
          <h1>Atividades <span className="count-pill">{abertas}</span></h1>
          <p>Pendências encontradas na inspeção 360 e tarefas avulsas.</p>
        </div>
        <AtualizarDados />
      </div>
      <AtividadesView atividades={vm} motos={motos} />
    </>
  );
}
