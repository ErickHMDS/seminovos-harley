import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Nav, type NavItem } from "@/components/Nav";
import { NavProgress } from "@/components/NavProgress";
import { Icon } from "@/components/Icon";
import { Suspense } from "react";
import { PERFIS, podeAcessar } from "@/lib/auth";
import { perfilAtual } from "@/lib/sessao";
import { sair } from "../actions";

const ITENS: NavItem[] = [
  { href: "/gestor", label: "Gestor", icon: "gestor" },
  { href: "/ranking", label: "Ranking", icon: "ranking" },
  { href: "/preparacao", label: "Preparação", icon: "preparacao" },
  { href: "/estoque", label: "Estoque", icon: "estoque" },
  { href: "/leads", label: "Leads", icon: "leads", soon: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const itens = ITENS.filter((i) => podeAcessar(perfil, i.href));
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
