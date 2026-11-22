import Link from "next/link";
import { getCatalogo } from "@/lib/catalogo";
import { exigirSessao } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { LeadForm } from "../LeadForm";

export const dynamic = "force-dynamic";

export default async function NovoLeadPage() {
  const s = await exigirSessao("/leads");
  const [{ modelos }, usuarios] = await Promise.all([getCatalogo(), s.perfil === "gestor" ? getUsuarios().catch(() => []) : Promise.resolve([])]);
  return (
    <>
      <div className="page-head"><div><Link href="/leads" className="back-link">← Leads</Link><h1>Novo lead</h1><p>Quem é o cliente e qual moto ele quer.</p></div></div>
      <LeadForm lead={null} catalogo={modelos} vendedores={usuarios.filter((u) => u.perfil === "vendedor" && u.ativo).map((u) => ({ id: u.id, nome: u.nome }))} />
    </>
  );
}
