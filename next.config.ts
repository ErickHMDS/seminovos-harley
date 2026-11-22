import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // fotos das motos são reduzidas no navegador antes do envio; margem para imagens grandes
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // o navegador guarda as telas já vistas/pré-carregadas por alguns segundos: trocar de aba fica instantâneo
    // (gravações e o botão Atualizar limpam esse cache na hora)
    staleTimes: { dynamic: 30, static: 60 },
  },
  images: { unoptimized: true },
};

export default nextConfig;
