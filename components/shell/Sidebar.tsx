"use client";

import { FileText, Files, Bookmark, Loader2, Moon, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { openCommandPalette } from "@/components/shell/CommandPalette";
import { resolvedTheme, subscribeTheme, toggleTheme } from "@/lib/theme";
import { isUploadActive, useUploads } from "@/lib/upload-queue";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || (pathname.startsWith("/rfp/") && pathname !== "/rfp/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UploadIndicator() {
  const uploads = useUploads();
  const active = uploads.filter(isUploadActive);
  if (active.length === 0) return null;
  const finished = uploads.filter((item) => item.state.kind === "done" || item.state.kind === "failed").length;
  const total = uploads.length;

  return (
    <div className="sidebar-upload" role="status">
      <div className="sidebar-upload-row">
        <Loader2 className="spin" size={14} />
        Uploading documents
        <span className="muted tabular" style={{ marginLeft: "auto" }}>{finished}/{total}</span>
      </div>
      <div className="progress"><span style={{ transform: `scaleX(${finished / total})` }} /></div>
    </div>
  );
}

function ThemeButton() {
  const theme = useSyncExternalStore(subscribeTheme, resolvedTheme, () => "light" as const);
  return (
    <button className="nav-link" onClick={toggleTheme} type="button">
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link className="sidebar-brand" href="/">
        <span aria-hidden="true" className="sidebar-brand-mark"><FileText size={13} strokeWidth={2.4} /></span>
        RFP Manager
      </Link>

      <button className="sidebar-search" onClick={openCommandPalette} type="button">
        <Search size={14} />
        <span>Search RFPs</span>
        <kbd className="kbd">Ctrl K</kbd>
      </button>

      <nav aria-label="Primary" className="stack" style={{ gap: 2 }}>
        <Link aria-current={isActive(pathname, "/") ? "page" : undefined} className="nav-link" href="/">
          <Files size={16} />
          RFPs
        </Link>
        <Link aria-current={pathname === "/rfp/new" ? "page" : undefined} className="nav-link" href="/rfp/new">
          <Plus size={16} />
          New RFP
        </Link>
      </nav>

      <span className="sidebar-section-label">Tools</span>
      <nav aria-label="Tools" className="stack" style={{ gap: 2 }}>
        <Link aria-current={isActive(pathname, "/convert") ? "page" : undefined} className="nav-link" href="/convert">
          <FileText size={16} />
          Document converter
        </Link>
        <Link aria-current={isActive(pathname, "/bookmarklet") ? "page" : undefined} className="nav-link" href="/bookmarklet">
          <Bookmark size={16} />
          Capture bookmarklet
        </Link>
      </nav>

      <div className="sidebar-footer">
        <UploadIndicator />
        <ThemeButton />
      </div>
    </aside>
  );
}
