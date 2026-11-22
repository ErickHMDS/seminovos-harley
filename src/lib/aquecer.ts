import "server-only";
import type { Perfil } from "./auth";
import { emSegundoPlano } from "./cache";

/**
 * Carrega em segundo plano os dados das abas que a pessoa usa, enquanto ela olha a tela atual:
 * a próxima troca de aba já encontra tudo no cache. Não atrasa a tela atual (os dados são os mesmos
 * que ela já pediria, e cada planilha é lida uma vez só).
 */
export function aquecer(perfil: Perfil) {
  const tarefas = async () => {
    const [{ getEstoque }, { getPreparacao }, { getFotos }, { getAtividades }, { getConfiguracoes }] = await Promise.all([
      import("./estoque"), import("./preparacao"), import("./fotos"), import("./atividades"), import("./configuracoes"),
    ]);
    const lista: Promise<unknown>[] = [getEstoque(), getPreparacao(), getFotos(), getAtividades(), getConfiguracoes()];
    if (perfil !== "preparador") {
      const [{ getVendas }, { getLeads }, { getCatalogo }] = await Promise.all([import("./vendas"), import("./leads"), import("./catalogo")]);
      lista.push(getVendas(), getLeads(), getCatalogo());
    }
    await Promise.allSettled(lista);
  };
  emSegundoPlano(tarefas());
}
