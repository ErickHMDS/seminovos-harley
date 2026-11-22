"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { capaAction, enviarFotoAction, importarDriveAction, removerFotoAction } from "./fotosActions";

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

export function Galeria({ fotos, placa, editar, modelo, armazenamento, drive = false }: { fotos: Foto[]; placa: string; editar: boolean; modelo: string; armazenamento: boolean; drive?: boolean }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [cheia, setCheia] = useState(false);
  const [enviando, setEnviando] = useState("");
  const [erro, setErro] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const toque = useRef<number | null>(null);
  const atual = fotos[Math.min(i, Math.max(0, fotos.length - 1))];
  const ir = useCallback((d: number) => setI((x) => (fotos.length ? (x + d + fotos.length) % fotos.length : 0)), [fotos.length]);

  useEffect(() => {
    if (!cheia) return;
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); if (e.key === "Escape") setCheia(false); };
    document.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [cheia, ir]);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    const lista = [...arquivos];
    for (let n = 0; n < lista.length; n++) {
      setEnviando(`Enviando ${n + 1} de ${lista.length}…`);
      const fd = new FormData();
      fd.set("placa", placa);
      const b = await reduzir(lista[n]);
      fd.set("arquivo", new File([b], lista[n].name.replace(/\.\w+$/, "") + ".jpg", { type: b.type || "image/jpeg" }));
      const r = await enviarFotoAction(fd);
      if (r.erro) { setErro(r.erro); break; }
    }
    setEnviando("");
    router.refresh();
  }

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
        {fotos.length > 1 && <>
          <button type="button" className="galeria-seta esq" onClick={() => ir(-1)} aria-label="Foto anterior">‹</button>
          <button type="button" className="galeria-seta dir" onClick={() => ir(1)} aria-label="Próxima foto">›</button>
          <span className="galeria-cont">{i + 1}/{fotos.length}</span>
        </>}
      </div>
      {fotos.length > 0 && (
        <div className="galeria-thumbs">
          {fotos.map((f, n) => (
            <button key={f.id} type="button" className={`galeria-thumb ${n === i ? "on" : ""}`} onClick={() => setI(n)} aria-label={`Foto ${n + 1}`}>
              <img src={mini(f.url)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {editar && (
        <div className="galeria-acoes">
          {armazenamento ? (
            <label className="btn small">
              <Icon name="fotos" size={15} /> {enviando || "Enviar fotos"}
              <input type="file" accept="image/*" multiple hidden disabled={!!enviando} onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
            </label>
          ) : !drive && <span className="faint" style={{ fontSize: 12 }}>Envio de arquivos: configure o Vercel Blob. Enquanto isso, adicione por link.</span>}
          {drive && (
            <button type="button" className="btn small ghost btn-drive" disabled={pending} onClick={() => { setErro(""); setMsg(""); start(async () => { const r = await importarDriveAction(placa); if (r.erro) setErro(r.erro); else { setMsg(r.msg ?? ""); router.refresh(); } }); }}>
              <Icon name="fotos" size={15} /> {pending ? "Procurando no Drive…" : "Importar do Google Drive"}
            </button>
          )}
          <form className="galeria-link" onSubmit={(e) => { e.preventDefault(); setErro(""); setMsg(""); const fd = new FormData(); fd.set("placa", placa); fd.set("link", link); start(async () => { const r = await enviarFotoAction(fd); if (r.erro) setErro(r.erro); else { setLink(""); router.refresh(); } }); }}>
            <input className="input" placeholder="ou cole o link de uma foto ou pasta do Drive" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn small ghost" disabled={pending || !link}>Adicionar</button>
          </form>
          {atual && (
            <div className="galeria-mini-acoes">
              {i !== 0 && <button type="button" className="link-btn" disabled={pending} onClick={() => start(async () => { await capaAction(atual.id); setI(0); router.refresh(); })}>Usar como capa</button>}
              <button type="button" className="link-btn" disabled={pending} onClick={() => start(async () => { if (confirm("Remover esta foto?")) { await removerFotoAction(atual.id); setI(0); router.refresh(); } })}>Remover foto</button>
            </div>
          )}
        </div>
      )}
      {erro && <div className="alert bad">{erro}</div>}
      {msg && !erro && <div className="alert ok">{msg}</div>}
      {cheia && atual && createPortal(
        <div className="lightbox" role="dialog" aria-label="Fotos em tela cheia" onClick={() => setCheia(false)} {...swipe}>
          <img src={atual.url} alt={`${modelo} — foto ${i + 1}`} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lightbox-fechar" onClick={() => setCheia(false)} aria-label="Fechar">×</button>
          {fotos.length > 1 && <>
            <button type="button" className="galeria-seta esq" onClick={(e) => { e.stopPropagation(); ir(-1); }} aria-label="Foto anterior">‹</button>
            <button type="button" className="galeria-seta dir" onClick={(e) => { e.stopPropagation(); ir(1); }} aria-label="Próxima foto">›</button>
            <span className="galeria-cont">{i + 1}/{fotos.length}</span>
          </>}
        </div>,
        document.body,
      )}
    </div>
  );
}
