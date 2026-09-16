import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/lib/i18n";
import { summarizeCatalog } from "@/lib/origin";
import { getCatalog } from "@/lib/trends";
import "./globals.css";

const editorial = Playfair_Display({
  variable: "--font-editorial",
  subsets: ["latin"],
  display: "swap",
});

const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Style Reverie — Inteligencia de tendencias de moda",
  description:
    "Dashboard de tendencias de moda: score compuesto, momentum, ciclo de vida y dónde comprar.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El origen se resuelve una vez aquí y no en cada página: la cabecera es
  // común y la regla es de catálogo, no de ruta.
  const { origins } = await getCatalog();
  const origin = summarizeCatalog(origins).state;

  return (
    <html lang="es" className={`${editorial.variable} ${ui.variable} h-full`}>
      <body className="min-h-full">
        <I18nProvider>
          <AppShell origin={origin}>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
