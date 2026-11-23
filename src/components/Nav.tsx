"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; short: string; icon: string; soon?: boolean; badge?: number; desktopOnly?: boolean; menu?: boolean };

/** Telas de venda acendem "Ranking" (gestor) ou "Meta" (vendedor, que não tem Ranking). */
const ativo = (path: string, href: string, vendasEm = "/ranking") => path === href || path.startsWith(`${href}/`) || (path.startsWith("/vendas") && href === vendasEm);

function Item({ it, path, vendasEm, cls = "" }: { it: NavItem; path: string; vendasEm: string; cls?: string }) {
  const classes = [it.desktopOnly ? "desktop-only" : "", cls].filter(Boolean).join(" ");
  return (
    <Link href={it.href} prefetch aria-current={ativo(path, it.href, vendasEm) ? "page" : undefined} className={classes || undefined} title={it.label}>
      <span className="nav-ico">
        <Icon name={it.icon} />
        {it.badge ? <span className="nav-badge">{it.badge > 99 ? "99+" : it.badge}</span> : null}
      </span>
      <span className="nav-long">{it.label}</span>
      <span className="nav-short">{it.short}</span>
    </Link>
  );
}

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const principais = items.filter((i) => !i.menu);
  const extras = items.filter((i) => i.menu);
  const mais = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (mais.current) mais.current.open = false; }, [path]);
  const vendasEm = items.some((i) => i.href === "/ranking") ? "/ranking" : "/meta";
  const extraAtivo = extras.some((i) => ativo(path, i.href, vendasEm));
  return (
    <nav className="nav" aria-label="Áreas">
      {principais.map((it) => <Item key={it.href} it={it} path={path} vendasEm={vendasEm} />)}
      {/* telas largas: os itens do "Mais" aparecem direto na barra (o CSS esconde o "Mais") */}
      {extras.map((it) => <Item key={`x-${it.href}`} it={it} path={path} vendasEm={vendasEm} cls="nav-extra" />)}
      {extras.length > 0 && (
        <details className="nav-mais desktop-only" ref={mais}>
          <summary aria-current={extraAtivo ? "page" : undefined}>
            <span className="nav-ico"><Icon name="mais" /></span><span className="nav-long">Mais</span><span aria-hidden className="nav-seta">▾</span>
          </summary>
          <div className="nav-mais-menu">{extras.map((it) => <Item key={it.href} it={{ ...it, desktopOnly: false }} path={path} vendasEm={vendasEm} />)}</div>
        </details>
      )}
    </nav>
  );
}
