import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE GARDEN X",
  description: "Client portal – 3L J4RD1N",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-bg text-white antialiased grid-bg min-h-screen">
        {children}
      </body>
    </html>
  );
}
