import "server-only";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { addSheet, appendValues, batchUpdateValues, getValues, listSheets, range, updateValues } from "./google";
import { cached, invalidate } from "./cache";
import { config } from "./config";
import { PERFIS, iguais, senhaDoPerfil, type Perfil } from "./auth";
import { TZ, clean } from "./parse";
import { colLetra, indiceCabecalho, valorSeguro } from "./planilha";

/**
 * Equipe com acesso ao app (aba "Usuários App" da planilha de estoque).
 * A senha nunca é gravada em texto: só o hash (scrypt + sal).
 */
const CABECALHO = ["ID", "Nome", "Perfil", "Vendedor na Planilha", "Telefone", "Ativo", "Senha (hash)", "Versão", "Criado Em", "Atualizado Em"];

export type Usuario = {
  id: string; nome: string; perfil: Perfil; vendedor: string; telefone: string; ativo: boolean;
  hash: string; versao: number; criadoEm: string; atualizadoEm: string; linha: number;
};

const agora = () => new Date().toLocaleString("pt-BR", { timeZone: TZ });

export function hashSenha(senha: string): string {
  const sal = randomBytes(16);
  return `s1$${sal.toString("base64")}$${scryptSync(senha, sal, 32).toString("base64")}`;
}

function confere(senha: string, hash: string): boolean {
  const [v, sal, h] = hash.split("$");
  if (v !== "s1" || !sal || !h) return false;
  const calc = scryptSync(senha, Buffer.from(sal, "base64"), 32);
  const esperado = Buffer.from(h, "base64");
  return esperado.length === calc.length && timingSafeEqual(calc, esperado);
}

async function lerAba() {
  const abas = await listSheets(config.estoqueId);
  if (!abas.some((a) => a.title === config.usuariosAba)) return { existe: false, header: [] as string[], rows: [] as string[][] };
  const [header = [], ...rows] = await getValues(config.estoqueId, range(config.usuariosAba, "A1:Z"));
  return { existe: true, header, rows };
}

async function load(): Promise<Usuario[]> {
  const { header, rows } = await lerAba();
  const col = indiceCabecalho(header);
  const g = (r: string[], n: string) => clean(r[col(n)] ?? "");
  return rows
    .map((r, i) => {
      const perfil = g(r, "Perfil").toLowerCase();
      return {
        id: g(r, "ID"), nome: g(r, "Nome"), perfil: (perfil in PERFIS ? perfil : "vendedor") as Perfil,
        vendedor: g(r, "Vendedor na Planilha").toUpperCase(), telefone: g(r, "Telefone"),
        ativo: !/^(n|nao|não|false|0|inativo)$/i.test(g(r, "Ativo")), hash: g(r, "Senha (hash)"),
        versao: Number(g(r, "Versão")) || 0, criadoEm: g(r, "Criado Em"), atualizadoEm: g(r, "Atualizado Em"), linha: i + 2,
      };
    })
    .filter((u) => u.id && u.nome);
}

export function getUsuarios() {
  return cached("usuarios", load);
}

async function garantirAba() {
  const { existe, header } = await lerAba();
  if (!existe) {
    await addSheet(config.estoqueId, config.usuariosAba);
    await updateValues(config.estoqueId, range(config.usuariosAba, "A1"), [CABECALHO]);
    return CABECALHO;
  }
  return header;
}

export type Autenticado = { perfil: Perfil; uid: string; ver: number; nome: string };

/** Login: a senha identifica a pessoa. Senha mestra do gestor (SENHA_GESTOR) sempre funciona como administrador. */
export async function autenticar(senha: string): Promise<Autenticado | null> {
  const s = senha.trim();
  if (!s) return null;
  const mestra = senhaDoPerfil("gestor");
  if (mestra && iguais(s, mestra)) return { perfil: "gestor", uid: "admin", ver: 0, nome: "Administrador" };
  invalidate("usuarios");
  const usuarios = (await getUsuarios().catch(() => [] as Usuario[])).filter((u) => u.ativo && u.hash);
  for (const u of usuarios) if (confere(s, u.hash)) return { perfil: u.perfil, uid: u.id, ver: u.versao, nome: u.nome };
  // senhas genéricas de vendedor/preparador (.env) só valem enquanto não houver ninguém cadastrado nesse perfil
  for (const p of ["vendedor", "preparador"] as Perfil[]) {
    const env = senhaDoPerfil(p);
    if (env && iguais(s, env) && !usuarios.some((u) => u.perfil === p)) return { perfil: p, uid: `env-${p}`, ver: 0, nome: PERFIS[p].label };
  }
  return null;
}

