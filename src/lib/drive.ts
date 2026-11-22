import "server-only";
import { createHash } from "node:crypto";
import { tokenGoogle } from "./google";
import { cached, invalidate } from "./cache";
import { getConfiguracoes, CHAVES } from "./configuracoes";
import { clean } from "./parse";

/**
 * Fotos das motos no Google Drive (conta de serviço como Editor da pasta).
 * A pasta raiz é configurada pelo gestor em Cadastro; dentro dela, uma subpasta por moto
 * com a placa no nome (ex.: "ABC1D23 - FAT BOY 114"). O app cria essa subpasta sozinho quando
 * a moto é recebida na preparação ou cadastrada no estoque. As fotos importadas são
 * servidas pelo app em /api/drive/<id> (reduzidas), sem precisar deixar o arquivo público.
 */
const API = process.env.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3";
const PASTA = "application/vnd.google-apps.folder";

export type ArquivoDrive = { id: string; nome: string; pasta?: string };
export type PastaMoto = { id: string; nome: string; placa: string };

/** Extrai o ID de um link do Drive (pasta ou arquivo) ou aceita o próprio ID. */
export function idDoDrive(texto: string): string | null {
  const t = clean(texto);
  const m = t.match(/\/folders\/([\w-]{10,})/) || t.match(/\/file\/d\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/) || t.match(/^([\w-]{20,})$/);
  return m ? m[1] : null;
}
export const linkPasta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

async function api<T>(caminho: string, params: Record<string, string> = {}, init: RequestInit = {}): Promise<T> {
  const q = new URLSearchParams({ supportsAllDrives: "true", ...params });
  const res = await fetch(`${API}/${caminho}?${q}`, {
    ...init,
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const corpo = await res.text();
    if (res.status === 404) throw new Error("Pasta/arquivo do Drive não encontrado. Confira se está compartilhado com a conta de serviço do app.");
    if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(corpo)) throw new Error("A Google Drive API não está ativada no projeto do Google Cloud.");
    if (res.status === 403 && /insufficient|canAddChildren|forbidden/i.test(corpo)) throw new Error("A conta do app precisa ser EDITOR da pasta de fotos no Drive.");
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
      q, fields: "nextPageToken,files(id,name,mimeType)", pageSize: "1000", orderBy: "name", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}),
    });
    out.push(...r.files);
    pageToken = r.nextPageToken ?? "";
  } while (pageToken && out.length < 5000);
  return out;
}
const filhos = (id: string, soPastas = false) => listar(`'${id}' in parents and trashed=false${soPastas ? ` and mimeType='${PASTA}'` : ""}`);

const imagem = (i: Item) => i.mimeType.startsWith("image/");
const so = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Placa (antiga ou Mercosul) contida no nome, ignorando espaços e hífens. */
export function placaNoNome(nome: string): string | null {
  const m = nome.toUpperCase().match(/(?<![A-Z0-9])([A-Z]{3})[\s-]?(\d[A-Z0-9])[\s-]?(\d{2})(?![A-Z0-9])/);
  return m ? m[1] + m[2] + m[3] : null;
}

export async function pastaConfigurada(): Promise<string | null> {
  const c = await getConfiguracoes().catch(() => ({} as Record<string, string>));
  return idDoDrive(c[CHAVES.pastaDrive.nome] ?? "") ?? (process.env.DRIVE_PASTA_FOTOS ? idDoDrive(process.env.DRIVE_PASTA_FOTOS) : null);
}

/**
 * Índice placa → pasta: subpastas da raiz com placa no nome e, nas que não têm placa
 * (agrupamento por loja/mês), as subpastas de dentro.
 */
async function carregarIndice(raiz: string): Promise<Record<string, PastaMoto>> {
  const out: Record<string, PastaMoto> = {};
  const nivel1 = await filhos(raiz, true);
  const grupos: Item[] = [];
  for (const p of nivel1) {
    const placa = placaNoNome(p.name);
    if (placa) out[placa] ??= { id: p.id, nome: p.name, placa };
    else grupos.push(p);
  }
  for (const g of grupos.slice(0, 30)) {
    for (const p of await filhos(g.id, true)) {
      const placa = placaNoNome(p.name);
      if (placa) out[placa] ??= { id: p.id, nome: `${g.name}/${p.name}`, placa };
    }
  }
  return out;
}
export async function indicePastas(): Promise<Record<string, PastaMoto>> {
  const raiz = await pastaConfigurada();
  if (!raiz) return {};
  return cached(`drive-indice:${raiz}`, () => carregarIndice(raiz));
}

export async function pastaDaPlaca(placa: string): Promise<PastaMoto | null> {
  const p = so(placa);
  return p ? (await indicePastas().catch(() => ({} as Record<string, PastaMoto>)))[p] ?? null : null;
}

async function criarPasta(nome: string, pai: string): Promise<string> {
  const r = await api<{ id: string }>("files", { fields: "id" }, { method: "POST", body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai] }) });
  return r.id;
}

