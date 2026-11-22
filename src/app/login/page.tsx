import { Brand } from "@/components/Brand";
import { COMMIT, VERSAO } from "@/lib/versao";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login">
        <Brand grande />
        <div className="panel">
          <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Entrar</h1>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Digite a sua senha pessoal.</p>
          <LoginForm />
        </div>
        <p className="versao">{VERSAO}{COMMIT ? ` · ${COMMIT}` : ""}</p>
      </div>
    </div>
  );
}
