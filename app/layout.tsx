import type { Metadata, Viewport } from "next";
import "./globals.css";
import "driver.js/dist/driver.css";

export const metadata: Metadata = {
  title: "Transactions Demo | Explora el panel",
  description: "Demo interactiva de gestión de transacciones Zelle y finanzas con datos ficticios.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#090b10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
