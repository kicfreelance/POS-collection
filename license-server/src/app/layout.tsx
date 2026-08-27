import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "License Server",
  description: "Licensing backend for pos-app and POS-DUALSCREEN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
