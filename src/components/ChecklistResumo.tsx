import Link from "next/link";
import type { ResumoChecklist } from "@/lib/checklist";

/** Checklist 360 de uma moto: verde = OK, vermelho = pendente (não oferecer ainda), cinza = não verificado. */
export function ChecklistResumo({ r, compacto = false }: { r: ResumoChecklist | null | undefined; compacto?: boolean }) {
  if (!r) return <div className="ckr-vazio">Sem registro de preparação para esta moto.</div>;
  return (
    <div className={`ckr ${compacto ? "compacto" : ""}`}>
      <div className={`ckr-geral ${r.geral}`}>
        {r.geral === "ok" ? "✓ Tudo certo — pode oferecer" : r.geral === "pendente" ? `⚠ ${r.pendentes} pendência${r.pendentes > 1 ? "s" : ""} — confira antes de oferecer` : "Checklist incompleto"}
      </div>
      <ul className="ckr-lista">
        {r.itens.map((i) => (
          <li key={i.label} className={`ckr-item ${i.estado}`}>
            <span className="ckr-ico" aria-hidden>{i.estado === "ok" ? "✓" : i.estado === "pendente" ? "!" : "–"}</span>
            <span className="ckr-label">{i.label}</span>
            <span className="ckr-val">{i.estado === "ok" ? "OK" : i.estado === "pendente" ? i.obs || "Pendente" : "não verificado"}</span>
          </li>
        ))}
      </ul>
      <div className="ckr-rodape">
        {r.recebida && <span>Recebida {r.recebida}</span>}
        {r.ultimaRevisao && <span>Última revisão: {r.ultimaRevisao}</span>}
        {r.prepId && <Link href={`/preparacao/${encodeURIComponent(r.prepId)}`} className="link-more">ver preparação →</Link>}
      </div>
    </div>
  );
}
