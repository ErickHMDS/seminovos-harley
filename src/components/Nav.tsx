"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; short: string; icon: string; soon?: boolean; badge?: number; desktopOnly?: boolean };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Áreas">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(`${it.href}/`) || (it.href === "/ranking" && path.startsWith("/vendas"));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={it.desktopOnly ? "desktop-only" : undefined}>
            <span className="nav-ico">
              <Icon name={it.icon} />
              {it.badge ? <span className="nav-badge">{it.badge > 99 ? "99+" : it.badge}</span> : null}
            </span>
            <span className="nav-long">{it.label}</span>
            <span className="nav-short">{it.short}</span>
            {it.soon && <span className="soon">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );
}
