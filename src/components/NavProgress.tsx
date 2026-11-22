"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Barra fina no topo que aparece ao trocar de página (o app busca dados da planilha a cada
 * navegação, então isso dá retorno imediato ao clique).
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [estado, setEstado] = useState<"parado" | "indo" | "fim">("parado");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // terminou de navegar
  useEffect(() => {
    setEstado((e) => (e === "indo" ? "fim" : e));
    const t = setTimeout(() => setEstado((e) => (e === "fim" ? "parado" : e)), 400);
    return () => clearTimeout(t);
  }, [path, search]);

  // começou: clique em link interno
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setEstado("indo");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setEstado("parado"), 15000); // segurança
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <div className={`nav-progress ${estado}`} aria-hidden />;
}
