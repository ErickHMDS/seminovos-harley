import { AtualizarDados } from "@/components/AtualizarDados";
import { getAtividades } from "@/lib/atividades";
import { monitoramento } from "@/lib/cobrancas";
import { getEstoque } from "@/lib/estoque";
import { leadsVisiveis, semSyonet } from "@/lib/leads";
import { exigirSessao } from "@/lib/sessao";
import { AtividadesView, type AtvVM } from "./AtividadesView";
import { CobrarEquipe, PendenciasSyonet } from "./Equipe";

export const dynamic = "force-dynamic";

export default async function AtividadesPage() {
  const s = await exigirSessao("/atividades");

  if (s.perfil === "vendedor") {
    const pend = (await leadsVisiveis(s).catch(() => [])).filter(semSyonet);
    return (
      <>
        <div className="page-head">
          <div><div className="eyebrow">Suas pendências</div><h1>Tarefas <span className="count-pill">{pend.length}</span></h1><p>Leads que ainda não foram cadastrados no Syonet.</p></div>
          <AtualizarDados />
        </div>
        <PendenciasSyonet itens={pend.map((l) => ({ id: l.id, cliente: l.cliente, desejo: [l.marca, l.modelo].filter(Boolean).join(" ") || l.tipo, criadoEm: l.criadoEm, status: l.status }))} />
      </>
    );
  }

  const [atividades, est, monitor] = await Promise.all([getAtividades(), getEstoque().catch(() => ({ motos: [] })), monitoramento().catch(() => [])]);
  const motos = Object.fromEntries(est.motos.map((m) => [m.placa, m.modelo]));
  const vm: AtvVM[] = atividades.map(({ linha: _l, ...a }) => a);
  const abertas = vm.filter((a) => a.aberta).length;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gestor</div>
          <h1>Atividades <span className="count-pill">{abertas + monitor.length}</span></h1>
          <p>Cobranças da equipe, pendências da inspeção 360 e tarefas avulsas.</p>
        </div>
        <AtualizarDados />
      </div>
      <section style={{ marginBottom: 20 }}>
        <div className="panel-head"><h2>Cobrar a equipe</h2><span className="hint">leads sem Syonet · “Cobrei” some por 24 h</span></div>
        <CobrarEquipe itens={monitor} />
      </section>
      <div className="panel-head"><h2>Preparação e tarefas</h2></div>
      <AtividadesView atividades={vm} motos={motos} />
    </>
  );
}
