import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Nav, type NavItem } from "@/components/Nav";
import { NavProgress } from "@/components/NavProgress";
import { Icon } from "@/components/Icon";
import { Suspense } from "react";
import { PERFIS, podeAcessar } from "@/lib/auth";
import { getAtividades } from "@/lib/atividades";
import { perfilAtual } from "@/lib/sessao";
import { sair } from "../actions";

const ITENS: NavItem[] = [
  { href: "/gestor", label: "Gestor", short: "Painel", icon: "gestor" },
  { href: "/ranking", label: "Ranking", short: "Ranking", icon: "ranking" },
  { href: "/preparacao", label: "Preparação", short: "Preparo", icon: "preparacao" },
  { href: "/estoque", label: "Estoque", short: "Estoque", icon: "estoque" },
  { href: "/atividades", label: "Atividades", short: "Tarefas", icon: "atividades" },
  { href: "/catalogo", label: "Catálogo", short: "Catálogo", icon: "catalogo", desktopOnly: true },
  { href: "/leads", label: "Leads", short: "Leads", icon: "leads", soon: true, desktopOnly: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const abertas = perfil === "gestor" ? (await getAtividades().catch(() => [])).filter((a) => a.aberta).length : 0;
  const itens = ITENS.filter((i) => podeAcessar(perfil, i.href)).map((i) => (i.href === "/atividades" ? { ...i, badge: abertas } : i));
  return (
    <>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="spacer" />
          <Nav items={itens} />
          <div className="user">
            <span className="who"><span className="who-dot" />{PERFIS[perfil].label}</span>
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
