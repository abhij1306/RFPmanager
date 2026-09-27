"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("rfp-theme");
    const initial = saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = initial;
    const frame = window.requestAnimationFrame(() => setTheme(initial));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("rfp-theme", next);
    setTheme(next);
  }

  return <button aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} className="theme-toggle" onClick={toggle} type="button">{theme === "light" ? "Dark mode" : "Light mode"}</button>;
}
