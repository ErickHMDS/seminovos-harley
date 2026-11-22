import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login">
        <Brand />
        <div className="panel">
          <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Entrar</h1>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Escolha seu perfil e informe a senha da equipe.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
