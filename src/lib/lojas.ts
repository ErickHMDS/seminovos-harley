/** Nome amigável da aba de estoque ("Estoque CTBA" -> "Curitiba"). */
export function rotuloAba(aba: string): string {
  if (/CTBA|CURITIBA/i.test(aba)) return "Curitiba";
  if (/LOND|LND|LDNA/i.test(aba)) return "Londrina";
  return aba;
}
