"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Tracker" },
  { href: "/convert", label: "Converter" },
  { href: "/bookmarklet", label: "Import" },
];

const gptUrl = "https://chatgpt.com/g/g-6a29229f32f081918ddc591bc44909fc-rfp-manager";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/rfp");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      {navItems.map((item) => (
        <Link className={isActive(pathname, item.href) ? "active" : undefined} href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
      <a className="gpt-nav-link" href={gptUrl} rel="noreferrer" target="_blank">
        RFP GPT
      </a>
    </nav>
  );
}
