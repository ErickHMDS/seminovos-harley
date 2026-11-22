/* eslint-disable @next/next/no-img-element */
export function Brand({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`brand ${grande ? "brand-lg" : ""}`}>
      <img src="/logo-hd.png" alt="Harley-Davidson" className="brand-logo" width={360} height={278} />
      <div className="brand-text">
        <strong>Seminovos</strong>
        <span>Harley · Triumph</span>
      </div>
    </div>
  );
}
