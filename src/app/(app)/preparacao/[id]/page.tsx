import Link from "next/link";
import { notFound } from "next/navigation";
import { podeEditarPreparacao } from "@/lib/auth";
import { config } from "@/lib/config";
import { ETAPAS, getItem } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { PrepForm } from "../PrepForm";

export const dynamic = "force-dynamic";

const MSG: Record<string, string> = {
  salvar: "Alterações salvas na planilha.",
  avancar: "Moto avançou para a próxima etapa.",
  voltar: "Moto voltou para a etapa anterior.",
};

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const perfil = await exigirPerfil("/preparacao");
  const { id } = await params;
  const { salvo } = await searchParams;
  const item = await getItem(decodeURIComponent(id));
  if (!item) notFound();
  const idx = ETAPAS.findIndex((e) => e.id === item.etapa);

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/preparacao" className="muted" style={{ fontSize: 13 }}>← Preparação</Link>
          <div className="eyebrow" style={{ marginTop: 8 }}>{ETAPAS[idx]?.label}</div>
          <h1>{item.modelo || "Moto"} {item.placa && <span className="plate" style={{ fontSize: 16, verticalAlign: "middle" }}>{item.placa}</span>}</h1>
          <p>
            Recebida em {item.dataRecepcao || "—"}
            {item.diasTotal != null && ` · ${item.diasTotal} dias em preparação`}
            {item.responsavel && ` · responsável: ${item.responsavel}`}
          </p>
        </div>
      </div>

      <div className="steps" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <div key={e.id} className={`step ${i < idx ? "done" : i === idx ? "now" : ""}`}>
            <b>{i + 1}. {e.curto}</b>
            {e.label}
          </div>
        ))}
      </div>

      {salvo && MSG[salvo] && <div className="alert ok" style={{ marginBottom: 16 }}>{MSG[salvo]}</div>}
      <PrepForm item={Object.fromEntries(Object.entries(item).map(([k, v]) => [k, String(v ?? "")])) as Record<string, string> & { etapa: string }} editar={podeEditarPreparacao(perfil)} sugestoes={[]} coordenadorEmail={config.coordenadorEmail} />
    </>
  );
}
