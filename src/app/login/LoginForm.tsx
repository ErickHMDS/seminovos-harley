"use client";
import { useActionState, useState } from "react";
import { entrar, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});
  const [ver, setVer] = useState(false);
  return (
    <form action={action} className="stack" style={{ marginTop: 18 }}>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <div className="senha-wrap">
          <input id="senha" name="senha" type={ver ? "text" : "password"} className="input" autoComplete="current-password"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus required />
          <button type="button" className="senha-ver" onClick={() => setVer((v) => !v)} aria-pressed={ver} aria-label={ver ? "Ocultar senha" : "Mostrar senha"}>
            {ver ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {state.erro && <div className="alert bad" role="alert">{state.erro}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
