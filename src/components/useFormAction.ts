"use client";
import { startTransition, useActionState } from "react";

/**
 * Igual ao useActionState, mas envia pelo onSubmit: assim o React NÃO limpa os campos
 * do formulário quando o servidor devolve um erro (a pessoa não perde o que digitou).
 */
export function useFormAction<S extends object>(fn: (s: S, f: FormData) => Promise<S>, inicial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn as (s: Awaited<S>, f: FormData) => Promise<S>, inicial as Awaited<S>);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = submitter ? new FormData(e.currentTarget, submitter) : new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}
