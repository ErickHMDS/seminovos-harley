import Link from "next/link";
import { notFound } from "next/navigation";
import { podeEditarPreparacao } from "@/lib/auth";
import { getAtividades } from "@/lib/atividades";
import { inspecaoCompleta, listaEmails, montarEmail } from "@/lib/checklist";
import { getCatalogo } from "@/lib/catalogo";
import { config } from "@/lib/config";
import { emailsCoordenadores } from "@/lib/configuracoes";
import { rotuloAba } from "@/lib/lojas";
import { motoPorPlaca } from "@/lib/estoque";
import { ETAPAS, getItem } from "@/lib/preparacao";
import { exigirPerfil } from "@/lib/sessao";
import { EmailCard } from "../EmailCard";
import { PrepForm } from "../PrepForm";

export const dynamic = "force-dynamic";

const MSG: Record<string, string> = {
  registrar: "Inspeção 360 registrada na planilha.",
  salvar: "Alterações salvas.",
  avancar: "Moto avançou para a próxima etapa.",
  voltar: "Moto voltou para a etapa anterior.",
};

const MSG_ESTOQUE: Record<string, { txt: string; tom: string }> = {
  ok: { txt: "Moto incluída no estoque com status EM PREPARAÇÃO.", tom: "ok" },
  existente: { txt: "A placa já estava no estoque — nada foi duplicado.", tom: "ok" },
  anunciado: { txt: "Status no estoque alterado para ANUNCIADO.", tom: "ok" },
  erro: { txt: "A preparação foi salva, mas não foi possível incluir a moto no estoque. Cadastre pelo Estoque.", tom: "bad" },
};

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string; estoque?: string }> }) {
  const perfil = await exigirPerfil("/preparacao");
  const { id } = await params;
  const { salvo, estoque } = await searchParams;
  const { modelos } = await getCatalogo();
  const item = await getItem(decodeURIComponent(id));
  if (!item) notFound();
  const atividades = (await getAtividades().catch(() => [])).filter((a) => a.ref === item.id);
  const idx = ETAPAS.findIndex((e) => e.id === item.etapa);
  const plano = Object.fromEntries(Object.entries(item).map(([k, v]) => [k, String(v ?? "")])) as Record<string, string> & { etapa: string };
  const email = montarEmail(plano);
  const editar = podeEditarPreparacao(perfil);
  const abertas = atividades.filter((a) => a.aberta);
  const moto = item.placa ? await motoPorPlaca(item.placa).catch(() => null) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/preparacao" className="back-link">← Preparação</Link>
          <h1 className="title-moto">{item.modelo || "Moto"} {item.placa && <span className="plate">{item.placa}</span>}</h1>
          <p className="meta-line">
            {item.dataRecepcao && <>Recebida {item.dataRecepcao}</>}
            {item.diasTotal != null && <> · {item.diasTotal}d em preparação</>}
            {item.responsavel && <> · {item.responsavel}</>}
          </p>
          {moto && <Link href={`/estoque/ver?${new URLSearchParams({ aba: moto.aba, linha: String(moto.linha) })}`} className="btn small ghost" style={{ marginTop: 10 }}>Ficha e fotos da moto →</Link>}
        </div>
      </div>

      <ol className="steps" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <li key={e.id} className={`step ${i < idx ? "done" : i === idx ? "now" : ""}`}>
            <span className="step-dot">{i < idx ? "✓" : i + 1}</span>
            <span className="step-txt">{e.curto}</span>
          </li>
        ))}
      </ol>

      {salvo && MSG[salvo] && <div className="alert ok toast" role="status">{MSG[salvo]}</div>}
      {estoque && MSG_ESTOQUE[estoque] && <div className={`alert ${MSG_ESTOQUE[estoque].tom} ${MSG_ESTOQUE[estoque].tom === "ok" ? "toast" : ""}`} role="status">{MSG_ESTOQUE[estoque].txt}</div>}

      {inspecaoCompleta(plano) && (
        <EmailCard id={item.id} para={listaEmails(await emailsCoordenadores())} assunto={email.assunto} corpo={email.corpo}
          enviadoEm={item.emailEnviado} editar={editar} destaque={salvo === "registrar" || item.etapa === "INSPEÇÃO"} />
      )}

      {atividades.length > 0 && (
        <section className="mini-tasks">
          <div className="mini-tasks-head">
            <strong>Pendências com o gestor</strong>
            <span className={`badge ${abertas.length ? "warn" : "ok"}`}>{abertas.length ? `${abertas.length} aberta${abertas.length > 1 ? "s" : ""}` : "todas resolvidas"}</span>
          </div>
          <ul>
            {atividades.map((a) => (
              <li key={a.id} className={a.aberta ? "" : "done"}><span className="dot-state" />{a.descricao}{!a.aberta && a.resolucao ? <span className="faint"> — {a.resolucao}</span> : null}</li>
            ))}
          </ul>
        </section>
      )}

      <PrepForm item={plano} editar={editar} sugestoes={[]} catalogo={modelos} lojas={config.estoqueAbas.map((aba) => ({ label: rotuloAba(aba), aba, empresas: [] }))} />
    </>
  );
}
