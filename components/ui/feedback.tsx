"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/* ── Toasts ──────────────────────────────────────────────────────────── */

type Toast = { id: number; tone: "success" | "error"; message: string };

let toasts: Toast[] = [];
let nextToastId = 0;
const toastListeners = new Set<() => void>();

function emitToasts() {
  for (const listener of toastListeners) listener();
}

export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = ++nextToastId;
  toasts = [...toasts, { id, tone, message }];
  emitToasts();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emitToasts();
  }, tone === "error" ? 6000 : 3200);
}

const emptyToasts: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => toastListeners.delete(listener);
    },
    () => toasts,
    () => emptyToasts,
  );

  return (
    <div aria-live="polite" className="toaster" role="status">
      {items.map((item) => (
        <div className="toast" data-tone={item.tone} key={item.id} role={item.tone === "error" ? "alert" : undefined}>
          {item.tone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Confirm dialog ──────────────────────────────────────────────────── */

type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  resolve: (confirmed: boolean) => void;
};

let pendingConfirm: ConfirmRequest | null = null;
const confirmListeners = new Set<() => void>();

export function confirmAction(options: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirm?.resolve(false);
    pendingConfirm = { ...options, resolve };
    for (const listener of confirmListeners) listener();
  });
}

export function ConfirmHost() {
  const request = useSyncExternalStore(
    (listener) => {
      confirmListeners.add(listener);
      return () => confirmListeners.delete(listener);
    },
    () => pendingConfirm,
    () => null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  function settle(confirmed: boolean) {
    if (!pendingConfirm) return;
    const { resolve } = pendingConfirm;
    pendingConfirm = null;
    for (const listener of confirmListeners) listener();
    resolve(confirmed);
  }

  return (
    <dialog aria-labelledby="confirm-title" className="dialog" onCancel={(event) => { event.preventDefault(); settle(false); }} ref={dialogRef}>
      {request ? (
        <>
          <div className="dialog-body">
            <h2 id="confirm-title">{request.title}</h2>
            {request.body ? <p>{request.body}</p> : null}
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => settle(false)} type="button">Cancel</button>
            <button autoFocus className={`btn ${request.tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={() => settle(true)} type="button">
              {request.confirmLabel}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/* ── Dropdown menu ───────────────────────────────────────────────────── */

export function useDismissable<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}
