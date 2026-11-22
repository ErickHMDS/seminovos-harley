import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="page">
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="eyebrow">404</div>
        <h2>Página não encontrada</h2>
        <p className="muted">O item pode ter sido removido da planilha.</p>
        <Link className="btn" href="/">Voltar ao início</Link>
      </div>
    </main>
  );
}