/** Nome padrão da pasta: "ABC1D23 - FAT BOY 114". */
export const nomePasta = (placa: string, modelo: string) => `${so(placa)}${clean(modelo) ? ` - ${clean(modelo).toUpperCase().replace(/[\\/]/g, "-").slice(0, 60)}` : ""}`;

/** Garante a subpasta da placa (cria se não existir). Não faz nada se o Drive não estiver configurado. */
export async function garantirPastaDaPlaca(placa: string, modelo = ""): Promise<{ pasta: PastaMoto; criada: boolean } | null> {
  const raiz = await pastaConfigurada();
  const p = so(placa);
  if (!raiz || !placaNoNome(p)) return null;
  invalidate(`drive-indice:${raiz}`);
  const atual = (await indicePastas())[p];
  if (atual) return { pasta: atual, criada: false };
  const nome = nomePasta(p, modelo);
  const id = await criarPasta(nome, raiz);
  invalidate(`drive-indice:${raiz}`);
  return { pasta: { id, nome, placa: p }, criada: true };
}

/** Uso automático (receber moto / cadastrar no estoque): nunca impede o cadastro se o Drive falhar. */
export async function pastaAutomatica(placa: string, modelo: string): Promise<void> {
  try { await garantirPastaDaPlaca(placa, modelo); } catch (e) { console.error("Drive: não foi possível criar a pasta de", placa, e); }
}

/** Cria as pastas que faltam para várias motos (ex.: estoque atual). */
export async function criarPastasEmLote(motos: { placa: string; modelo: string }[]): Promise<{ criadas: string[]; existentes: number; ignoradas: number }> {
  const raiz = await pastaConfigurada();
  if (!raiz) throw new Error("Configure a pasta de fotos do Drive primeiro.");
  invalidate(`drive-indice:${raiz}`);
  const indice = await indicePastas();
  const criadas: string[] = [];
  let existentes = 0, ignoradas = 0;
  const vistas = new Set<string>();
  for (const m of motos) {
    const p = so(m.placa);
    if (!placaNoNome(p)) { ignoradas++; continue; }
    if (vistas.has(p)) continue;
    vistas.add(p);
    if (indice[p]) { existentes++; continue; }
    const nome = nomePasta(p, m.modelo);
    await criarPasta(nome, raiz);
    criadas.push(nome);
  }
  invalidate(`drive-indice:${raiz}`);
  return { criadas, existentes, ignoradas };
}

/** Imagens de uma pasta (e das subpastas imediatas, ex.: "oficiais"). */
async function imagensDaPasta(id: string, nome?: string): Promise<ArquivoDrive[]> {
  const itens = await filhos(id);
  const fotos = itens.filter(imagem).map((i) => ({ id: i.id, nome: i.name, pasta: nome }));
  for (const sub of itens.filter((i) => i.mimeType === PASTA).slice(0, 10)) {
    const deSub = (await filhos(sub.id)).filter(imagem);
    fotos.push(...deSub.map((i) => ({ id: i.id, nome: i.name, pasta: `${nome ?? ""}/${sub.name}` })));
  }
  return fotos;
}

/** Fotos de uma placa: a subpasta dela (com subpastas) e imagens soltas na raiz com a placa no nome. */
export async function fotosDaPlacaNoDrive(placa: string): Promise<{ fotos: ArquivoDrive[]; pastas: string[] }> {
  const raiz = await pastaConfigurada();
  if (!raiz) throw new Error("Pasta de fotos do Drive não configurada (Cadastro → Fotos no Google Drive).");
  const p = so(placa);
  if (p.length < 5) throw new Error("Placa inválida para procurar no Drive.");
  invalidate(`drive-indice:${raiz}`);
  const pasta = (await indicePastas())[p];
  const soltas = (await filhos(raiz)).filter((i) => imagem(i) && so(i.name).includes(p)).map((i) => ({ id: i.id, nome: i.name }));
  const fotos = [...soltas, ...(pasta ? await imagensDaPasta(pasta.id, pasta.nome) : [])];
  return { fotos: dedup(fotos), pastas: pasta ? [pasta.nome] : [] };
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

/** Confere a pasta (existe, é pasta, a conta do app pode criar subpastas) e devolve nome e quantas subpastas tem. */
export async function conferirPasta(link: string): Promise<{ id: string; nome: string; subpastas: number; editor: boolean }> {
  const id = idDoDrive(link);
  if (!id) throw new Error("Não reconheci o link. Cole o link da pasta (drive.google.com/drive/folders/…).");
  const item = await api<Item & { capabilities?: { canAddChildren?: boolean } }>(`files/${id}`, { fields: "id,name,mimeType,capabilities(canAddChildren)" });
  if (item.mimeType !== PASTA) throw new Error("Esse link é de um arquivo; cole o link da pasta.");
  const sub = await filhos(id, true);
  return { id, nome: item.name, subpastas: sub.length, editor: item.capabilities?.canAddChildren !== false };
}

// ---------------------------------------------------------------------------------------------
// Envio de fotos pelo app para a pasta da moto
// ---------------------------------------------------------------------------------------------
const UPLOAD = process.env.DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3";

class SemEspaco extends Error {}

/** Envia direto com a conta do app (funciona quando a pasta está num Drive compartilhado). */
async function enviarDireto(pasta: string, nome: string, tipo: string, dados: ArrayBuffer): Promise<string> {
  const fronteira = `ss${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name: nome, parents: [pasta] });
  const corpo = Buffer.concat([
    Buffer.from(`--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${fronteira}\r\nContent-Type: ${tipo}\r\n\r\n`),
    Buffer.from(dados),
    Buffer.from(`\r\n--${fronteira}--`),
  ]);
  const res = await fetch(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`, {
    method: "POST", body: corpo, cache: "no-store", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${await tokenGoogle()}`, "Content-Type": `multipart/related; boundary=${fronteira}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 403 && /storage quota|storageQuota/i.test(txt)) throw new SemEspaco(txt);
    throw new Error(`Google Drive ${res.status}: ${txt.slice(0, 200)}`);
  }
  return ((await res.json()) as { id: string }).id;
}

