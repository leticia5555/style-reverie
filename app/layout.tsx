import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/lib/i18n";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${editorial.variable} ${ui.variable} h-full`}>
      <body className="min-h-full">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
