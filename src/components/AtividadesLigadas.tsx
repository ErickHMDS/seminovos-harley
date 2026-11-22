import Link from "next/link";
import type { Atividade } from "@/lib/atividades";

/** Atividades ligadas a uma moto ou a um lead (registro do que foi combinado/feito). */
export function AtividadesLigadas({ atividades, novoHref, className = "ficha-bloco" }: { atividades: Atividade[]; novoHref: string | null; className?: string }) {
  const lista = [...atividades].sort((a, b) => Number(b.aberta) - Number(a.aberta) || b.linha - a.linha).slice(0, 15);
  const abertas = atividades.filter((a) => a.aberta).length;
  return (
    <section className={`${className} atv-ligadas`}>
      <div className="sec-head">
        <h2 className={className === "sec" ? "sec-title" : undefined}>Atividades <span className="count-pill">{abertas}</span></h2>
        {novoHref && <Link href={novoHref} className="link-more">+ nova atividade</Link>}
      </div>
      {lista.length === 0 ? <p className="faint" style={{ margin: 0, fontSize: 14 }}>Nenhuma atividade registrada.</p> : (
        <ul className="atv-lista">
          {lista.map((a) => (
            <li key={a.id} className={a.aberta ? "" : "feita"}>
              <span className="dot-state" aria-label={a.aberta ? "aberta" : "resolvida"} />
              <div>
                <div>{a.descricao}</div>
                <small className="faint">
                  {[a.responsavel || (a.origem === "Inspeção 360" ? "Inspeção 360" : "Gestor"), a.criadaEm.split(",")[0], a.prazo && a.aberta ? `até ${a.prazo}` : "", !a.aberta ? `resolvida${a.resolucao ? `: ${a.resolucao}` : ""}` : ""].filter(Boolean).join(" · ")}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
