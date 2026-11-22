/* eslint-disable @next/next/no-img-element */
/** Marca: símbolo "S" (imagem) + nome em texto — a grafia "SEMINOVOS" fica sempre correta. */
export function Brand({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`brand ${grande ? "brand-lg" : ""}`} aria-label="Grupo Servopa Seminovos Motos">
      <img src="/logo-simbolo.png" alt="" className="brand-simbolo" width={264} height={240} />
      <div className="brand-nome" aria-hidden>
        <span className="bn-grupo">Grupo Servopa</span>
        <span className="bn-semi">Seminovos</span>
        <span className="bn-motos">Motos</span>
      </div>
    </div>
  );
}
