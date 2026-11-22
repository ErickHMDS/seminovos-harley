import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // fotos das motos são reduzidas no navegador antes do envio; margem para imagens grandes
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  images: { unoptimized: true },
};

export default nextConfig;
