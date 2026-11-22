"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="eyebrow">Ops</div>
      <h2>Não foi possível carregar os dados da planilha</h2>
      <p className="muted">
        Verifique se as planilhas continuam compartilhadas com a conta de serviço e se as credenciais estão configuradas.
      </p>
      {process.env.NODE_ENV !== "production" && <pre className="faint" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{error.message}</pre>}
      <button className="btn" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
