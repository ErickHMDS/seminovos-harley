import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Nav, type NavItem } from "@/components/Nav";
import { PERFIS, podeAcessar } from "@/lib/auth";
import { perfilAtual } from "@/lib/sessao";
import { sair } from "../actions";

const ITENS: NavItem[] = [
  { href: "/gestor", label: "Gestor", icon: "◆" },
  { href: "/ranking", label: "Ranking", icon: "▲" },
  { href: "/preparacao", label: "Preparação", icon: "⚙" },
  { href: "/estoque", label: "Estoque", icon: "▦" },
  { href: "/leads", label: "Leads", icon: "☎", soon: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const itens = ITENS.filter((i) => podeAcessar(perfil, i.href));
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="spacer" />
          <Nav items={itens} />
          <div className="user">
            <span className="who">{PERFIS[perfil].label}</span>
            <form action={sair}>
              <button className="link-btn" type="submit">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
