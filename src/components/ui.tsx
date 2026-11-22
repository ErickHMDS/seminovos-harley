import Link from "next/link";

export function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "accent" | "warn" | "bad" }) {
  return (
    <div className={`kpi ${tone ?? ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Bars({ data, tone }: { data: { label: string; value: number; tone?: "alt" | "warn" | "bad"; href?: string }[]; tone?: "alt" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d) => {
        const row = (
          <div className="bar-row" key={d.label}>
            <span className="label" title={d.label}>{d.label}</span>
            <div className="bar-track"><div className={`bar-fill ${d.tone ?? tone ?? ""}`} style={{ width: `${(d.value / max) * 100}%` }} /></div>
            <span className="value">{d.value}</span>
          </div>
        );
        return d.href ? <Link href={d.href} key={d.label}>{row}</Link> : row;
      })}
    </div>
  );
}

export function Columns({ data }: { data: { label: string; value: number; current?: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="cols" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      {data.map((d) => (
        <div className="col" key={d.label}>
          <div className={`col-bar ${d.current ? "current" : ""}`} style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}>
            <span>{d.value}</span>
          </div>
          <div className="col-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Progress({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return <div className={`progress ${v >= 1 ? "done" : ""}`}><span style={{ width: `${v * 100}%` }} /></div>;
}

export function Atualizado({ em }: { em: string }) {
  const hora = new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return <span className="updated"><span className="dot" /> Dados da planilha · atualizado às {hora}</span>;
}
