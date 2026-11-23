import Link from "next/link";
import { notFound } from "next/navigation";
import { getAtividades, podeExcluir, podeMexer } from "@/lib/atividades";
import { hojeISO } from "@/lib/parse";
import { exigirSessao } from "@/lib/sessao";
import { opcoesFormulario, voltaSegura } from "../dados";
import { NovaAtividadeForm } from "../nova/NovaAtividadeForm";

export const dynamic = "force-dynamic";

export default async function EditarAtividadePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volta?: string }> }) {
  const s = await exigirSessao("/atividades");
  const { id } = await params;
  const { volta: v } = await searchParams;
  const a = (await getAtividades()).find((x) => x.id === decodeURIComponent(id));
  if (!a || !podeMexer(a, s)) notFound();
  const op = await opcoesFormulario(s);
  const volta = voltaSegura(v);
  return (
    <>
      <div className="page-head">
        <div>
          <Link href={volta} className="back-link">← Atividades</Link>
          <h1>Editar atividade</h1>
          <p className="meta-line">Criada em {a.criadaEm.split(",")[0]}{a.criadoPor ? ` por ${a.criadoPor}` : ""}{a.origem === "Inspeção 360" ? " · pendência da inspeção 360" : ""}</p>
        </div>
      </div>
      <NovaAtividadeForm {...op} eu={op.pessoas.some((p) => p.id === s.uid) ? s.uid : null} volta={volta} hoje={hojeISO()}
        inicial={{
          id: a.id, descricao: a.descricao, data: a.prazoData, hora: a.prazoHora, prioridade: a.urgente ? "URGENTE" : "NORMAL",
          periodicidade: a.periodicidade, observacao: a.observacao, pessoas: a.pessoas, placa: a.placa, lead: a.lead, status: a.etapa,
          podeExcluir: podeExcluir(a, s),
        }} />
    </>
  );
}
