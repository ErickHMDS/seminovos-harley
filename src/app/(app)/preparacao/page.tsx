import Link from "next/link";
import { AtualizarDados } from "@/components/AtualizarDados";
import { Fab } from "@/components/Fab";
import { Icon } from "@/components/Icon";
import { getAtividades } from "@/lib/atividades";
import { podeEditarPreparacao } from "@/lib/auth";
import { inspecaoCompleta } from "@/lib/checklist";
import { ETAPAS, getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { Board, type CardVM, type LaneVM } from "./Board";

export const dynamic = "force-dynamic";

export default async function PreparacaoPage({ searchParams }: { searchParams: Promise<{ finalizadas?: string }> }) {
  const perfil = await exigirPerfil("/preparacao");
  const { finalizadas } = await searchParams;
  const [{ itens }, atividades] = await Promise.all([getPreparacao(), getAtividades().catch(() => [])]);
  const editar = podeEditarPreparacao(perfil);
  const limite = finalizadas === "1" ? Infinity : 8;
  const abertasPorRef = new Map<string, number>();
  for (const a of atividades) if (a.aberta && a.ref) abertasPorRef.set(a.ref, (abertasPorRef.get(a.ref) ?? 0) + 1);

  const lanes: LaneVM[] = ETAPAS.map((etapa) => {
    const daEtapa = itens.filter((p) => p.etapa === etapa.id);
    const visiveis = etapa.id === "FINALIZADA" ? [...daEtapa].reverse().slice(0, limite) : daEtapa;
    const cards: CardVM[] = visiveis.map((p) => {
      const tags: CardVM["tags"] = [];
      const pend = abertasPorRef.get(p.id) ?? 0;
      if (etapa.id === "INSPEÇÃO" && !inspecaoCompleta(p as unknown as Record<string, string>)) tags.push({ txt: "checklist incompleto", tom: "warn" });
      if (etapa.id !== "FINALIZADA" && inspecaoCompleta(p as unknown as Record<string, string>) && !p.emailEnviado) tags.push({ txt: "e-mail pendente", tom: "warn" });
      if (pend) tags.push({ txt: `${pend} pendência${pend > 1 ? "s" : ""}`, tom: "orange" });
      if (etapa.id === "FORNECEDOR" && p.fornecedor) tags.push({ txt: p.fornecedor, tom: "" });
      if (etapa.id === "FORNECEDOR" && p.prazoEntrega) tags.push({ txt: `${p.atrasada ? "atrasada" : "prazo"} ${p.prazoEntrega.slice(0, 5)}`, tom: p.atrasada ? "bad" : "" });
      if (etapa.id === "FORNECEDOR" && !p.fotoPreparacao) tags.push({ txt: "foto no site", tom: "warn" });
      if (etapa.id === "FOTOS") tags.push({ txt: `${p.fotosOficiais || 0} fotos`, tom: "" });
      if (etapa.id === "FOTOS" && !p.postadoRedes) tags.push({ txt: "postar nas redes", tom: "warn" });
      if (etapa.id === "FINALIZADA" && p.dataFinalizacao) tags.push({ txt: `${p.dataFinalizacao.slice(0, 5)}${p.diasTotal != null ? ` · ${p.diasTotal}d` : ""}`, tom: "ok" });
      return { id: p.id, modelo: p.modelo, placa: p.placa, loja: p.loja, dias: etapa.id === "FINALIZADA" ? null : p.diasNaEtapa, tags };
    });
    return { id: etapa.id, label: etapa.label, curto: etapa.curto, total: daEtapa.length, cards, mais: daEtapa.length - visiveis.length };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Controle</div>
          <h1>Preparação</h1>
        </div>
        <div className="head-actions">
          <AtualizarDados />
          {editar && <Link href="/preparacao/nova" className="btn desktop-only"><Icon name="plus" size={16} /> Receber moto</Link>}
        </div>
      </div>
      <Board lanes={lanes} />
      {editar && <Fab href="/preparacao/nova" label="Receber moto" />}
    </>
  );
}
