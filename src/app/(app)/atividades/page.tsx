import Link from "next/link";
import { AtualizarDados } from "@/components/AtualizarDados";
import { Icon } from "@/components/Icon";
import { agoraSP, estaAtrasada, getAtividades, podeExcluir, visivelPara, type Atividade } from "@/lib/atividades";
import { monitoramento } from "@/lib/cobrancas";
import { leadsVisiveis, semSyonet } from "@/lib/leads";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { AtividadesView, type AtvVM } from "./AtividadesView";
import { CobrarEquipe, PendenciasSyonet } from "./Equipe";

export const dynamic = "force-dynamic";

const SALVO: Record<string, string> = { atividade: "Atividade lançada.", editada: "Atividade atualizada.", excluida: "Atividade excluída." };

export default async function AtividadesPage({ searchParams }: { searchParams: Promise<{ salvo?: string; v?: string; p?: string }> }) {
  const s = await exigirSessao("/atividades");
  const sp = await searchParams;
  const gestor = s.perfil === "gestor";
  const [todas, usuarios, monitor, pendSyonet] = await Promise.all([
    getAtividades().catch(() => [] as Atividade[]),
    getUsuarios().catch(() => []),
    gestor ? monitoramento().catch(() => []) : Promise.resolve([]),
    s.perfil === "vendedor" ? leadsVisiveis(s).then((l) => l.filter(semSyonet)).catch(() => []) : Promise.resolve([]),
  ]);
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  const agora = agoraSP();

  // filtro do gestor por pessoa: "" = todas · "gestao" = sem ninguém marcado · <id> = de uma pessoa
  const filtro = gestor ? sp.p ?? "" : "";
  const visiveis = todas.filter((a) => visivelPara(a, s)).filter((a) =>
    !filtro ? true : filtro === "gestao" ? !a.pessoas.length : a.pessoas.includes(filtro) || a.criadoPorId === filtro);

  const vm: AtvVM[] = visiveis.map((a) => ({
    id: a.id, descricao: a.descricao, status: a.etapa, urgente: a.urgente, data: a.prazoData, hora: a.prazoHora,
    atrasada: estaAtrasada(a, agora), pessoas: a.pessoas.map((id, k) => nomes.get(id) ?? a.responsavel.split(",").at(k)?.trim() ?? "?"),
    placa: a.placa, modelo: a.modelo, lead: a.lead, cliente: a.cliente, observacao: a.observacao, periodicidade: a.periodicidade,
    origem: a.origem, ref: a.ref, resolvidaEm: a.resolvidaEm, criadoPor: a.criadoPor, podeExcluir: podeExcluir(a, s),
  }));
  const abertas = vm.filter((a) => a.status !== "FINALIZADO").length;
  const atrasadas = vm.filter((a) => a.atrasada).length;
  const pessoasFiltro = usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil }));
  const visao = sp.v === "lista" ? "lista" : "kanban"; // Kanban é a visão principal

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{gestor ? "Gestor" : "Suas tarefas"}</div>
          <h1>Atividades <span className="count-pill">{abertas}</span></h1>
          <p>{atrasadas ? <><b className="txt-bad">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</b> · </> : null}{abertas} em aberto{gestor ? " · use o filtro para ver cada pessoa" : ""}</p>
        </div>
        <div className="head-actions">
          <AtualizarDados />
          <Link href={`/atividades/nova${filtro && filtro !== "gestao" ? `?p=${encodeURIComponent(filtro)}` : ""}`} className="btn"><Icon name="plus" size={16} /> Nova atividade</Link>
        </div>
      </div>
      {sp.salvo && SALVO[sp.salvo] && <div className="alert ok toast" role="status">{SALVO[sp.salvo]}</div>}

      {gestor && monitor.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div className="panel-head"><h2>Cobrar a equipe</h2><span className="hint">leads sem Syonet · “Cobrei” some por 24 h</span></div>
          <CobrarEquipe itens={monitor} />
        </section>
      )}

      <AtividadesView atividades={vm} visao={visao} filtro={filtro} pessoas={gestor ? pessoasFiltro : []} hoje={agora.data} />

      {s.perfil === "vendedor" && (
        <section style={{ marginTop: 28 }}>
          <div className="panel-head"><h2>Leads sem Syonet <span className="count-pill">{pendSyonet.length}</span></h2></div>
          <PendenciasSyonet itens={pendSyonet.map((l) => ({ id: l.id, cliente: l.cliente, desejo: [l.marca, l.modelo].filter(Boolean).join(" ") || l.tipo, criadoEm: l.criadoEm, status: l.status }))} />
        </section>
      )}
    </>
  );
}
