/** Versão exibida no login — para conferir se a publicação mais recente está no ar. */
export const VERSAO = "v13 · 23/11/2026";
export const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
