import { AtualizarDados } from "@/components/AtualizarDados";
import { Fab } from "@/components/Fab";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { leadsComOportunidades } from "./dados";
import { LeadsView } from "./LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const s = await exigirSessao("/leads");
  const [leads, usuarios] = await Promise.all([leadsComOportunidades(s), s.perfil === "gestor" ? getUsuarios().catch(() => []) : Promise.resolve([])]);
  const vendedores = usuarios.filter((u) => u.perfil === "vendedor").map((u) => ({ id: u.id, nome: u.nome }));
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{s.perfil === "gestor" ? "Todos os vendedores" : "Seus clientes"}</div>
          <h1>Leads</h1>
          <p>Quando entra uma moto igual ou equivalente à que o cliente quer, ela aparece aqui para você ligar.</p>
        </div>
        <AtualizarDados />
      </div>
      <LeadsView leads={leads} gestor={s.perfil === "gestor"} vendedores={vendedores} nomeVendedor={s.nome} />
      <Fab href="/leads/novo" label="Novo lead" />
    </>
  );
}
