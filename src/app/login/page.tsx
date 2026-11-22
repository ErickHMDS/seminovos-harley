import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login">
        <Brand grande />
        <div className="panel">
          <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Entrar</h1>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Digite a senha do seu perfil (gestor, vendedor ou preparador).</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
