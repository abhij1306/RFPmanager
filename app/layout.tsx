import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

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
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en">
      <body>
        <header className="app-header">
          <div className="header-left">
            <Link className="brand" href="/">
              <span className="brand-mark">RFP</span>
              <span className="brand-name">Manager</span>
            </Link>
            <label className="global-search">
              <span aria-hidden="true">⌕</span>
              <input placeholder="Search proposals, clients..." type="search" />
            </label>
          </div>
          <div className="header-right">
            <AppNav />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
