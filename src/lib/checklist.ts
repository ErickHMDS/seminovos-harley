/** Checklist da inspeção 360 — compartilhado entre a tela (cliente) e o servidor. */

export type TipoItem = "simnao" | "item";
export type EstadoItem = "ok" | "pendente" | "vazio";

export const CHECKLIST = [
  { campo: "manual", label: "Manual do proprietário", tipo: "simnao", tarefa: "Providenciar manual do proprietário" },
  { campo: "chaveReserva", label: "Chave reserva", tipo: "simnao", tarefa: "Providenciar chave reserva" },
  { campo: "documentacao", label: "Documentação (CRLV)", tipo: "item", tarefa: "Regularizar documentação" },
  { campo: "revisaoEmDia", label: "Revisões em dia", tipo: "item", tarefa: "Colocar revisões em dia" },
  { campo: "pneus", label: "Pneus", tipo: "item", tarefa: "Resolver pneus" },
  { campo: "freios", label: "Freios", tipo: "item", tarefa: "Resolver freios" },
  { campo: "eletrica", label: "Elétrica e bateria", tipo: "item", tarefa: "Resolver elétrica/bateria" },
  { campo: "riscos", label: "Pintura e riscos", tipo: "item", tarefa: "Tratar pintura/riscos" },
  { campo: "sujeira", label: "Limpeza", tipo: "item", tarefa: "Providenciar limpeza" },
  { campo: "estetica", label: "Detalhes estéticos", tipo: "item", tarefa: "Resolver detalhes estéticos" },
] as const satisfies readonly { campo: string; label: string; tipo: TipoItem; tarefa: string }[];

export type CampoChecklist = (typeof CHECKLIST)[number]["campo"];
type Def = (typeof CHECKLIST)[number];

/** Interpreta o valor gravado na planilha. Textos antigos (ex.: "risco no tanque") contam como pendência. */
export function lerItem(def: Def, valor: string | undefined): { estado: EstadoItem; obs: string } {
  const v = (valor ?? "").trim();
  if (!v) return { estado: "vazio", obs: "" };
  if (def.tipo === "simnao") {
    if (/^s(im)?$/i.test(v)) return { estado: "ok", obs: "" };
    const m = v.match(/^n[aã]o\s*[-:–]?\s*(.*)$/i);
    if (m) return { estado: "pendente", obs: m[1] ?? "" };
  }
  if (/^ok\b/i.test(v)) return { estado: "ok", obs: v.replace(/^ok\s*[-:–]?\s*/i, "") };
  const p = v.match(/^pendente\s*[-:–]?\s*(.*)$/i);
  if (p) return { estado: "pendente", obs: p[1] ?? "" };
  return { estado: "pendente", obs: v };
}

/** Valor a gravar na planilha. */
export function gravarItem(def: Def, estado: EstadoItem, obs: string): string {
  const o = obs.trim();
  if (estado === "vazio") return "";
  if (def.tipo === "simnao") return estado === "ok" ? "SIM" : o ? `NÃO - ${o}` : "NÃO";
  return estado === "ok" ? "OK" : o ? `PENDENTE: ${o}` : "PENDENTE";
}

export type Pendencia = { campo: CampoChecklist; label: string; tarefa: string; obs: string };

export function pendencias(p: Partial<Record<string, string>>): Pendencia[] {
  return CHECKLIST.flatMap((def) => {
    const { estado, obs } = lerItem(def, p[def.campo]);
    return estado === "pendente" ? [{ campo: def.campo, label: def.label, tarefa: def.tarefa, obs }] : [];
  });
}

export function inspecaoCompleta(p: Partial<Record<string, string>>): boolean {
  return CHECKLIST.every((def) => lerItem(def, p[def.campo]).estado !== "vazio");
}

/** E-mail para os coordenadores ao concluir a inspeção 360. */
export function montarEmail(p: Partial<Record<string, string>>): { assunto: string; corpo: string } {
  const g = (k: string) => (p[k] ?? "").trim() || "—";
  const linhasChecklist = CHECKLIST.map((def) => {
    const { estado, obs } = lerItem(def, p[def.campo]);
    const marca = estado === "ok" ? "OK" : estado === "pendente" ? "PENDENTE" : "não verificado";
    return `• ${def.label}: ${marca}${obs ? ` — ${obs}` : ""}`;
  });
  const pend = pendencias(p);
  const corpo = [
    `Inspeção 360 concluída: ${g("modelo")} · placa ${g("placa")}`,
    "",
    "MOTO",
    `• Modelo: ${g("modelo")}   • Placa: ${g("placa")}   • Chassi: ${g("chassi")}`,
    `• Cor: ${g("cor")}   • Ano: ${g("ano")}   • Km: ${g("km")}`,
    `• Loja: ${g("loja")}   • Recebida em: ${g("dataRecepcao")}   • Responsável: ${g("responsavel")}`,
    `• Última revisão: ${g("ultimaRevisao")}`,
    "",
    "CHECKLIST 360",
    ...linhasChecklist,
    "",
    pend.length ? `PENDÊNCIAS (${pend.length}) — enviadas ao gestor como atividades` : "PENDÊNCIAS: nenhuma",
    ...pend.map((x) => `• ${x.tarefa}${x.obs ? `: ${x.obs}` : ""}`),
    "",
    "SERVIÇOS NECESSÁRIOS",
    g("servicos"),
    "",
    `Fornecedor: ${g("fornecedor")}   • Saída: ${g("dataSaida")}   • Prazo: ${g("prazoEntrega")}`,
    `Observações: ${g("observacoes")}`,
  ].join("\n");
  return { assunto: `Inspeção 360 · ${g("modelo")} · ${g("placa")}${pend.length ? ` · ${pend.length} pendência(s)` : ""}`, corpo };
}

/** Aceita "a@x.com; b@y.com" ou "a@x.com, b@y.com". */
export function listaEmails(v: string): string {
  return v.split(/[;,\s]+/).map((s) => s.trim()).filter(Boolean).join(",");
}

export type ResumoChecklist = {
  geral: "ok" | "pendente" | "incompleto";
  pendentes: number;
  itens: { label: string; estado: EstadoItem; obs: string }[];
  prepId: string; etapa: string; recebida: string; ultimaRevisao: string; responsavel: string;
};

/** Resumo do checklist 360 de uma moto (para o estoque e a ficha da moto). */
export function resumoChecklist(p: Partial<Record<string, string>>): ResumoChecklist {
  const itens = CHECKLIST.map((def) => ({ label: def.label, ...lerItem(def, p[def.campo]) }));
  const pendentes = itens.filter((i) => i.estado === "pendente").length;
  const vazios = itens.filter((i) => i.estado === "vazio").length;
  return {
    geral: pendentes ? "pendente" : vazios ? "incompleto" : "ok", pendentes, itens,
    prepId: p.id ?? "", etapa: p.etapa ?? "", recebida: p.dataRecepcao ?? "", ultimaRevisao: p.ultimaRevisao ?? "", responsavel: p.responsavel ?? "",
  };
}
