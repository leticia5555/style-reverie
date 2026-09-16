import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./lib/editorial-image";

const devImageHosts = (process.env.SR_IMAGE_HOSTS ?? "")
  .split(",")
  .map((hostname) => hostname.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  images: {
    /**
     * Next bloquea imágenes que resuelven a IP privada por SSRF. Solo se
     * relaja cuando se declaran hosts de desarrollo a propósito; en producción
     * SR_IMAGE_HOSTS va vacío y la guarda sigue activa.
     */
    dangerouslyAllowLocalIP: devImageHosts.length > 0,
    /**
     * Hosts de imagen de las cuatro fuentes editoriales. La lista vive en
     * lib/editorial-image.ts y se comparte con el componente: si llega una
     * imagen de un host que no está aquí, la tarjeta pinta el placeholder en
     * vez de dejar que next/image lance en runtime.
     */
    remotePatterns: [
      ...IMAGE_HOSTS.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
      // Hosts extra de desarrollo (SR_IMAGE_HOSTS), para probar sin salir a red.
      ...devImageHosts.map((hostname) => ({
        protocol: "http" as const,
        hostname,
      })),
    ],
  },
};

export default nextConfig;
