import Link from "next/link";
import { Atualizado } from "@/components/ui";
import { podeEditarPreparacao } from "@/lib/auth";
import { config } from "@/lib/config";
import { ETAPAS, getPreparacao } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function PreparacaoPage({ searchParams }: { searchParams: Promise<{ finalizadas?: string }> }) {
  const perfil = await exigirPerfil("/preparacao");
  const { finalizadas } = await searchParams;
  const { itens, abaExiste, colunasFaltando } = await getPreparacao();
  const editar = podeEditarPreparacao(perfil);
  const mostrarFinalizadas = finalizadas === "1";
  const limiteFinalizadas = mostrarFinalizadas ? Infinity : 8;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Controle de preparação</div>
          <h1>Preparação</h1>
          <p>Da recepção da moto até as fotos oficiais nas redes de venda.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Atualizado em={new Date().toISOString()} />
          {editar && <Link href="/preparacao/nova" className="btn">+ Receber moto</Link>}
        </div>
      </div>

      {editar && colunasFaltando.length > 0 && (
        <div className="alert" style={{ marginBottom: 16 }}>
          {abaExiste ? (
            <>Na primeira moto registrada, o app vai acrescentar {colunasFaltando.length} colunas à direita da aba <b>{config.preparacaoAba}</b> (as colunas atuais continuam iguais).</>
          ) : (
            <>A aba <b>{config.preparacaoAba}</b> será criada na planilha de estoque quando a primeira moto for registrada.</>
          )}
        </div>
      )}

      <div className="board">
        {ETAPAS.map((etapa, i) => {
          const daEtapa = itens.filter((p) => p.etapa === etapa.id);
          const visiveis = etapa.id === "FINALIZADA" ? [...daEtapa].reverse().slice(0, limiteFinalizadas) : daEtapa;
          return (
            <section className="lane" key={etapa.id} aria-label={etapa.label}>
              <div className="lane-head">
                <h3><span className="lane-step">{i + 1}</span>{etapa.label}</h3>
                <span className="lane-count">{daEtapa.length}</span>
              </div>
              <div className="lane-body">
                {visiveis.map((p) => (
                  <Link key={p.id} href={`/preparacao/${encodeURIComponent(p.id)}`} className="card">
                    <div className="card-title">{p.modelo || "Modelo não informado"}</div>
                    <div className="card-meta">
                      {p.placa && <span className="plate">{p.placa}</span>}
                      {p.loja && <span>{p.loja}</span>}
                      {p.diasNaEtapa != null && etapa.id !== "FINALIZADA" && <span>{p.diasNaEtapa}d nesta etapa</span>}
                    </div>
                    <div className="card-meta">
                      {etapa.id === "FORNECEDOR" && p.fornecedor && <span>🔧 {p.fornecedor}</span>}
                      {etapa.id === "FORNECEDOR" && p.prazoEntrega && <span className={`badge ${p.atrasada ? "bad" : ""}`}>{p.atrasada ? "atrasada · " : "prazo "}{p.prazoEntrega}</span>}
                      {etapa.id === "FORNECEDOR" && !p.emailEnviado && <span className="badge warn">e-mail pendente</span>}
                      {etapa.id === "FORNECEDOR" && !p.fotoPreparacao && <span className="badge warn">foto no site pendente</span>}
                      {etapa.id === "FOTOS" && <span className="badge">{p.fotosOficiais || 0} fotos</span>}
                      {etapa.id === "FOTOS" && !p.postadoRedes && <span className="badge warn">postar nas redes</span>}
                      {etapa.id === "FINALIZADA" && p.dataFinalizacao && <span>finalizada em {p.dataFinalizacao}{p.diasTotal != null ? ` · ${p.diasTotal}d no total` : ""}</span>}
                    </div>
                  </Link>
                ))}
                {daEtapa.length === 0 && <div className="empty">Nenhuma moto</div>}
                {etapa.id === "FINALIZADA" && daEtapa.length > visiveis.length && (
                  <Link href="?finalizadas=1" className="link-btn" style={{ textAlign: "center" }}>Ver todas ({daEtapa.length})</Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
