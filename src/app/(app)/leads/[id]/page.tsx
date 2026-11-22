import Link from "next/link";
import { notFound } from "next/navigation";
import { AtividadesLigadas } from "@/components/AtividadesLigadas";
import { atividadesDoLead } from "@/lib/atividades";
import { getCatalogo } from "@/lib/catalogo";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { leadsComOportunidades } from "../dados";
import { LeadForm } from "../LeadForm";
import { STATUS } from "@/lib/leadsStatus";
import { Contato, MatchChip } from "../LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const s = await exigirSessao("/leads");
  const { id } = await params;
  const { salvo } = await searchParams;
  const [leads, { modelos }, usuarios] = await Promise.all([leadsComOportunidades(s), getCatalogo(), s.perfil === "gestor" ? getUsuarios().catch(() => []) : Promise.resolve([])]);
  const l = leads.find((x) => x.id === id);
  if (!l) notFound();
  const st = STATUS.find((x) => x.id === l.status) ?? STATUS[0];
  const vendedor = s.perfil === "gestor" ? l.vendedor || s.nome : s.nome;
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/leads" className="back-link">← Leads</Link>
          <h1>{l.cliente}</h1>
          <p className="meta-line"><span className={`badge ${st.tom}`}>{st.label}</span> quer <strong>{l.desejo}</strong>{l.aceitaEquivalente ? " · aceita equivalente" : ""}{s.perfil === "gestor" ? ` · ${l.vendedor}` : ""}</p>
        </div>
      </div>
      {salvo && <div className="alert ok toast" role="status">{salvo === "novo" ? "Lead cadastrado. Assim que entrar uma moto compatível, ela aparece em Oportunidades." : salvo === "atividade" ? "Atividade registrada neste lead." : "Lead atualizado."}</div>}

      <section className="sec" style={{ marginBottom: 14 }}>
        <div className="sec-head"><h2 className="sec-title">Falar com o cliente</h2><span className="faint" style={{ fontSize: 13 }}>{l.telefone}</span></div>
        <Contato l={l} vendedor={vendedor} />
      </section>

      <section className="sec" style={{ marginBottom: 14 }}>
        <div className="sec-head"><h2 className="sec-title">Motos compatíveis agora</h2><span className={`badge ${l.matches.length ? "ok" : ""}`}>{l.matches.length}</span></div>
        {l.matches.length === 0 ? (
          <p className="faint" style={{ margin: 0, fontSize: 14 }}>Nenhuma no estoque ou na preparação{l.segmento ? ` (segmento ${l.segmento})` : ""}. Você será avisado quando entrar.</p>
        ) : (
          <div className="op-list">{l.matches.map((m) => <div key={m.placa} className="op-match"><MatchChip m={m} /><Contato l={l} placa={m.placa} vendedor={vendedor} compacto /></div>)}</div>
        )}
      </section>

      <AtividadesLigadas className="sec" atividades={await atividadesDoLead(l.id).catch(() => [])} novoHref={`/atividades/nova?${new URLSearchParams({ lead: l.id, volta: `/leads/${l.id}` })}`} />
      <div style={{ height: 14 }} />

      <LeadForm lead={l} catalogo={modelos} vendedores={usuarios.filter((u) => u.perfil === "vendedor" && u.ativo).map((u) => ({ id: u.id, nome: u.nome }))} />

      {l.historico && (
        <section className="sec" style={{ marginTop: 14 }}>
          <h2 className="sec-title">Histórico</h2>
          <ul className="historico">{l.historico.split("\n").filter(Boolean).map((h, i) => <li key={i}>{h}</li>)}</ul>
        </section>
      )}
    </>
  );
}
