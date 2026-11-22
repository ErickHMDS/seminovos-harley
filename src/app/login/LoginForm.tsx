"use client";
import { useActionState } from "react";
import { entrar, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});
  return (
    <form action={action} className="stack" style={{ marginTop: 18 }}>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" className="input" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" autoFocus required />
      </div>
      {state.erro && <div className="alert bad" role="alert">{state.erro}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
