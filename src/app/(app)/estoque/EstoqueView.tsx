"use client";
import { useMemo, useState } from "react";
import type { Moto } from "@/lib/estoque";
import { fmt } from "@/lib/parse";

const FAIXAS = [
  { id: "0-30", label: "≤ 30 dias", min: 0, max: 30 },
  { id: "31-60", label: "31–60", min: 31, max: 60 },
  { id: "61-90", label: "61–90", min: 61, max: 90 },
  { id: "90+", label: "> 90 dias", min: 91, max: Infinity },
];

function tomDias(d: number | null) {
  if (d == null) return "";
  if (d > 90) return "bad";
  if (d > 60) return "warn";
  return "ok";
}

type Ordem = "dias" | "preco" | "modelo" | "margem";

export function EstoqueView({ motos, verCusto, emPreparacao }: { motos: Moto[]; verCusto: boolean; emPreparacao: Record<string, string> }) {
  const [busca, setBusca] = useState("");
  const [cidade, setCidade] = useState("");
  const [marca, setMarca] = useState("");
  const [status, setStatus] = useState("");
  const [faixa, setFaixa] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("dias");

  const cidades = useMemo(() => [...new Set(motos.map((m) => m.cidade))].sort(), [motos]);
  const statuses = useMemo(() => [...new Set(motos.map((m) => m.status))].sort(), [motos]);

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const f = FAIXAS.find((x) => x.id === faixa);
    const out = motos.filter(
      (m) =>
        (!q || m.placa.includes(q) || m.modelo.includes(q) || m.cor.includes(q)) &&
        (!cidade || m.cidade === cidade) &&
        (!marca || m.marca === marca) &&
        (!status || m.status === status) &&
        (!f || (m.dias != null && m.dias >= f.min && m.dias <= f.max)),
    );
    const margem = (m: Moto) => (m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : -Infinity);
    out.sort((a, b) =>
      ordem === "dias" ? (b.dias ?? -1) - (a.dias ?? -1)
      : ordem === "preco" ? (b.realinhamento ?? 0) - (a.realinhamento ?? 0)
      : ordem === "margem" ? margem(b) - margem(a)
      : a.modelo.localeCompare(b.modelo),
    );
    return out;
  }, [motos, busca, cidade, marca, status, faixa, ordem]);

  const idadeMedia = lista.length ? Math.round(lista.reduce((s, m) => s + (m.dias ?? 0), 0) / lista.length) : 0;
  const acima90 = lista.filter((m) => (m.dias ?? 0) > 90).length;
  const naoAnunciadas = lista.filter((m) => !m.anunciada).length;
  const custoTotal = lista.reduce((s, m) => s + (m.custo ?? 0), 0);
  const precoTotal = lista.reduce((s, m) => s + (m.realinhamento ?? 0), 0);
  const margemTotal = lista.reduce((s, m) => s + (m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : 0), 0);

  const chip = (ativo: boolean, onClick: () => void, label: string) => (
    <button type="button" className="chip" aria-pressed={ativo} onClick={onClick}>{label}</button>
  );

  return (
    <>
      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <div className="kpi accent"><div className="kpi-label">Motos em estoque</div><div className="kpi-value">{lista.length}</div><div className="kpi-sub">{naoAnunciadas} sem anúncio</div></div>
        <div className="kpi"><div className="kpi-label">Idade média</div><div className="kpi-value">{idadeMedia}<span style={{ fontSize: "1rem" }}> dias</span></div></div>
        <div className={`kpi ${acima90 ? "bad" : ""}`}><div className="kpi-label">Paradas há + de 90 dias</div><div className="kpi-value">{acima90}</div><div className="kpi-sub">{fmt.pct(lista.length ? acima90 / lista.length : null)} do estoque</div></div>
        {verCusto ? (
          <>
            <div className="kpi"><div className="kpi-label">Custo em estoque</div><div className="kpi-value" style={{ fontSize: "1.6rem" }}>{fmt.brl(custoTotal)}</div></div>
            <div className="kpi"><div className="kpi-label">Margem potencial</div><div className="kpi-value" style={{ fontSize: "1.6rem" }}>{fmt.brl(margemTotal)}</div><div className="kpi-sub">preço de realinhamento − custo</div></div>
          </>
        ) : (
          <div className="kpi"><div className="kpi-label">Valor anunciado</div><div className="kpi-value" style={{ fontSize: "1.6rem" }}>{fmt.brl(precoTotal)}</div></div>
        )}
      </div>

      <div className="toolbar">
        <input className="input search" placeholder="Buscar placa, modelo ou cor…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <select className="input" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
          <option value="dias">Mais tempo em estoque</option>
          <option value="preco">Maior preço</option>
          {verCusto && <option value="margem">Maior margem</option>}
          <option value="modelo">Modelo (A–Z)</option>
        </select>
      </div>
      <div className="toolbar">
        <div className="chips">
          {chip(!cidade, () => setCidade(""), "Todas as cidades")}
          {cidades.map((c) => chip(cidade === c, () => setCidade(cidade === c ? "" : c), c))}
        </div>
        <div className="chips">
          {chip(marca === "HARLEY", () => setMarca(marca === "HARLEY" ? "" : "HARLEY"), "Freedom / Harley")}
          {chip(marca === "TRIUMPH", () => setMarca(marca === "TRIUMPH" ? "" : "TRIUMPH"), "Triumph")}
        </div>
        <div className="chips">
          {FAIXAS.map((f) => chip(faixa === f.id, () => setFaixa(faixa === f.id ? "" : f.id), f.label))}
        </div>
        <div className="chips">
          {statuses.map((s) => chip(status === s, () => setStatus(status === s ? "" : s), s.toLowerCase()))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Placa</th><th>Modelo</th><th>Ano</th><th className="r hide-sm">Km</th><th className="hide-sm">Cor</th><th>Loja</th>
              <th className="hide-sm">Entrada</th><th className="r">Dias</th><th className="r">Preço</th><th className="r">FIPE</th>
              {verCusto && <><th className="r">Custo</th><th className="r">Margem</th></>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => {
              const margem = m.realinhamento != null && m.custo != null ? m.realinhamento - m.custo : null;
              const prep = emPreparacao[m.placa];
              return (
                <tr key={m.id}>
                  <td><span className="plate">{m.placa || "—"}</span></td>
                  <td style={{ minWidth: 180 }}>
                    <span className="strong">{m.modelo}</span>{prep && <> <span className="badge orange" title="Em preparação">⚙ {prep.toLowerCase()}</span></>}
                    {m.observacao && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{m.observacao}</div>}
                  </td>
                  <td className="num">{m.ano}</td>
                  <td className="r hide-sm">{fmt.int(m.km)}</td>
                  <td className="muted hide-sm">{m.cor}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{m.marca === "TRIUMPH" ? "Triumph" : "Freedom"} · {m.cidade}</td>
                  <td className="num muted hide-sm">{fmt.date(m.dataEntrada ? new Date(m.dataEntrada) : null)}</td>
                  <td className="r"><span className={`badge ${tomDias(m.dias)}`}>{m.dias ?? "—"}</span></td>
                  <td className="r strong">{fmt.brl(m.realinhamento)}</td>
                  <td className="r muted">{fmt.brl(m.fipe)}</td>
                  {verCusto && (
                    <>
                      <td className="r muted">{fmt.brl(m.custo)}</td>
                      <td className="r" style={{ color: margem == null ? undefined : margem < 0 ? "var(--bad)" : "var(--ok)" }}>
                        {fmt.brl(margem)}
                        {margem != null && m.realinhamento ? <div className="faint" style={{ fontSize: 11 }}>{fmt.pct(margem / m.realinhamento)}</div> : null}
                      </td>
                    </>
                  )}
                  <td><span className={`badge ${m.anunciada ? "ok" : "warn"}`}>{m.status.toLowerCase()}</span></td>
                                  </tr>
              );
            })}
            {lista.length === 0 && <tr><td colSpan={13} className="empty">Nenhuma moto com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
