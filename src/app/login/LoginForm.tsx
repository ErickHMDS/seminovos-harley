"use client";
import { useActionState } from "react";
import { entrar, type LoginState } from "../actions";

const PERFIS = [
  { id: "gestor", label: "Gestor" },
  { id: "vendedor", label: "Vendedor" },
  { id: "preparador", label: "Preparador" },
];

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});
  return (
    <form action={action} className="stack" style={{ marginTop: 18 }}>
      <div className="field">
        <span className="label">Perfil</span>
        <div className="perfis" role="radiogroup">
          {PERFIS.map((p, i) => (
            <label key={p.id}>
              <input type="radio" name="perfil" value={p.id} defaultChecked={i === 1} />
              {p.label}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state.erro && <div className="alert bad" role="alert">{state.erro}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
