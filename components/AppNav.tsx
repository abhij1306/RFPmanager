"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Pipeline" },
  { href: "/rfp/new", label: "New opportunity" },
  { href: "/convert", label: "Document converter" },
  { href: "/bookmarklet", label: "Capture from portal" },
];

const gptUrl = "https://chatgpt.com/g/g-6a29229f32f081918ddc591bc44909fc-rfp-manager";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || (pathname.startsWith("/rfp/") && pathname !== "/rfp/new");

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link className="app-brand" href="/"><span aria-hidden="true" className="app-brand-mark">R</span><span>RFP Manager</span></Link>
      <span className="app-nav-label">Workspace</span>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link aria-current={isActive(pathname, item.href) ? "page" : undefined} className={isActive(pathname, item.href) ? "active" : undefined} href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="app-sidebar-bottom">
        <span className="app-nav-label">Connected tools</span>
        <a href={gptUrl} rel="noreferrer" target="_blank">Open shared RFP GPT ↗</a>
      </div>
    </aside>
  );
}
