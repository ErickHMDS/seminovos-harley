/* eslint-disable @next/next/no-img-element */
export function Brand({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`brand ${grande ? "brand-lg" : ""}`}>
      <img src="/logo-servopa.png" alt="Grupo Servopa Seminovos Motos" className="brand-logo" width={720} height={144} />
    </div>
  );
}
