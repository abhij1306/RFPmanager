import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useDismissable } from "@/components/ui/feedback";
import { displayTitle } from "@/lib/display";
import type { RfpOption } from "@/lib/rfp-queries";

/**
 * A searchable RFP picker. A native <select> sizes its popup to the longest option, and scraped
 * tender names run past the screen edge; this popup stays the width of its field.
 */
export function RfpPicker({ id, onChange, rfps, value }: { id: string; onChange: (id: string) => void; rfps: RfpOption[]; value: string }) {
  const { open, setOpen, ref } = useDismissable<HTMLDivElement>();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = rfps.find((rfp) => rfp.id === value);

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? rfps.filter((rfp) => rfp.client_name.toLowerCase().includes(term)) : rfps;
  }, [query, rfps]);
  const clampedIndex = Math.min(activeIndex, Math.max(0, options.length - 1));

  function openPicker() {
    setQuery("");
    setActiveIndex(Math.max(0, rfps.findIndex((rfp) => rfp.id === value)));
    setOpen(true);
  }

  function choose(option: RfpOption | undefined) {
    if (!option) return;
    onChange(option.id);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(clampedIndex + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(clampedIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[clampedIndex]);
    }
  }

  return (
    <div className="picker" ref={ref}>
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="select picker-trigger"
        id={id}
        onClick={() => (open ? setOpen(false) : openPicker())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openPicker();
          }
        }}
        title={selected?.client_name}
        type="button"
      >
        <span className={selected ? "picker-value" : "picker-value muted"}>{selected ? displayTitle(selected.client_name) : "Choose an RFP…"}</span>
        <ChevronsUpDown size={14} />
      </button>
      {open ? (
        <div className="picker-popover">
          <div className="picker-search">
            <Search size={14} />
            <input
              aria-activedescendant={options[clampedIndex] ? `${listId}-${options[clampedIndex].id}` : undefined}
              aria-controls={listId}
              aria-label="Search RFPs"
              autoFocus
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={onKeyDown}
              placeholder="Search RFPs…"
              ref={searchRef}
              role="combobox"
              aria-expanded="true"
              value={query}
            />
          </div>
          <ul className="picker-list" id={listId} role="listbox">
            {options.map((rfp, index) => (
              <li
                aria-selected={rfp.id === value}
                className="picker-option"
                data-active={index === clampedIndex}
                id={`${listId}-${rfp.id}`}
                key={rfp.id}
                onClick={() => choose(rfp)}
                onMouseMove={() => setActiveIndex(index)}
                role="option"
                title={rfp.client_name}
              >
                <span>{displayTitle(rfp.client_name)}</span>
                {rfp.id === value ? <Check size={14} /> : null}
              </li>
            ))}
            {options.length === 0 ? <li className="palette-empty">No RFPs match “{query}”.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
