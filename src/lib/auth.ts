/** Sessão simples por perfil, assinada com HMAC (funciona no middleware e no servidor). */

export const PERFIS = {
  gestor: { label: "Gestor", inicio: "/gestor" },
  vendedor: { label: "Vendedor", inicio: "/ranking" },
  preparador: { label: "Preparador", inicio: "/preparacao" },
} as const;
export type Perfil = keyof typeof PERFIS;

export const COOKIE = "sh_sessao";
const DURACAO_S = 60 * 60 * 24 * 7; // 7 dias

/** Quais perfis acessam cada área. */
export const ACESSO: Record<string, Perfil[]> = {
  "/gestor": ["gestor"],
  "/ranking": ["gestor", "vendedor"],
  "/estoque": ["gestor", "vendedor", "preparador"],
  "/preparacao": ["gestor", "vendedor", "preparador"],
  "/preparacao/nova": ["gestor", "preparador"],
  "/leads": ["gestor", "vendedor"],
  "/atividades": ["gestor"],
  "/vendas": ["gestor", "vendedor"],
  "/estoque/moto": ["gestor"],
};

export function podeAcessar(perfil: Perfil, path: string): boolean {
  // regra mais específica vence (ex.: /preparacao/nova antes de /preparacao)
  const area = Object.keys(ACESSO)
    .filter((a) => path === a || path.startsWith(`${a}/`))
    .sort((a, b) => b.length - a.length)[0];
  return area ? ACESSO[area].includes(perfil) : true;
}

export const podeEditarPreparacao = (p: Perfil) => p === "gestor" || p === "preparador";
export const podeVerCusto = (p: Perfil) => p === "gestor";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) throw new Error("APP_SECRET não configurado (mínimo 16 caracteres).");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function criarToken(perfil: Perfil): Promise<{ token: string; maxAge: number }> {
  const payload = `${perfil}.${Math.floor(Date.now() / 1000) + DURACAO_S}`;
  return { token: `${payload}.${await hmac(payload)}`, maxAge: DURACAO_S };
}

export async function lerToken(token: string | undefined): Promise<Perfil | null> {
  if (!token) return null;
  const [perfil, exp, sig] = token.split(".");
  if (!perfil || !exp || !sig || !(perfil in PERFIS)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  try {
    return iguais(sig, await hmac(`${perfil}.${exp}`)) ? (perfil as Perfil) : null;
  } catch {
    return null;
  }
}

export function senhaDoPerfil(perfil: Perfil): string | undefined {
  const v = process.env[`SENHA_${perfil.toUpperCase()}`]?.trim();
  return v ? v : undefined;
}

/** A senha identifica o perfil: devolve o perfil cuja senha confere (ou null). */
export function perfilPelaSenha(senha: string): Perfil | null {
  const s = senha.trim();
  if (!s) return null;
  for (const p of Object.keys(PERFIS) as Perfil[]) {
    const esperada = senhaDoPerfil(p);
    if (esperada && iguais(s, esperada)) return p;
  }
  return null;
}

export const algumaSenhaConfigurada = () => (Object.keys(PERFIS) as Perfil[]).some((p) => !!senhaDoPerfil(p));
