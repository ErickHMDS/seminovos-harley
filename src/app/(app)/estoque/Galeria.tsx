"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { enviarFotoAction, ordenarFotosAction, removerFotoAction } from "./fotosActions";

const mini = (url: string) => (url.startsWith("/api/drive/") ? `${url}?w=480` : url);

type Foto = { id: string; url: string };

/** Reduz a imagem no navegador (máx. 1600 px, JPEG) antes de enviar. */
async function reduzir(arquivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo).catch(() => null);
  if (!bmp) return arquivo;
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.84));
}

/**
 * Galeria da moto. Quem edita (gestor/preparador) tem só o botão "Enviar fotos" — a foto vai
 * para a pasta da moto no Drive e já aparece aqui — e a ordem das fotos (1 = capa), que se
 * muda arrastando (computador) ou pelas setas (celular).
 */
export function Galeria({ fotos, placa, editar, modelo, armazenamento }: { fotos: Foto[]; placa: string; editar: boolean; modelo: string; armazenamento: boolean }) {
  const router = useRouter();
  const [ordem, setOrdem] = useState<string[]>(fotos.map((f) => f.id));
  const chave = fotos.map((f) => f.id).join(",");
  useEffect(() => setOrdem(chave ? chave.split(",") : []), [chave]);
  const lista = ordem.map((id) => fotos.find((f) => f.id === id)).filter((f): f is Foto => !!f);

  const [i, setI] = useState(0);
  const [cheia, setCheia] = useState(false);
  const [enviando, setEnviando] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const toque = useRef<number | null>(null);
  const atual = lista[Math.min(i, Math.max(0, lista.length - 1))];
  const ir = useCallback((d: number) => setI((x) => (lista.length ? (x + d + lista.length) % lista.length : 0)), [lista.length]);

  useEffect(() => {
    if (!cheia) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); if (e.key === "Escape") setCheia(false); };
    document.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [cheia, ir]);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    const sel = [...arquivos];
    for (let n = 0; n < sel.length; n++) {
      setEnviando(`Enviando ${n + 1} de ${sel.length}…`);
      const fd = new FormData();
      fd.set("placa", placa);
      const b = await reduzir(sel[n]);
      fd.set("arquivo", new File([b], sel[n].name.replace(/\.\w+$/, "") + ".jpg", { type: b.type || "image/jpeg" }));
      const r = await enviarFotoAction(fd);
      if (r.erro) { setErro(r.erro); break; }
    }
    setEnviando("");
    router.refresh();
  }

  /** Aplica a nova ordem na tela na hora e grava em seguida. */
  function reordenar(nova: string[]) {
    const atualId = atual?.id;
    setOrdem(nova);
    if (atualId) setI(Math.max(0, nova.indexOf(atualId)));
    setErro("");
    start(async () => { const r = await ordenarFotosAction(placa, nova); if (r.erro) { setErro(r.erro); setOrdem(fotos.map((f) => f.id)); } else router.refresh(); });
  }
  const mover = (id: string, para: number) => {
    const nova = ordem.filter((x) => x !== id);
    nova.splice(Math.max(0, Math.min(para, nova.length)), 0, id);
    if (nova.join() !== ordem.join()) reordenar(nova);
  };
  const remover = (id: string) => {
    if (!confirm("Remover esta foto?")) return;
    setErro("");
    start(async () => { const r = await removerFotoAction(id); if (r.erro) setErro(r.erro); else { setOrdem((o) => o.filter((x) => x !== id)); setI(0); router.refresh(); } });
  };

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { toque.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => { if (toque.current == null) return; const dx = e.changedTouches[0].clientX - toque.current; if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1); toque.current = null; },
  };

  return (
    <div className="galeria">
      <div className="galeria-palco" {...swipe}>
        {atual ? (
          <button type="button" className="galeria-principal" onClick={() => setCheia(true)} aria-label="Ver em tela cheia">
            <img src={atual.url} alt={`${modelo} — foto ${i + 1}`} />
          </button>
        ) : (
          <div className="galeria-vazia"><Icon name="fotos" size={40} /><span>Sem fotos ainda</span>{editar && <small>Envie as fotos oficiais da moto abaixo.</small>}</div>
        )}
        {lista.length > 1 && <>
          <button type="button" className="galeria-seta esq" onClick={() => ir(-1)} aria-label="Foto anterior">‹</button>
          <button type="button" className="galeria-seta dir" onClick={() => ir(1)} aria-label="Próxima foto">›</button>
          <span className="galeria-cont">{i === 0 ? "Capa" : `${i + 1}`} · {i + 1}/{lista.length}</span>
        </>}
      </div>

      {lista.length > 0 && !editar && (
        <div className="galeria-thumbs">
          {lista.map((f, n) => (
            <button key={f.id} type="button" className={`galeria-thumb ${n === i ? "on" : ""}`} onClick={() => setI(n)} aria-label={`Foto ${n + 1}`}>
              <img src={mini(f.url)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {editar && lista.length > 0 && (
        <>
          <ol className={`galeria-ordem ${pending ? "salvando" : ""}`} aria-label="Ordem das fotos (a primeira é a capa)">
            {lista.map((f, n) => (
              <li key={f.id} className={`ordem-item ${n === i ? "on" : ""} ${arrastando === f.id ? "arrastando" : ""}`}
                draggable onDragStart={(e) => { setArrastando(f.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => setArrastando(null)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={(e) => { e.preventDefault(); if (arrastando && arrastando !== f.id) mover(arrastando, n); setArrastando(null); }}>
                <button type="button" className="ordem-foto" onClick={() => setI(n)} aria-label={`Ver foto ${n + 1}`}>
                  <img src={mini(f.url)} alt="" loading="lazy" draggable={false} />
                  <span className={`ordem-num ${n === 0 ? "capa" : ""}`}>{n === 0 ? "Capa" : n + 1}</span>
                </button>
                <div className="ordem-ctrl">
                  <button type="button" onClick={() => mover(f.id, n - 1)} disabled={n === 0 || pending} aria-label="Mover para a esquerda">‹</button>
                  {n !== 0 && <button type="button" onClick={() => mover(f.id, 0)} disabled={pending} aria-label="Tornar capa" title="Tornar capa">★</button>}
                  <button type="button" onClick={() => mover(f.id, n + 1)} disabled={n === lista.length - 1 || pending} aria-label="Mover para a direita">›</button>
                  <button type="button" className="ordem-remover" onClick={() => remover(f.id)} disabled={pending} aria-label="Remover foto" title="Remover">×</button>
                </div>
              </li>
            ))}
          </ol>
          <p className="faint galeria-dica">A 1ª foto é a capa. Arraste para mudar a ordem (no celular, use as setas · ★ torna capa).</p>
        </>
      )}

      {editar && (
        <div className="galeria-acoes">
          {armazenamento ? (
            <label className={`btn small ${enviando ? "busy" : ""}`}>
              <Icon name="fotos" size={15} /> {enviando || "Enviar fotos"}
              <input type="file" accept="image/*" multiple hidden disabled={!!enviando} onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
            </label>
          ) : <span className="faint" style={{ fontSize: 12 }}>Envio de fotos não configurado (Cadastro → Fotos no Google Drive).</span>}
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
      {cheia && atual && createPortal(
        <div className="lightbox" role="dialog" aria-label="Fotos em tela cheia" onClick={() => setCheia(false)} {...swipe}>
          <img src={atual.url} alt={`${modelo} — foto ${i + 1}`} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lightbox-fechar" onClick={() => setCheia(false)} aria-label="Fechar">×</button>
          {lista.length > 1 && <>
            <button type="button" className="galeria-seta esq" onClick={(e) => { e.stopPropagation(); ir(-1); }} aria-label="Foto anterior">‹</button>
            <button type="button" className="galeria-seta dir" onClick={(e) => { e.stopPropagation(); ir(1); }} aria-label="Próxima foto">›</button>
            <span className="galeria-cont">{i + 1}/{lista.length}</span>
          </>}
        </div>,
        document.body,
      )}
    </div>
  );
}
