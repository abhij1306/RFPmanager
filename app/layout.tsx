import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";
import "./design-system.css";

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
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try { if (localStorage.getItem('rfp-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch {}" }} /></head>
      <body>
        <div className="app-frame">
          <AppNav />
          <div className="app-main-column">
            <header className="app-topbar">
              <span className="app-topbar-title">Opportunity workspace</span>
              <div className="app-topbar-actions"><ThemeToggle /></div>
            </header>
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
