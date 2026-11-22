import { headers } from "next/headers";
import { AtualizarDados } from "@/components/AtualizarDados";
import { emailsCoordenadores } from "@/lib/configuracoes";
import { exigirPerfil } from "@/lib/sessao";
import { getUsuarios } from "@/lib/usuarios";
import { getVendas, ranking } from "@/lib/vendas";
import { CadastroView, type PessoaVM, type VendedorVM } from "./CadastroView";

export const dynamic = "force-dynamic";

export default async function CadastroPage() {
  await exigirPerfil("/cadastro");
  const [usuarios, base, emails] = await Promise.all([getUsuarios().catch(() => []), getVendas(), emailsCoordenadores()]);
  const mes = base.meses[0];
  const rank = ranking(base.vendas.filter((v) => v.mes === mes), base.objetivos, true);
  const vendedores: VendedorVM[] = rank.map((l, i) => ({ nome: l.vendedor, curto: l.nome, pos: i + 1, vendas: l.vendas, objetivo: l.objetivo }));
  const pessoas: PessoaVM[] = usuarios.map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil, vendedor: u.vendedor, telefone: u.telefone, ativo: u.ativo, atualizadoEm: u.atualizadoEm }));
  const h = await headers();
  const origem = `${(h.get("x-forwarded-proto") ?? "https").split(",")[0]}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Gestor</div>
          <h1>Cadastro</h1>
          <p>Equipe com acesso ao app, senhas individuais e configurações.</p>
        </div>
        <AtualizarDados />
      </div>
      <CadastroView pessoas={pessoas} vendedores={vendedores} emails={emails} url={origem} />
    </>
  );
}
