import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las páginas.
 * - Permissions-Policy: la cámara solo para esta web (el escáner QR); micrófono y ubicación, nunca.
 * - Sin «allowedOrigins: ["*"]» para server actions: la web no usa server actions y el comodín permitía
 *   llamadas desde cualquier otro sitio.
 */
const seguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: seguridad }];
  },
};

export default nextConfig;
