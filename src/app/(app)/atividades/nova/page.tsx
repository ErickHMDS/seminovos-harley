import Link from "next/link";
import { hojeISO } from "@/lib/parse";
import { exigirSessao } from "@/lib/sessao";
import { opcoesFormulario, voltaSegura } from "../dados";
import { NovaAtividadeForm } from "./NovaAtividadeForm";

export const dynamic = "force-dynamic";

export default async function NovaAtividadePage({ searchParams }: { searchParams: Promise<{ placa?: string; lead?: string; volta?: string; p?: string }> }) {
  const s = await exigirSessao("/atividades/nova");
  const sp = await searchParams;
  const op = await opcoesFormulario(s);
  const volta = voltaSegura(sp.volta);
  const eu = op.pessoas.some((p) => p.id === s.uid) ? s.uid : null;
  const marcadas = [...new Set([...(eu && s.perfil !== "gestor" ? [eu] : []), ...(sp.p && op.pessoas.some((p) => p.id === sp.p) ? [sp.p] : [])])];
  return (
    <>
      <div className="page-head">
        <div>
          <Link href={volta} className="back-link">← {volta.startsWith("/meta") ? "Minha meta" : volta.startsWith("/atividades") ? "Atividades" : "Voltar"}</Link>
          <h1>Nova atividade</h1>
          <p>Data e hora, prioridade, quem participa e se repete.</p>
        </div>
      </div>
      <NovaAtividadeForm {...op} eu={eu} volta={volta} hoje={hojeISO()}
        inicial={{ placa: (sp.placa ?? "").toUpperCase(), lead: sp.lead ?? "", pessoas: marcadas }} />
    </>
  );
}
