"use client";

import { FileText, Moon, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { displayTitle } from "@/lib/display";
import { listRfpIndex, type RfpListItem } from "@/lib/rfp-queries";
import { toggleTheme } from "@/lib/theme";

const OPEN_EVENT = "rfp:open-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type PaletteItem =
  | { kind: "rfp"; id: string; title: string; detail: string; href: string }
  | { kind: "action"; id: "new" | "convert" | "theme"; title: string };

export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rfps, setRfps] = useState<RfpListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    function open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setQuery("");
      setActiveIndex(0);
      dialog.showModal();
      // Refresh on every open so newly created RFPs show up; the list is small.
      listRfpIndex().then(
        (items) => { setRfps(items); setLoadError(false); },
        () => setLoadError(true),
      );
    }
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }
    window.addEventListener(OPEN_EVENT, open);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, open);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const term = query.trim().toLowerCase();
    const actions: PaletteItem[] = [
      { kind: "action", id: "new", title: "Create new RFP" },
      { kind: "action", id: "convert", title: "Open document converter" },
      { kind: "action", id: "theme", title: "Toggle light / dark theme" },
    ];
    const rfpItems: PaletteItem[] = (rfps ?? [])
      .filter((rfp) => !term || `${rfp.client_name} ${rfp.tender_code ?? ""}`.toLowerCase().includes(term))
      .slice(0, 50)
      .map((rfp) => ({
        kind: "rfp",
        id: rfp.id,
        title: displayTitle(rfp.client_name),
        detail: [rfp.tender_code, `${rfp.document_count} documents`].filter(Boolean).join(" · "),
        href: `/rfp/${rfp.id}`,
      }));
    return [...rfpItems, ...actions.filter((action) => !term || action.title.toLowerCase().includes(term))];
  }, [query, rfps]);

  const clampedIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  function choose(item: PaletteItem | undefined) {
    if (!item) return;
    dialogRef.current?.close();
    if (item.kind === "rfp") router.push(item.href);
    else if (item.id === "new") router.push("/rfp/new");
    else if (item.id === "convert") router.push("/convert");
    else toggleTheme();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((clampedIndex + 1) % Math.max(1, items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((clampedIndex - 1 + items.length) % Math.max(1, items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(items[clampedIndex]);
    }
  }

  const firstActionIndex = items.findIndex((item) => item.kind === "action");

  return (
    <dialog aria-label="Search RFPs" className="palette" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} ref={dialogRef}>
      <div className="palette-input">
        <Search size={16} />
        <input
          aria-activedescendant={items[clampedIndex] ? `palette-${items[clampedIndex].id}` : undefined}
          aria-controls="palette-list"
          aria-label="Search RFPs and actions"
          autoFocus
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={onKeyDown}
          placeholder="Search RFPs by name or tender code…"
          role="combobox"
          aria-expanded="true"
          value={query}
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <ul className="palette-list" id="palette-list" role="listbox">
        {rfps === null && !loadError ? <li className="palette-empty">Loading RFPs…</li> : null}
        {loadError ? <li className="palette-empty">Could not load RFPs. Actions still work.</li> : null}
        {items.map((item, index) => (
          <li key={item.id} role="presentation">
            {index === 0 && item.kind === "rfp" ? <div aria-hidden="true" className="palette-group">RFPs</div> : null}
            {index === firstActionIndex ? <div aria-hidden="true" className="palette-group">Actions</div> : null}
            <div
              aria-selected={index === clampedIndex}
              className="palette-item"
              id={`palette-${item.id}`}
              onClick={() => choose(item)}
              onMouseMove={() => setActiveIndex(index)}
              role="option"
            >
              {item.kind === "action" && item.id === "new" ? <Plus size={16} /> : item.kind === "action" && item.id === "theme" ? <Moon size={16} /> : <FileText size={16} />}
              <span className="palette-item-main">
                <strong>{item.title}</strong>
                {item.kind === "rfp" && item.detail ? <span>{item.detail}</span> : null}
              </span>
            </div>
          </li>
        ))}
        {rfps !== null && items.length === 0 ? <li className="palette-empty">No RFPs match “{query}”.</li> : null}
      </ul>
    </dialog>
  );
}
