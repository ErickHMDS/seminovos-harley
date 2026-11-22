import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AtividadesLigadas } from "@/components/AtividadesLigadas";
import { ChecklistResumo } from "@/components/ChecklistResumo";
import { atividadesDaPlaca } from "@/lib/atividades";
import { getMoto, motoPorPlaca } from "@/lib/estoque";
import { armazenamentoConfigurado, fotosDaPlaca } from "@/lib/fotos";
import { linkPasta, pastaConfigurada, pastaDaPlaca } from "@/lib/drive";
import { fmt } from "@/lib/parse";
import { checklistPorPlaca, getPreparacao } from "@/lib/preparacao";
import { exigirSessao } from "@/lib/sessao";
import { leadsComOportunidades } from "../../leads/dados";
import { Galeria } from "../Galeria";
import { Compartilhar } from "./Compartilhar";

export const dynamic = "force-dynamic";

const tomDias = (d: number | null) => (d == null ? "" : d > 90 ? "bad" : d > 60 ? "warn" : "ok");

export default async function FichaMotoPage({ searchParams }: { searchParams: Promise<{ aba?: string; linha?: string; placa?: string; salvo?: string }> }) {
  const s = await exigirSessao("/estoque");
  const { aba = "", linha = "", placa = "", salvo } = await searchParams;
  const m = placa ? await motoPorPlaca(placa) : await getMoto(aba, Number(linha));
  if (!m && placa) {
    // ainda não entrou no estoque: mostra a moto na preparação
    const p = (await getPreparacao().catch(() => null))?.itens.filter((x) => x.placa.toUpperCase() === placa.toUpperCase()).pop();
    if (p) redirect(`/preparacao/${encodeURIComponent(p.id)}`);
  }
  if (!m) notFound();
  const [fotos, checklists, leads] = await Promise.all([
    fotosDaPlaca(m.placa), checklistPorPlaca().catch(() => ({} as Awaited<ReturnType<typeof checklistPorPlaca>>)),
    s.perfil === "preparador" ? Promise.resolve([]) : leadsComOportunidades(s).catch(() => []),
  ]);
  const interessados = leads.flatMap((l) => l.matches.filter((x) => x.placa === m.placa).map((x) => ({ l, tipo: x.tipoMatch })));
  const gestor = s.perfil === "gestor";
  const fipeDif = m.realinhamento != null && m.fipe != null ? m.fipe - m.realinhamento : null;
  const margem = m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : null;
  const descricao = [
    `${m.fabricante ? `${m.fabricante} ` : ""}${m.modelo}`,
    [m.ano && `Ano ${m.ano}`, m.km != null && `${fmt.int(m.km)} km`, m.cor && m.cor.toLowerCase()].filter(Boolean).join(" · "),
    m.realinhamento != null ? `Por ${fmt.brl(m.realinhamento)}` : "",
    `Servopa Seminovos · ${m.cidade}`,
  ].filter(Boolean).join("\n");

  const specs: [string, string][] = [
    ["Ano", m.ano || "—"], ["Km", m.km != null ? fmt.int(m.km) : "—"], ["Cor", m.cor ? m.cor.toLowerCase() : "—"],
    ["Tipo", m.tipo || "—"], ["Loja", `${m.cidade} · ${m.empresa}`], ["Entrada", fmt.date(m.dataEntrada ? new Date(m.dataEntrada) : null)],
    ["Segmento", m.segmento || "—"], ["Status", m.status.toLowerCase()],
  ];

  return (
    <>
      <div className="page-head">
        <div><Link href="/estoque" className="back-link">← Estoque</Link></div>
        {gestor && <Link href={`/estoque/moto?${new URLSearchParams({ aba: m.aba, linha: String(m.linha) })}`} className="btn small ghost">Editar dados</Link>}
      </div>
      {salvo === "atividade" && <div className="alert ok toast" role="status" style={{ marginBottom: 12 }}>Atividade registrada nesta moto.</div>}
      <div className="ficha">
        <Galeria fotos={fotos.map((f) => ({ id: f.id, url: f.url }))} placa={m.placa} editar={s.perfil !== "vendedor"} modelo={m.modelo} armazenamento={armazenamentoConfigurado()} drive={!!(await pastaConfigurada().catch(() => null))} pastaDrive={s.perfil !== "vendedor" ? await pastaDaPlaca(m.placa).then((p) => (p ? linkPasta(p.id) : null)).catch(() => null) : null} />
        <div className="ficha-info">
          <div className="eyebrow">{[m.fabricante, m.tipo].filter(Boolean).join(" · ") || "Seminovo"}</div>
          <h1 className="ficha-titulo">{m.modelo}</h1>
          <div className="ficha-tags">
            <span className="plate">{m.placa}</span>
            <span className={`badge ${tomDias(m.dias)}`}>{m.dias ?? "—"} dias em estoque</span>
            <span className={`badge ${m.anunciada ? "ok" : "warn"}`}>{m.status.toLowerCase()}</span>
          </div>
          <div className="ficha-preco">
            <div><span className="filter-label">Preço</span><strong>{m.realinhamento != null ? fmt.brl(m.realinhamento) : "sem preço"}</strong></div>
            {m.fipe != null && <div><span className="filter-label">FIPE</span><span>{fmt.brl(m.fipe)}</span>{fipeDif != null && <small className={fipeDif >= 0 ? "ok-txt" : "warn-txt"}>{fipeDif >= 0 ? `${fmt.brl(fipeDif)} abaixo da FIPE` : `${fmt.brl(-fipeDif)} acima da FIPE`}</small>}</div>}
            {gestor && m.custo != null && <div><span className="filter-label">Custo</span><span>{fmt.brl(m.custo)}</span>{margem != null && <small className={margem >= 0 ? "ok-txt" : "warn-txt"}>margem {fmt.brl(margem)}</small>}</div>}
          </div>
          <dl className="ficha-specs">{specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {m.observacao && <p className="ficha-obs">{m.observacao}</p>}
          <Compartilhar texto={descricao} />

          <section className="ficha-bloco">
            <h2>Preparação</h2>
            <ChecklistResumo r={checklists[m.placa]} />
          </section>

          {s.perfil !== "preparador" && (
            <section className="ficha-bloco">
              <h2>{s.perfil === "gestor" ? "Clientes interessados" : "Seus clientes interessados"} <span className="count-pill">{interessados.length}</span></h2>
              {interessados.length === 0 ? <p className="faint" style={{ margin: 0, fontSize: 14 }}>Nenhum lead procurando esta moto (ou equivalente) agora.</p> : (
                <ul className="simple-list">
                  {interessados.map(({ l, tipo }) => (
                    <li key={l.id}><Link href={`/leads/${l.id}`} className="simple-row">
                      <span className={`badge ${tipo === "exato" ? "ok" : "accent"}`}>{tipo === "exato" ? "exato" : "equivalente"}</span>
                      <span className="simple-main">{l.cliente}<small>quer {l.desejo}{gestor ? ` · ${l.vendedor}` : ""}</small></span>
                      <span className="link-more">ligar →</span>
                    </Link></li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {s.perfil !== "preparador" && (
            <AtividadesLigadas atividades={(await atividadesDaPlaca(m.placa).catch(() => [])).filter((a) => s.perfil === "gestor" || a.responsavelId === s.uid || a.origem !== "Vendedor")}
              novoHref={`/atividades/nova?${new URLSearchParams({ placa: m.placa, volta: `/estoque/ver?placa=${m.placa}` })}`} />
          )}
        </div>
      </div>
    </>
  );
}
