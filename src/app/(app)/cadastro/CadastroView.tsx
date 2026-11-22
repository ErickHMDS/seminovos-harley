"use client";
import { useFormAction } from "@/components/useFormAction";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { criarPessoa, editarPessoa, novaSenha, salvarCoordenadores, salvarPastaDrive, criarPastasAction, sugerirSenha, type CadState } from "./actions";

export type PessoaVM = { id: string; nome: string; perfil: "gestor" | "vendedor" | "preparador"; vendedor: string; telefone: string; ativo: boolean; atualizadoEm: string };
export type VendedorVM = { nome: string; curto: string; pos: number; vendas: number; objetivo: number | null };

const PERFIL_LABEL = { gestor: "Gestor", vendedor: "Vendedor", preparador: "Preparador" } as const;
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** Mostra a senha uma única vez, com copiar e enviar por WhatsApp. */
function SenhaCriada({ senha, nome, telefone, url, onFechar }: { senha: string; nome: string; telefone: string; url: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const msg = `Olá, ${nome.split(" ")[0]}! Seu acesso ao app Servopa Seminovos:\n${url}\nSua senha: ${senha}\n(Não compartilhe a sua senha.)`;
  const wa = `https://wa.me/${telefone.replace(/\D/g, "").replace(/^(?!55)(\d{10,11})$/, "55$1")}?text=${encodeURIComponent(msg)}`;
  return (
    <div className="senha-card" role="status">
      <div>
        <div className="filter-label">Senha de {nome}</div>
        <div className="senha-valor">{senha}</div>
        <p className="faint" style={{ margin: "4px 0 0", fontSize: 12 }}>Ela não será mostrada de novo. Envie agora para a pessoa.</p>
      </div>
      <div className="email-actions">
        <a className="btn small" href={wa} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
        <button type="button" className="btn small ghost" onClick={async () => { await navigator.clipboard.writeText(msg).catch(() => {}); setCopiado(true); }}>{copiado ? "Copiado ✓" : "Copiar mensagem"}</button>
        <button type="button" className="link-btn" onClick={onFechar}>Fechar</button>
      </div>
    </div>
  );
}

function CamposPessoa({ p, vendedores, perfilInicial }: { p?: Partial<PessoaVM>; vendedores: VendedorVM[]; perfilInicial?: PessoaVM["perfil"] }) {
  const [perfil, setPerfil] = useState<PessoaVM["perfil"]>(p?.perfil ?? perfilInicial ?? "vendedor");
  return (
    <div className="form-grid">
      <div className="field span-2"><label>Nome</label><input name="nome" className="input" defaultValue={p?.nome} required /></div>
      <div className="field">
        <span className="label">Perfil</span>
        <div className="toggle wide-toggle" role="radiogroup" aria-label="Perfil">
          {(["vendedor", "preparador", "gestor"] as const).map((k) => (
            <label key={k}><input type="radio" name="perfil" value={k} checked={perfil === k} onChange={() => setPerfil(k)} /><span>{PERFIL_LABEL[k]}</span></label>
          ))}
        </div>
      </div>
      {perfil === "vendedor" && (
        <div className="field span-2">
          <label>Nome na planilha de vendas</label>
          <select name="vendedor" className="input" defaultValue={p?.vendedor ?? ""} required>
            <option value="" disabled>Escolha…</option>
            {[...new Set([...(p?.vendedor ? [p.vendedor] : []), ...vendedores.map((v) => v.nome)])].map((n) => <option key={n} value={n}>{titulo(n)}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label>WhatsApp</label><input name="telefone" className="input" inputMode="tel" defaultValue={p?.telefone} placeholder="41 99999-9999" /></div>
    </div>
  );
}

function NovaPessoa({ vendedores, url, preset, onFechar }: { vendedores: VendedorVM[]; url: string; preset: Partial<PessoaVM> | null; onFechar: () => void }) {
  const [state, onSubmit, pending] = useFormAction<CadState>(criarPessoa, {});
  const [senha, setSenha] = useState("");
  const [gerando, startGerar] = useTransition();
  const router = useRouter();
  // sugestão inicial não sobrescreve o que a pessoa já digitou
  useEffect(() => { startGerar(async () => { const g = await sugerirSenha(); setSenha((atual) => atual || g); }); }, []);
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, router]);
  if (state.ok && state.senha) return <SenhaCriada senha={state.senha} nome={state.nome!} telefone={state.telefone ?? ""} url={url} onFechar={onFechar} />;
  return (
    <form onSubmit={onSubmit} className="sec cat-form">
      <div className="sec-head"><h2 className="sec-title">Nova pessoa</h2><button type="button" className="link-btn" onClick={onFechar}>Fechar</button></div>
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
        <CamposPessoa p={preset ?? undefined} vendedores={vendedores} />
        <div className="field" style={{ marginTop: 12 }}>
          <label>Senha de acesso</label>
          <div className="senha-wrap">
            <input name="senha" className="input mono" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={4} />
            <button type="button" className="senha-ver" onClick={() => startGerar(async () => setSenha(await sugerirSenha()))}>{gerando ? "…" : "Gerar"}</button>
          </div>
        </div>
      </fieldset>
      {state.erro && <div className="alert bad" style={{ marginTop: 12 }}>{state.erro}</div>}
      <div className="cat-form-actions"><button className="btn" disabled={pending || !senha} style={{ marginLeft: "auto" }}>{pending ? "Salvando…" : "Criar acesso"}</button></div>
    </form>
  );
}

function Pessoa({ p, vendedores, url }: { p: PessoaVM; vendedores: VendedorVM[]; url: string }) {
  const [modo, setModo] = useState<"" | "editar" | "senha">("");
  const [state, onSubmit, pending] = useFormAction<CadState>(editarPessoa, {});
  const [senha, setSenha] = useState("");
  const [res, setRes] = useState<CadState | null>(null);
  const [trabalhando, start] = useTransition();
  const router = useRouter();
  useEffect(() => { if (state.ok) { setModo(""); router.refresh(); } }, [state.ok, router]);
  const vend = vendedores.find((v) => v.nome === p.vendedor);
  return (
    <li className={`pessoa ${p.ativo ? "" : "inativa"}`}>
      <div className="pessoa-row">
        <div className="pessoa-avatar" aria-hidden>{p.nome.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</div>
        <div className="pessoa-info">
          <strong>{p.nome}</strong>
          <div className="pessoa-meta">
            <span className={`badge ${p.perfil === "gestor" ? "accent" : p.perfil === "preparador" ? "warn" : ""}`}>{PERFIL_LABEL[p.perfil]}</span>
            {p.perfil === "vendedor" && <span>{vend ? `${vend.pos}º no ranking · ${vend.vendas} vendas` : titulo(p.vendedor || "sem vínculo")}</span>}
            {!p.ativo && <span className="badge bad">desativado</span>}
          </div>
        </div>
        <div className="pessoa-acoes">
          <button type="button" className="btn small ghost" onClick={() => { setModo(modo === "senha" ? "" : "senha"); setRes(null); setSenha(""); start(async () => { const g = await sugerirSenha(); setSenha((atual) => atual || g); }); }}>Senha</button>
          <button type="button" className="btn small ghost" onClick={() => setModo(modo === "editar" ? "" : "editar")}>Editar</button>
        </div>
      </div>
      {modo === "editar" && (
        <form onSubmit={onSubmit} className="pessoa-form">
          <input type="hidden" name="id" value={p.id} />
          <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
            <CamposPessoa p={p} vendedores={vendedores} />
            <label className="check" style={{ marginTop: 10 }}><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Acesso ativo</label>
          </fieldset>
          {state.erro && <div className="alert bad" style={{ marginTop: 10 }}>{state.erro}</div>}
          <div className="cat-form-actions"><button className="btn small" disabled={pending} style={{ marginLeft: "auto" }}>{pending ? "Salvando…" : "Salvar"}</button></div>
        </form>
      )}
      {modo === "senha" && (res?.senha ? (
        <SenhaCriada senha={res.senha} nome={p.nome} telefone={p.telefone} url={url} onFechar={() => { setModo(""); setRes(null); }} />
      ) : (
        <div className="pessoa-form">
          <div className="field">
            <label>Nova senha para {p.nome.split(" ")[0]}</label>
            <div className="senha-wrap">
              <input className="input mono" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={4} />
              <button type="button" className="senha-ver" onClick={() => start(async () => setSenha(await sugerirSenha()))}>Gerar</button>
            </div>
            <span className="faint" style={{ fontSize: 12 }}>A senha antiga deixa de funcionar e a pessoa precisa entrar de novo.</span>
          </div>
          {res?.erro && <div className="alert bad" style={{ marginTop: 10 }}>{res.erro}</div>}
          <div className="cat-form-actions">
            <button type="button" className="btn small" disabled={trabalhando || senha.length < 4} style={{ marginLeft: "auto" }}
              onClick={() => start(async () => { const r = await novaSenha(p.id, senha, p.nome, p.telefone); setRes(r); if (r.ok) router.refresh(); })}>
              {trabalhando ? "Salvando…" : "Redefinir senha"}
            </button>
          </div>
        </div>
      ))}
    </li>
  );
}

function Coordenadores({ emails }: { emails: string }) {
  const [state, onSubmit, pending] = useFormAction<CadState>(salvarCoordenadores, {});
  return (
    <form onSubmit={onSubmit} className="sec">
      <h2 className="sec-title">E-mails dos coordenadores</h2>
      <p className="faint" style={{ marginTop: -6, fontSize: 13 }}>Recebem o resumo da inspeção 360. Separe vários com vírgula.</p>
      <div className="quick-add" style={{ marginBottom: 0 }}>
        <input name="emails" className="input" defaultValue={emails} placeholder="coordenador@servopa.com.br, outro@servopa.com.br" />
        <button className="btn" disabled={pending}>{pending ? "…" : "Salvar"}</button>
      </div>
      {state.erro && <div className="alert bad" style={{ marginTop: 10 }}>{state.erro}</div>}
      {state.ok && <div className="alert ok toast" style={{ marginTop: 10 }}>E-mails salvos.</div>}
    </form>
  );
}

function PastaDrive({ pasta, conta }: { pasta: string; conta: string }) {
  const [state, onSubmit, pending] = useFormAction<CadState & { msg?: string }>(salvarPastaDrive, {});
  const [lote, iniciar] = useTransition();
  const [res, setRes] = useState<(CadState & { msg?: string }) | null>(null);
  return (
    <form onSubmit={onSubmit} className="sec">
      <h2 className="sec-title">Fotos no Google Drive</h2>
      <p className="faint" style={{ marginTop: -6, fontSize: 13 }}>
        Pasta com uma subpasta por moto (com a placa no nome). Compartilhe a pasta como <b>Editor</b> com{" "}
        <code className="copiavel">{conta || "a conta de serviço do app"}</code>. O app cria sozinho a subpasta de cada moto nova; na ficha, “Importar do Google Drive” traz as fotos.
      </p>
      <div className="quick-add" style={{ marginBottom: 0 }}>
        <input name="pasta" className="input" defaultValue={pasta} placeholder="https://drive.google.com/drive/folders/…" />
        <button className="btn" disabled={pending}>{pending ? "Conferindo…" : "Salvar"}</button>
      </div>
      {state.erro && <div className="alert bad" style={{ marginTop: 10 }}>{state.erro}</div>}
      {state.ok && <div className="alert ok" style={{ marginTop: 10 }}>{state.msg ?? "Salvo."}</div>}
      {(pasta || state.ok) && (
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn small ghost" disabled={lote} onClick={() => { setRes(null); iniciar(async () => setRes(await criarPastasAction())); }}>
            {lote ? "Criando pastas…" : "Criar pastas das motos do estoque"}
          </button>
          {pasta && <a href={pasta} target="_blank" rel="noopener noreferrer" className="link-more">abrir no Drive ↗</a>}
          {res?.erro && <div className="alert bad" style={{ flexBasis: "100%" }}>{res.erro}</div>}
          {res?.ok && <div className="alert ok" style={{ flexBasis: "100%" }}>{res.msg}</div>}
        </div>
      )}
    </form>
  );
}

export function CadastroView({ pessoas, vendedores, emails, url, pasta = "", conta = "" }: { pessoas: PessoaVM[]; vendedores: VendedorVM[]; emails: string; url: string; pasta?: string; conta?: string }) {
  const [nova, setNova] = useState<{ preset: Partial<PessoaVM> | null } | null>(null);
  const [filtro, setFiltro] = useState<"" | PessoaVM["perfil"]>("");
  const comAcesso = new Map(pessoas.filter((p) => p.perfil === "vendedor" && p.vendedor).map((p) => [p.vendedor, p]));
  const lista = pessoas.filter((p) => !filtro || p.perfil === filtro).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  const cont = (k: PessoaVM["perfil"]) => pessoas.filter((p) => p.perfil === k && p.ativo).length;

  return (
    <div className="cadastro">
      <section>
        <div className="panel-head">
          <h2>Equipe <span className="faint" style={{ fontSize: 14 }}>({pessoas.filter((p) => p.ativo).length} ativos)</span></h2>
          <button type="button" className="btn small" onClick={() => setNova({ preset: null })}>+ Nova pessoa</button>
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" aria-pressed={!filtro} onClick={() => setFiltro("")}>Todos</button>
          {(["vendedor", "preparador", "gestor"] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(filtro === k ? "" : k)}>{PERFIL_LABEL[k]}s · {cont(k)}</button>
          ))}
        </div>
        {nova && <NovaPessoa key={JSON.stringify(nova.preset)} vendedores={vendedores} url={url} preset={nova.preset} onFechar={() => setNova(null)} />}
        {pessoas.length === 0 && !nova && (
          <div className="empty-state"><div className="empty-icon">👤</div><strong>Ninguém cadastrado ainda</strong><span>Comece criando o acesso dos vendedores abaixo.</span></div>
        )}
        <ul className="pessoa-list">{lista.map((p) => <Pessoa key={p.id} p={p} vendedores={vendedores} url={url} />)}</ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="panel-head"><h2>Vendedores da planilha</h2><span className="hint">classificação do mês</span></div>
        <ul className="simple-list panel">
          {vendedores.map((v) => {
            const p = comAcesso.get(v.nome);
            return (
              <li key={v.nome} className="simple-row">
                <span className={`rank-pos ${v.pos <= 3 && v.vendas ? "top" : ""}`}>{v.pos}</span>
                <span className="simple-main">{v.curto}<small>{v.vendas} vendas{v.objetivo ? ` · meta ${v.objetivo}` : ""}</small></span>
                {p ? <span className={`badge ${p.ativo ? "ok" : "bad"}`}>{p.ativo ? "com acesso" : "desativado"}</span>
                  : <button type="button" className="btn small ghost" onClick={() => setNova({ preset: { nome: titulo(v.nome), perfil: "vendedor", vendedor: v.nome } })}>Criar acesso</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <Coordenadores emails={emails} />
        <PastaDrive pasta={pasta} conta={conta} />
        <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          A senha mestra do administrador fica no servidor (variável SENHA_GESTOR) e sempre funciona — use-a se alguém perder o acesso.
          As senhas da equipe ficam embaralhadas (hash) na aba “Usuários App”; ninguém consegue lê-las na planilha.
        </p>
      </section>
    </div>
  );
}
