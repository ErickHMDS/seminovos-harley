import { AtualizarDados } from "@/components/AtualizarDados";
import { getCatalogo } from "@/lib/catalogo";
import { config } from "@/lib/config";
import { getEstoque } from "@/lib/estoque";
import { exigirPerfil } from "@/lib/sessao";
import { CatalogoView, type MotoEstoqueVM } from "./CatalogoView";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  await exigirPerfil("/catalogo");
  const [{ modelos, fonte }, { motos }] = await Promise.all([getCatalogo(), getEstoque().catch(() => ({ motos: [] }))]);
  const estoque: MotoEstoqueVM[] = motos.map((m) => ({
    placa: m.placa, modelo: m.modelo, fabricante: m.fabricante, segmento: m.segmento, catalogoId: m.catalogoId, dias: m.dias,
    preco: m.realinhamento, cidade: m.cidade, ano: m.ano, aba: m.aba, linha: m.linha,
  }));
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gestor</div>
          <h1>Catálogo de motos <span className="count-pill">{modelos.length}</span></h1>
          <p>Marcas, modelos, tipo e equivalências. Base do autocompletar da preparação e, em breve, dos leads.</p>
        </div>
        <AtualizarDados />
      </div>
      <CatalogoView modelos={modelos} fonte={fonte} estoque={estoque} aba={config.catalogoAba} />
    </>
  );
}
