import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RFP Manager",
  description: "Team tracker and document converter for RFP workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link className="brand" href="/">
            <span className="brand-mark">R</span>
            <span>RFP Manager</span>
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Tracker</Link>
            <Link href="/convert">Converter</Link>
            <Link href="/bookmarklet">Import</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
