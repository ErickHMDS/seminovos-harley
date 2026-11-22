import { AtualizarDados } from "@/components/AtualizarDados";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ehDoVendedor, getAtividades } from "@/lib/atividades";
import { monitoramento } from "@/lib/cobrancas";
import { getEstoque } from "@/lib/estoque";
import { leadsVisiveis, semSyonet } from "@/lib/leads";
import { exigirSessao } from "@/lib/sessao";
import { AtividadesView, type AtvVM } from "./AtividadesView";
import { CobrarEquipe, PendenciasSyonet } from "./Equipe";

export const dynamic = "force-dynamic";

const SALVO: Record<string, string> = { atividade: "Atividade lançada." };
const semLinha = <T extends { linha: number }>({ linha: _l, ...a }: T) => a;

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const s = await exigirSessao("/atividades");
  const { salvo } = await searchParams;
  const aviso = salvo && SALVO[salvo] ? <div className="alert ok toast" role="status">{SALVO[salvo]}</div> : null;

  if (s.perfil === "vendedor") {
    const [pend, todas] = await Promise.all([(await leadsVisiveis(s).catch(() => [])).filter(semSyonet), getAtividades().catch(() => [])]);
    const minhas = todas.filter((a) => a.responsavelId === s.uid).map(semLinha);
    const abertas = minhas.filter((a) => a.aberta).length;
    return (
      <>
        <div className="page-head">
          <div><div className="eyebrow">Suas pendências</div><h1>Tarefas <span className="count-pill">{pend.length + abertas}</span></h1><p>Suas atividades e os leads que ainda não foram cadastrados no Syonet.</p></div>
          <div className="head-actions">
            <AtualizarDados />
            <Link href="/atividades/nova" className="btn"><Icon name="plus" size={16} /> Nova atividade</Link>
          </div>
        </div>
        {aviso}
        <section style={{ marginBottom: 24 }}>
          <div className="panel-head"><h2>Minhas atividades</h2><span className="hint">{abertas} aberta(s)</span></div>
          <AtividadesView atividades={minhas} motos={{}} rapido={false} vazio="Use “Nova atividade” para lembrar de algo — ligada a uma moto, a um lead ou de rotina." />
        </section>
        <div className="panel-head"><h2>Leads sem Syonet</h2></div>
        <PendenciasSyonet itens={pend.map((l) => ({ id: l.id, cliente: l.cliente, desejo: [l.marca, l.modelo].filter(Boolean).join(" ") || l.tipo, criadoEm: l.criadoEm, status: l.status }))} />
      </>
    );
  }

  const [atividades, est, monitor] = await Promise.all([getAtividades(), getEstoque().catch(() => ({ motos: [] })), monitoramento().catch(() => [])]);
  const motos = Object.fromEntries(est.motos.map((m) => [m.placa, m.modelo]));
  const vm: AtvVM[] = atividades.filter((a) => !ehDoVendedor(a)).map(semLinha);
  const daEquipe: AtvVM[] = atividades.filter(ehDoVendedor).map(semLinha);
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
      {aviso}
      <section style={{ marginBottom: 20 }}>
        <div className="panel-head"><h2>Cobrar a equipe</h2><span className="hint">leads sem Syonet · “Cobrei” some por 24 h</span></div>
        <CobrarEquipe itens={monitor} />
      </section>
      <div className="panel-head"><h2>Preparação e tarefas</h2></div>
      <AtividadesView atividades={vm} motos={motos} />
      {daEquipe.some((a) => a.aberta) && (
        <details className="sec" style={{ marginTop: 24 }}>
          <summary className="strong" style={{ cursor: "pointer" }}>Atividades dos vendedores <span className="count-pill">{daEquipe.filter((a) => a.aberta).length}</span></summary>
          <div style={{ marginTop: 12 }}><AtividadesView atividades={daEquipe} motos={motos} rapido={false} mostrarDono /></div>
        </details>
      )}
    </>
  );
}