async function senhaEmUso(senha: string, exceto?: string): Promise<boolean> {
  const mestra = senhaDoPerfil("gestor");
  if (mestra && iguais(senha, mestra)) return true;
  const usuarios = await getUsuarios();
  return usuarios.some((u) => u.id !== exceto && u.ativo && u.hash && confere(senha, u.hash));
}

/** Gera uma senha numérica de 6 dígitos que ninguém está usando. */
export async function gerarSenha(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const s = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!(await senhaEmUso(s))) return s;
  }
  throw new Error("Não foi possível gerar uma senha única. Tente de novo.");
}

function validarSenha(senha: string) {
  if (senha.trim().length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
}

export type NovoUsuario = { nome: string; perfil: Perfil; vendedor: string; telefone: string };

export async function criarUsuario(dados: NovoUsuario, senha: string): Promise<Usuario> {
  validarSenha(senha);
  invalidate("usuarios");
  if (await senhaEmUso(senha.trim())) throw new Error("Essa senha já está em uso por outra pessoa. Escolha outra.");
  const header = await garantirAba();
  const col = indiceCabecalho(header);
  const id = `U${Date.now().toString(36).toUpperCase()}`;
  const valores: Record<string, string | number> = {
    ID: id, Nome: dados.nome, Perfil: dados.perfil, "Vendedor na Planilha": dados.vendedor.toUpperCase(), Telefone: dados.telefone,
    Ativo: "SIM", "Senha (hash)": hashSenha(senha.trim()), "Versão": 1, "Criado Em": agora(), "Atualizado Em": agora(),
  };
  const linha = header.map(() => "" as string | number);
  for (const [k, v] of Object.entries(valores)) if (col(k) >= 0) linha[col(k)] = typeof v === "number" ? v : valorSeguro(v);
  await appendValues(config.estoqueId, range(config.usuariosAba, "A1"), [linha]);
  invalidate("usuarios");
  return (await getUsuarios()).find((u) => u.id === id)!;
}

async function gravar(u: Usuario, campos: Record<string, string | number>) {
  const { header } = await lerAba();
  const col = indiceCabecalho(header);
  const data = Object.entries({ ...campos, "Atualizado Em": agora() })
    .filter(([k]) => col(k) >= 0)
    .map(([k, v]) => ({ range: range(config.usuariosAba, `${colLetra(col(k))}${u.linha}`), values: [[typeof v === "number" ? v : valorSeguro(v)]] }));
  await batchUpdateValues(config.estoqueId, data);
  invalidate("usuarios");
}

async function buscar(id: string) {
  invalidate("usuarios");
  const u = (await getUsuarios()).find((x) => x.id === id);
  if (!u) throw new Error("Pessoa não encontrada no cadastro.");
  return u;
}

export async function atualizarUsuario(id: string, dados: NovoUsuario & { ativo: boolean }) {
  const u = await buscar(id);
  const mudouAcesso = u.perfil !== dados.perfil || u.ativo !== dados.ativo;
  await gravar(u, {
    Nome: dados.nome, Perfil: dados.perfil, "Vendedor na Planilha": dados.vendedor.toUpperCase(), Telefone: dados.telefone,
    Ativo: dados.ativo ? "SIM" : "NÃO", ...(mudouAcesso ? { "Versão": u.versao + 1 } : {}), // muda perfil/ativo -> derruba sessões
  });
}

export async function redefinirSenha(id: string, senha: string) {
  validarSenha(senha);
  const u = await buscar(id);
  if (await senhaEmUso(senha.trim(), id)) throw new Error("Essa senha já está em uso por outra pessoa. Escolha outra.");
  await gravar(u, { "Senha (hash)": hashSenha(senha.trim()), "Versão": u.versao + 1 });
}
