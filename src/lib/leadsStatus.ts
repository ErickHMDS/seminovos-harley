/** Status de lead (compartilhado entre servidor e tela). */
export const STATUS = [
  { id: "NOVO", label: "Novo", tom: "accent" },
  { id: "EM CONTATO", label: "Em contato", tom: "warn" },
  { id: "NEGOCIANDO", label: "Negociando", tom: "warn" },
  { id: "VENDIDO", label: "Vendido", tom: "ok" },
  { id: "PERDIDO", label: "Perdido", tom: "" },
] as const;
export const statusDe = (id: string) => STATUS.find((s) => s.id === id) ?? STATUS[0];
