export type Theme = "light" | "dark";

export function resolvedTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function subscribeTheme(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", listener);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", listener);
  };
}

export function toggleTheme() {
  const next: Theme = resolvedTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    window.localStorage.setItem("rfp-theme", next);
  } catch {
    /* Storage can be unavailable; the choice still applies to this page. */
  }
}

/** Inline before paint so an explicit choice never flashes the other theme. */
export const themeBootScript =
  "try{var t=localStorage.getItem('rfp-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}";
