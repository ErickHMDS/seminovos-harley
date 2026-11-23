import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Nav, type NavItem } from "@/components/Nav";
import { NavProgress } from "@/components/NavProgress";
import { Icon } from "@/components/Icon";
import { Suspense } from "react";
import { PERFIS, podeAcessar, type Perfil } from "@/lib/auth";
import { getAtividades, visivelPara } from "@/lib/atividades";
import { monitoramento } from "@/lib/cobrancas";
import { leadsVisiveis, semSyonet } from "@/lib/leads";
import { sessaoAtual } from "@/lib/sessao";
import { aquecer } from "@/lib/aquecer";
import { sair } from "../actions";

type Item = NavItem & { soDesktopPara?: Perfil[]; menuPara?: Perfil[]; ocultoPara?: Perfil[] };
const ITENS: Item[] = [
  { href: "/gestor", label: "Gestor", short: "Painel", icon: "gestor" },
  { href: "/meta", label: "Minha meta", short: "Meta", icon: "meta", soDesktopPara: ["gestor"], menuPara: ["gestor"] },
  { href: "/ranking", label: "Ranking", short: "Ranking", icon: "ranking", soDesktopPara: ["gestor"] },
  { href: "/preparacao", label: "Preparação", short: "Preparo", icon: "preparacao", ocultoPara: ["vendedor"] },
  { href: "/estoque", label: "Estoque", short: "Estoque", icon: "estoque" },
  { href: "/leads", label: "Leads", short: "Leads", icon: "leads" },
  { href: "/atividades", label: "Atividades", short: "Tarefas", icon: "atividades" },
  { href: "/catalogo", label: "Catálogo", short: "Catálogo", icon: "catalogo", desktopOnly: true, menuPara: ["gestor"] },
  { href: "/cadastro", label: "Cadastro", short: "Cadastro", icon: "cadastro", desktopOnly: true, menuPara: ["gestor"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login?sair=1");
  const perfil = sessao.perfil;
  aquecer(perfil);
  // contador do menu: atividades em aberto de quem está logado (+ cobranças/Syonet)
  const atvs = await getAtividades().catch(() => []);
  const minhasAbertas = atvs.filter((a) => a.aberta && (perfil === "gestor" ? !a.pessoas.length : visivelPara(a, sessao))).length;
  const abertas =
    perfil === "gestor"
      ? minhasAbertas + (await monitoramento().catch(() => [])).length
      : perfil === "vendedor"
        ? (await leadsVisiveis(sessao).catch(() => [])).filter(semSyonet).length + minhasAbertas
        : minhasAbertas;
  const itens: NavItem[] = ITENS.filter((i) => podeAcessar(perfil, i.href) && !i.ocultoPara?.includes(perfil)).map(({ soDesktopPara, menuPara, ocultoPara: _o, ...i }) => ({
    ...i,
    label: i.href === "/meta" && perfil === "gestor" ? "Metas" : i.label,
    desktopOnly: i.desktopOnly || (soDesktopPara?.includes(perfil) ?? false),
    menu: menuPara?.includes(perfil) ?? false,
    badge: i.href === "/atividades" ? abertas : undefined,
  }));
  return (
    <>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="spacer" />
          <Nav items={itens} />
          <div className="user">
            <span className="who" title={`${sessao.nome} · ${PERFIS[perfil].label}`}><span className="who-dot" />{sessao.nome.split(" ")[0]}</span>
            <form action={sair}>
              <button className="link-btn" type="submit" title="Sair"><Icon name="sair" size={16} /><span className="sair-txt">Sair</span></button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
