import Link from "next/link";
import { getEstoque } from "@/lib/estoque";
import { leadsVisiveis } from "@/lib/leads";
import { hojeISO } from "@/lib/parse";
import { getPreparacao } from "@/lib/preparacao";
import { exigirSessao } from "@/lib/sessao";
import { NovaAtividadeForm } from "./NovaAtividadeForm";

export const dynamic = "force-dynamic";

export default async function NovaAtividadePage({ searchParams }: { searchParams: Promise<{ placa?: string; lead?: string; volta?: string }> }) {
  const s = await exigirSessao("/atividades/nova");
  const sp = await searchParams;
  const [{ motos }, prep, leads] = await Promise.all([
    getEstoque().catch(() => ({ motos: [] as Awaited<ReturnType<typeof getEstoque>>["motos"] })),
    getPreparacao().catch(() => ({ itens: [] as Awaited<ReturnType<typeof getPreparacao>>["itens"] })),
    leadsVisiveis(s).catch(() => []),
  ]);
  const opcoesMotos = new Map<string, string>();
  for (const m of motos) if (m.placa) opcoesMotos.set(m.placa, m.modelo);
  for (const p of prep.itens) if (p.placa && p.etapa !== "FINALIZADA" && !opcoesMotos.has(p.placa.toUpperCase())) opcoesMotos.set(p.placa.toUpperCase(), `${p.modelo} (em preparação)`);
  const volta = sp.volta && sp.volta.startsWith("/") && !sp.volta.startsWith("//") ? sp.volta : "/atividades";
  return (
    <>
      <div className="page-head">
        <div>
          <Link href={volta} className="back-link">← {volta.startsWith("/meta") ? "Minha meta" : "Tarefas"}</Link>
          <h1>Nova atividade</h1>
          <p>Uma tarefa para não esquecer. Pode ficar ligada a uma moto ou a um lead.</p>
        </div>
      </div>
      <NovaAtividadeForm
        motos={[...opcoesMotos.entries()].map(([placa, modelo]) => ({ placa, modelo })).sort((a, b) => a.modelo.localeCompare(b.modelo))}
        leads={leads.filter((l) => l.ativo).map((l) => ({ id: l.id, cliente: l.cliente, desejo: [l.marca, l.modelo].filter(Boolean).join(" ") }))}
        inicial={{ placa: (sp.placa ?? "").toUpperCase(), lead: sp.lead ?? "" }} volta={volta} hoje={hojeISO()}
      />
    </>
  );
}
