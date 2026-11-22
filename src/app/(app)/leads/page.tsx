import { exigirPerfil } from "@/lib/sessao";

export default async function LeadsPage() {
  await exigirPerfil("/leads");
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Em breve</div>
          <h1>Leads</h1>
          <p>Cada vendedor registra os clientes interessados e a moto que procuram.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>Como vai funcionar</h2>
          <ul className="muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
            <li>O vendedor cadastra o lead: nome, contato, marca/modelo desejado, faixa de preço.</li>
            <li>Quando uma moto compatível entra em <b>preparação</b> ou no <b>estoque</b>, o app avisa o vendedor.</li>
            <li>Lista de retorno: quem ligar hoje, com histórico dos contatos.</li>
            <li>O gestor acompanha a conversão de leads por vendedor.</li>
          </ul>
        </div>
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>O que precisamos</h2>
          <p className="muted" style={{ margin: 0 }}>
            Uma planilha (ou aba) de leads compartilhada com a conta de serviço do app. Quando ela existir, esta área passa a funcionar.
          </p>
        </div>
      </div>
    </>
  );
}