/** Segredo que a ponte confere (derivado do APP_SECRET; não precisa ser digitado). */
export function segredoPonte(): string {
  return createHash("sha256").update(`${process.env.APP_SECRET ?? "servopa"}:ponte-drive`).digest("hex").slice(0, 32);
}

export async function ponteConfigurada(): Promise<string | null> {
  const c = await getConfiguracoes().catch(() => ({} as Record<string, string>));
  const u = clean(c[CHAVES.ponteDrive.nome] ?? "") || process.env.DRIVE_PONTE_URL || "";
  return /^https?:\/\//.test(u) ? u : null;
}

/** Chama a ponte (Apps Script na conta do dono da pasta). */
export async function chamarPonte(url: string, corpo: Record<string, unknown>): Promise<{ id?: string; ok?: boolean; erro?: string }> {
  const res = await fetch(url, {
    method: "POST", body: JSON.stringify({ segredo: segredoPonte(), ...corpo }), redirect: "follow", cache: "no-store",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: AbortSignal.timeout(90_000),
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { throw new Error(`A ponte do Drive não respondeu como esperado (${res.status}). Confira se foi implantada como "App da Web" com acesso "Qualquer pessoa".`); }
}

/** Grava a foto na pasta da moto (cria a pasta se faltar) e devolve o ID do arquivo no Drive. */
export async function enviarFotoParaDrive(placa: string, modelo: string, arquivo: File): Promise<string> {
  const g = await garantirPastaDaPlaca(placa, modelo);
  if (!g) throw new Error("Pasta de fotos do Drive não configurada (Cadastro → Fotos no Google Drive).");
  const tipo = arquivo.type || "image/jpeg";
  const nome = `${so(placa)}-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${Math.random().toString(36).slice(2, 6)}.${tipo.includes("png") ? "png" : "jpg"}`;
  const dados = await arquivo.arrayBuffer();
  try {
    return await enviarDireto(g.pasta.id, nome, tipo, dados);
  } catch (e) {
    if (!(e instanceof SemEspaco)) throw e;
    const ponte = await ponteConfigurada();
    if (!ponte) throw new Error("O Google não deixa a conta do app guardar arquivos na sua pasta. Configure a ponte do Drive em Cadastro → Fotos no Google Drive (ou use um Drive compartilhado).");
    const r = await chamarPonte(ponte, { pasta: g.pasta.id, nome, tipo, dados: Buffer.from(dados).toString("base64") });
    if (!r.id) throw new Error(`Ponte do Drive: ${r.erro ?? "não gravou a foto"}`);
    return r.id;
  }
}

/** Código da ponte (Google Apps Script) que o gestor cola na conta Google dona da pasta. */
export function codigoPonte(): string {
  return `// Ponte Servopa Seminovos -> Google Drive
// Recebe as fotos enviadas pelo app e grava na pasta da moto, usando o espaço desta conta Google.
const SEGREDO = "${segredoPonte()}";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.segredo !== SEGREDO) return resposta({ erro: "não autorizado" });
    if (d.ping) return resposta({ ok: true, conta: Session.getEffectiveUser().getEmail() });
    const pasta = DriveApp.getFolderById(d.pasta);
    const arquivo = pasta.createFile(Utilities.newBlob(Utilities.base64Decode(d.dados), d.tipo, d.nome));
    return resposta({ id: arquivo.getId() });
  } catch (err) {
    return resposta({ erro: String(err) });
  }
}

function resposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Rode esta função uma vez pelo editor para autorizar o acesso ao Drive.
function autorizar() { DriveApp.getRootFolder(); }
`;
}

/** Move um arquivo para a lixeira do Drive (recuperável por 30 dias). */
export async function moverParaLixeira(id: string): Promise<void> {
  await api(`files/${encodeURIComponent(id)}`, { fields: "id" }, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
}

/** A pasta de fotos está num Drive compartilhado? (aí a conta do app grava fotos direto, sem ponte) */
export async function pastaEmDriveCompartilhado(): Promise<boolean> {
  const raiz = await pastaConfigurada();
  if (!raiz) return false;
  return cached(`drive-compartilhado:${raiz}`, async () => !!(await api<{ driveId?: string }>(`files/${raiz}`, { fields: "driveId" })).driveId);
}
