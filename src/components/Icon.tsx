const PATHS: Record<string, React.ReactNode> = {
  gestor: (<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  ranking: (<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 6h2.5a1.5 1.5 0 0 1 0 3H17" /><path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7" /></>),
  preparacao: (<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.2-.6-.6-2.2 2.5-2.5Z" />),
  estoque: (<><path d="M3 8.5 12 4l9 4.5v9L12 22l-9-4.5v-9Z" /><path d="m3 8.5 9 4.5 9-4.5" /><path d="M12 13v9" /></>),
  leads: (<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />),
  atividades: (<><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="m8.5 12.5 2 2 4-4" /></>),
  catalogo: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /><path d="M9 7h6" /><path d="M9 11h4" /></>),
  cadastro: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M19 8v6" /><path d="M16 11h6" /></>),
  meta: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  filtro: (<><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>),
  sair: (<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H4" /></>),
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {PATHS[name]}
    </svg>
  );
}
