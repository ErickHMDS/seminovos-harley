import Link from "next/link";
import { fmt } from "@/lib/parse";

export const SIT: Record<string, { txt: string; tom: string }> = {
  FATURADO: { txt: "faturado", tom: "ok" },
  ESTOQUE: { txt: "aguardando faturar", tom: "warn" },
  TRANSFERENCIA: { txt: "transferência", tom: "" },
  CANCELADA: { txt: "cancelada", tom: "bad" },
};

export type VendaLinha = {
  id: string; aba: string; linha: number; data: string | null; vendedorCurto: string; loja: string; veiculo: string; placa: string;
  cliente: string; situacao: string; fin: boolean; ge: boolean; usado: boolean;
};

const editarHref = (v: VendaLinha) => `/vendas/editar?${new URLSearchParams({ aba: v.aba, linha: String(v.linha) })}`;

/** Lista de lançamentos (cartões no celular, tabela no computador). */
export function VendasLista({ lista, mostrarVendedor = true, mostrarCliente = false }: { lista: VendaLinha[]; mostrarVendedor?: boolean; mostrarCliente?: boolean }) {
  return (
    <>
      <ul className="sale-list mobile-only">
        {lista.map((v) => {
          const s = SIT[v.situacao] ?? { txt: v.situacao.toLowerCase(), tom: "" };
          return (
            <li key={v.id}>
              <Link href={editarHref(v)} className="sale-card">
                <div className="sale-top">
                  <strong>{v.veiculo || "—"}</strong>
                  <span className={`badge ${s.tom}`}>{s.txt}</span>
                </div>
                <div className="sale-meta">
                  <span>{fmt.date(v.data ? new Date(v.data) : null).slice(0, 5)}</span>
                  {mostrarVendedor && <span>{v.vendedorCurto}</span>}
                  {mostrarCliente && v.cliente && <span>{v.cliente}</span>}
                  <span>{v.loja === "TRIUMPH" ? "Triumph" : "Harley"}</span>
                  {v.placa && <span className="plate">{v.placa}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="table-wrap desktop-only">
        <table>
          <thead>
            <tr>
              <th>Data</th>{mostrarVendedor && <th>Vendedor</th>}<th>Loja</th><th>Veículo</th><th>Placa</th>
              {mostrarCliente && <th>Cliente</th>}
              <th>Situação</th><th className="c">FIN</th><th className="c">G.E</th><th className="c">Usado</th><th />
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const s = SIT[v.situacao] ?? { txt: v.situacao.toLowerCase(), tom: "" };
              return (
                <tr key={v.id} className="row-link">
                  <td className="num">{fmt.date(v.data ? new Date(v.data) : null)}</td>
                  {mostrarVendedor && <td>{v.vendedorCurto}</td>}
                  <td><span className="badge">{v.loja}</span></td>
                  <td>{v.veiculo}</td>
                  <td>{v.placa && <span className="plate">{v.placa}</span>}</td>
                  {mostrarCliente && <td className="muted">{v.cliente}</td>}
                  <td><span className={`badge ${s.tom}`}>{s.txt}</span></td>
                  <td className="c">{v.fin ? "●" : <span className="faint">·</span>}</td>
                  <td className="c">{v.ge ? "●" : <span className="faint">·</span>}</td>
                  <td className="c">{v.usado ? "●" : <span className="faint">·</span>}</td>
                  <td className="r"><Link href={editarHref(v)} className="link-more">Editar</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
