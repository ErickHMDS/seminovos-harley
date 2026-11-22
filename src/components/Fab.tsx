"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/**
 * Botão flutuante de ação principal (celular). Renderizado direto no <body>: dentro da página,
 * a animação de entrada faria o "position: fixed" ficar relativo ao conteúdo e não à tela.
 */
export function Fab({ href, label }: { href: string; label: string }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => setAlvo(document.body), []);
  if (!alvo) return null;
  return createPortal(
    <Link href={href} className="fab mobile-only" aria-label={label} title={label}><Icon name="plus" size={26} /></Link>,
    alvo,
  );
}
