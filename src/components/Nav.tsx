"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; icon: string; soon?: boolean };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Áreas">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(`${it.href}/`);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} prefetch>
            <Icon name={it.icon} />
            <span>{it.label}</span>
            {it.soon && <span className="soon">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );
}
