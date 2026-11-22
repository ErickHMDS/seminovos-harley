/**
 * Catálogo de motos: busca para autocompletar, identificação de textos livres
 * (ex.: "HONDA/XRE 300", "FXBB - STREET BOB") e equivalência entre marcas.
 * Funções puras — usadas no servidor e no navegador.
 */

export const TIPOS = ["Street", "Naked", "Esportiva", "Big Trail", "Trail", "Custom", "Touring", "Retrô", "Scooter", "Cub", "Off-road"] as const;
export type Tipo = (typeof TIPOS)[number];

export type ModeloCat = {
  id: string;
  marca: string;
  modelo: string;
  tipo: string;
  cc: number | null;
  anoIni: number | null;
  anoFim: number | null;
  segmento: string; // grupo de equivalência (padrão: tipo + faixa de cilindrada)
  apelidos: string[];
};

/** Faixas de cilindrada usadas para equivalência. */
export const FAIXAS_CC = [
  { max: 125, nome: "até 125" },
  { max: 200, nome: "126–200" },
  { max: 300, nome: "201–300" },
  { max: 500, nome: "301–500" },
  { max: 750, nome: "501–750" },
  { max: 1000, nome: "751–1000" },
  { max: 1300, nome: "1001–1300" },
  { max: Infinity, nome: "1300+" },
];

export function faixaCc(cc: number | null | undefined): string {
  if (!cc) return "";
  return FAIXAS_CC.find((f) => cc <= f.max)!.nome;
}

export function segmentoPadrao(tipo: string, cc: number | null | undefined): string {
  const f = faixaCc(cc);
  return [tipo, f && `${f} cc`].filter(Boolean).join(" · ");
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "CB 300F Twister" -> "CB300FTWISTER" */
export function compacto(s: string): string {
  return semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "CB 300F Twister" -> ["CB","300","F","TWISTER"] (separa letras de números) */
export function tokens(s: string): string[] {
  return semAcento(s).toUpperCase().replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d)([A-Z])/g, "$1 $2").split(/[^A-Z0-9]+/).filter(Boolean);
}

type Indexado = { item: ModeloCat; chaves: string[]; toks: string[][]; marcaC: string };

function indexar(cat: ModeloCat[]): Indexado[] {
  return cat.map((item) => {
    const nomes = [item.modelo, ...item.apelidos];
    return { item, chaves: nomes.map(compacto).filter(Boolean), toks: nomes.map(tokens), marcaC: compacto(item.marca) };
  });
}

const cacheIdx = new WeakMap<ModeloCat[], Indexado[]>();
function idx(cat: ModeloCat[]) {
  let i = cacheIdx.get(cat);
  if (!i) { i = indexar(cat); cacheIdx.set(cat, i); }
  return i;
}

/**
 * Sugestões enquanto a pessoa digita o modelo.
 * Procura em todas as marcas; a marca escolhida ganha prioridade, mas um modelo de outra marca
 * aparece se combinar melhor (ex.: marca Yamaha + "CB300" -> Honda CB 300F Twister).
 */
export function buscar(cat: ModeloCat[], texto: string, marcaPreferida = "", limite = 8): ModeloCat[] {
  const q = compacto(texto);
  const qt = tokens(texto);
  const mp = compacto(marcaPreferida);
  if (!q) return mp ? idx(cat).filter((x) => x.marcaC === mp).slice(0, limite).map((x) => x.item) : [];
  const res: { item: ModeloCat; s: number }[] = [];
  for (const x of idx(cat)) {
    let s = 0;
    for (const k of x.chaves) {
      if (k === q) s = Math.max(s, 120);
      else if (k.startsWith(q)) s = Math.max(s, 100 - (k.length - q.length));
      else if (k.includes(q)) s = Math.max(s, 70 - (k.length - q.length) / 2);
      else if (q.startsWith(k) && k.length >= 3) s = Math.max(s, 60);
    }
    // todas as palavras digitadas aparecem no nome (ordem livre): "twister 300"
    if (!s && qt.length > 1) {
      for (const t of x.toks) if (qt.every((w) => t.some((p) => p.startsWith(w)))) s = Math.max(s, 55);
    }
    // marca + modelo digitados juntos: "honda cb300"
    if (!s && q.startsWith(x.marcaC)) {
      const resto = q.slice(x.marcaC.length);
      if (resto && x.chaves.some((k) => k.startsWith(resto))) s = 90;
    }
    if (s) res.push({ item: x.item, s: s + (mp && x.marcaC === mp ? 12 : 0) });
  }
  return res.sort((a, b) => b.s - a.s || a.item.modelo.localeCompare(b.item.modelo)).slice(0, limite).map((r) => r.item);
}

/**
 * Identifica a qual modelo do catálogo um texto livre se refere
 * (textos da planilha: "HONDA/XRE 300", "TRIUMPH/TIGER 1200 RA PR", "FAT BOY FLFB").
 */
export function identificar(cat: ModeloCat[], texto: string, marcaDica = ""): ModeloCat | null {
  const tc = compacto(texto);
  if (!tc) return null;
  const tt = new Set(tokens(texto));
  const md = compacto(marcaDica);
  let melhor: { item: ModeloCat; s: number } | null = null;
  for (const x of idx(cat)) {
    let s = 0;
    x.chaves.forEach((k, i) => {
      if (k.length < 2) return;
      if (tc.includes(k)) s = Math.max(s, k.length * 2 + 10);
      else {
        const t = x.toks[i];
        const achou = t.filter((p) => tt.has(p)).length;
        const temNumero = t.some((p) => /\d/.test(p));
        const numeroBate = !temNumero || t.some((p) => /\d/.test(p) && tt.has(p));
        if (t.length && numeroBate && achou / t.length >= 0.75) s = Math.max(s, k.length * (achou / t.length));
      }
    });
    if (!s) continue;
    if (tc.includes(x.marcaC) || (md && md.includes(x.marcaC))) s += 6;
    if (!melhor || s > melhor.s || (s === melhor.s && x.item.modelo.length > melhor.item.modelo.length)) melhor = { item: x.item, s };
  }
  return melhor && melhor.s >= 6 ? melhor.item : null;
}

/** Modelos equivalentes (mesmo segmento), de qualquer marca. */
export function equivalentes(cat: ModeloCat[], item: ModeloCat): ModeloCat[] {
  return cat.filter((x) => x.id !== item.id && x.segmento && x.segmento === item.segmento);
}

export function marcas(cat: ModeloCat[]): string[] {
  return [...new Set(cat.map((x) => x.marca))].sort((a, b) => a.localeCompare(b));
}

export function anosTexto(m: Pick<ModeloCat, "anoIni" | "anoFim">): string {
  if (!m.anoIni && !m.anoFim) return "";
  if (m.anoIni && !m.anoFim) return `${m.anoIni}–atual`;
  if (!m.anoIni) return `até ${m.anoFim}`;
  return m.anoIni === m.anoFim ? String(m.anoIni) : `${m.anoIni}–${m.anoFim}`;
}
