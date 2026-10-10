import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { Sidebar } from "@/components/shell/Sidebar";
import { ConfirmHost, Toaster } from "@/components/ui/feedback";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "RFP Manager",
  description: "Upload tender documents once; read them anywhere through MCP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <div className="app">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
        <CommandPalette />
        <ConfirmHost />
        <Toaster />
      </body>
    </html>
  );
}
