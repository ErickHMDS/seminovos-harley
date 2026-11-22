import "server-only";
import { tokenGoogle } from "./google";
import { getConfiguracoes, CHAVES } from "./configuracoes";
import { clean } from "./parse";

/**
 * Leitura de fotos no Google Drive (somente leitura, com a conta de serviço).
 * A pasta raiz é configurada pelo gestor em Cadastro; dentro dela, uma subpasta por moto
 * com a placa no nome (ex.: "ABC1D23" ou "ABC1D23 - Fat Boy"). As fotos importadas são
 * servidas pelo app em /api/drive/<id> (reduzidas), sem precisar deixar o arquivo público.
 */
const API = process.env.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3";
const PASTA = "application/vnd.google-apps.folder";

export type ArquivoDrive = { id: string; nome: string; pasta?: string };

/** Extrai o ID de um link do Drive (pasta ou arquivo) ou aceita o próprio ID. */
export function idDoDrive(texto: string): string | null {
  const t = clean(texto);
  const m = t.match(/\/folders\/([\w-]{10,})/) || t.match(/\/file\/d\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/) || t.match(/^([\w-]{20,})$/);
  return m ? m[1] : null;
}
export const ehLinkDrive = (t: string) => /drive\.google\.com|docs\.google\.com/.test(t);

async function api<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ supportsAllDrives: "true", ...params });
  const res = await fetch(`${API}/${caminho}?${q}`, { headers: { Authorization: `Bearer ${await tokenGoogle()}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const corpo = await res.text();
    if (res.status === 404) throw new Error("Pasta/arquivo do Drive não encontrado. Confira se está compartilhado com a conta de serviço do app.");
    if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(corpo)) throw new Error("A Google Drive API não está ativada no projeto do Google Cloud.");
    throw new Error(`Google Drive ${res.status}: ${corpo.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type Item = { id: string; name: string; mimeType: string };
async function listar(q: string): Promise<Item[]> {
  const out: Item[] = [];
  let pageToken = "";
  do {
    const r = await api<{ files: Item[]; nextPageToken?: string }>("files", {
      q, fields: "nextPageToken,files(id,name,mimeType)", pageSize: "200", orderBy: "name", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}),
    });
    out.push(...r.files);
    pageToken = r.nextPageToken ?? "";
  } while (pageToken && out.length < 1000);
  return out;
}

const imagem = (i: Item) => i.mimeType.startsWith("image/");
const so = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Imagens de uma pasta (e das subpastas imediatas, ex.: "oficiais"). */
async function imagensDaPasta(id: string, nome?: string): Promise<ArquivoDrive[]> {
  const itens = await listar(`'${id}' in parents and trashed=false`);
  const fotos = itens.filter(imagem).map((i) => ({ id: i.id, nome: i.name, pasta: nome }));
  for (const sub of itens.filter((i) => i.mimeType === PASTA).slice(0, 10)) {
    const deSub = (await listar(`'${sub.id}' in parents and trashed=false`)).filter(imagem);
    fotos.push(...deSub.map((i) => ({ id: i.id, nome: i.name, pasta: `${nome ?? ""}/${sub.name}` })));
  }
  return fotos;
}

export async function pastaConfigurada(): Promise<string | null> {
  const c = await getConfiguracoes().catch(() => ({} as Record<string, string>));
  return idDoDrive(c[CHAVES.pastaDrive.nome] ?? "") ?? (process.env.DRIVE_PASTA_FOTOS ? idDoDrive(process.env.DRIVE_PASTA_FOTOS) : null);
}

/**
 * Procura as fotos de uma placa: pastas cujo nome contém a placa (dentro da pasta
 * configurada, em até 2 níveis) e imagens soltas com a placa no nome.
 */
export async function fotosDaPlacaNoDrive(placa: string): Promise<{ fotos: ArquivoDrive[]; pastas: string[] }> {
  const raiz = await pastaConfigurada();
  if (!raiz) throw new Error("Pasta de fotos do Drive não configurada (Cadastro → Fotos no Google Drive).");
  const p = so(placa);
  if (p.length < 5) throw new Error("Placa inválida para procurar no Drive.");
  const nivel1 = await listar(`'${raiz}' in parents and trashed=false`);
  const alvo: Item[] = [];
  const soltas: ArquivoDrive[] = nivel1.filter((i) => imagem(i) && so(i.name).includes(p)).map((i) => ({ id: i.id, nome: i.name }));
  for (const i of nivel1.filter((x) => x.mimeType === PASTA)) {
    if (so(i.name).includes(p)) { alvo.push(i); continue; }
  }
  if (!alvo.length) {
    // organização por loja/mês: procura um nível abaixo
    for (const grupo of nivel1.filter((x) => x.mimeType === PASTA).slice(0, 40)) {
      const filhos = await listar(`'${grupo.id}' in parents and trashed=false`);
      alvo.push(...filhos.filter((x) => x.mimeType === PASTA && so(x.name).includes(p)));
      soltas.push(...filhos.filter((x) => imagem(x) && so(x.name).includes(p)).map((i) => ({ id: i.id, nome: i.name, pasta: grupo.name })));
    }
  }
  const fotos = [...soltas];
  for (const pasta of alvo) fotos.push(...(await imagensDaPasta(pasta.id, pasta.name)));
  return { fotos: dedup(fotos), pastas: alvo.map((a) => a.name) };
}

/** Fotos a partir de um link colado (pasta inteira ou um arquivo). */
export async function fotosDoLink(link: string): Promise<ArquivoDrive[]> {
  const id = idDoDrive(link);
  if (!id) throw new Error("Não reconheci o link do Google Drive.");
  const item = await api<Item>(`files/${id}`, { fields: "id,name,mimeType" });
  if (item.mimeType === PASTA) return dedup(await imagensDaPasta(item.id, item.name));
  if (imagem(item)) return [{ id: item.id, nome: item.name }];
  throw new Error("O link não é de uma imagem nem de uma pasta.");
}

function dedup(l: ArquivoDrive[]) {
  const vistos = new Set<string>();
  return l.filter((f) => (vistos.has(f.id) ? false : (vistos.add(f.id), true)));
}

/** Endereço interno da foto do Drive (o app busca e reduz). */
export const urlDrive = (id: string) => `/api/drive/${id}`;
export const idDeUrlDrive = (url: string) => url.match(/^\/api\/drive\/([\w-]+)/)?.[1] ?? null;

/** Baixa o arquivo (para o proxy de imagens). */
export async function baixar(id: string): Promise<{ dados: ArrayBuffer; tipo: string }> {
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await tokenGoogle()}` }, cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  return { dados: await res.arrayBuffer(), tipo: res.headers.get("content-type") ?? "image/jpeg" };
}

/** Confere a pasta (existe, é pasta e a conta de serviço enxerga) e devolve o nome e quantas subpastas tem. */
export async function conferirPasta(link: string): Promise<{ id: string; nome: string; subpastas: number }> {
  const id = idDoDrive(link);
  if (!id) throw new Error("Não reconheci o link. Cole o link da pasta (drive.google.com/drive/folders/…).");
  const item = await api<Item>(`files/${id}`, { fields: "id,name,mimeType" });
  if (item.mimeType !== PASTA) throw new Error("Esse link é de um arquivo; cole o link da pasta.");
  const filhos = await listar(`'${id}' in parents and trashed=false and mimeType='${PASTA}'`);
  return { id, nome: item.name, subpastas: filhos.length };
}
