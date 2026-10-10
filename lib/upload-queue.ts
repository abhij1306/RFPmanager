"use client";

import { useSyncExternalStore } from "react";
import { convertFile, getAllowedFileSourceType } from "@/lib/document-conversion";
import { createDocument } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";
import { deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
import type { RfpDocument, RfpFile } from "@/lib/types";

export type UploadState =
  | { kind: "queued" }
  | { kind: "working" }
  | { kind: "done"; document: RfpDocument; sourceFile: RfpFile }
  | { kind: "failed"; message: string };

export type UploadItem = {
  id: string;
  rfpId: string;
  file: File;
  state: UploadState;
};

const CONCURRENCY = 3;

let items: UploadItem[] = [];
const listeners = new Set<() => void>();
let unloadGuardInstalled = false;

function emit() {
  for (const listener of listeners) listener();
}

function update(id: string, state: UploadState) {
  items = items.map((item) => (item.id === id ? { ...item, state } : item));
  emit();
}

function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, "") || file.name;
}

async function processItem(item: UploadItem) {
  update(item.id, { kind: "working" });
  let sourceFile: RfpFile | null = null;
  try {
    getAllowedFileSourceType(item.file.name);
    const title = fileTitle(item.file);
    // The original upload and the in-browser conversion are independent, so run them together.
    // allSettled waits for both, so a fast conversion failure can't race past an upload still in flight.
    const [conversion, upload] = await Promise.allSettled([
      convertFile(item.file),
      uploadRfpFile({
        body: item.file,
        kind: "source",
        mimeType: item.file.type || null,
        originalFilename: item.file.name,
        rfpId: item.rfpId,
        status: "Converted",
        title,
      }),
    ]);
    if (upload.status === "fulfilled") sourceFile = upload.value;
    if (conversion.status === "rejected") throw conversion.reason;
    if (upload.status === "rejected") throw upload.reason;
    const document = await createDocument({
      rfp_id: item.rfpId,
      source_file_id: upload.value.id,
      title,
      source_filename: item.file.name,
      source_type: conversion.value.sourceType,
      markdown: conversion.value.markdown,
    });
    update(item.id, { kind: "done", document, sourceFile: upload.value });
  } catch (error) {
    if (sourceFile) await deleteRfpFile(sourceFile).catch(() => undefined);
    update(item.id, { kind: "failed", message: getErrorMessage(error, "Upload failed.") });
  }
}

function pump() {
  const active = items.filter((item) => item.state.kind === "working").length;
  const next = items.filter((item) => item.state.kind === "queued").slice(0, Math.max(0, CONCURRENCY - active));
  for (const item of next) {
    void processItem(item).then(pump);
  }
}

function installUnloadGuard() {
  if (unloadGuardInstalled || typeof window === "undefined") return;
  unloadGuardInstalled = true;
  window.addEventListener("beforeunload", (event) => {
    if (items.some((item) => item.state.kind === "queued" || item.state.kind === "working")) event.preventDefault();
  });
}

export function enqueueUploads(rfpId: string, files: File[]) {
  if (files.length === 0) return;
  installUnloadGuard();
  items = [
    ...items,
    ...files.map((file) => ({ id: crypto.randomUUID(), rfpId, file, state: { kind: "queued" } as const })),
  ];
  emit();
  pump();
}

export function retryUpload(id: string) {
  update(id, { kind: "queued" });
  pump();
}

export function dismissUploads(rfpId: string) {
  items = items.filter((item) => item.rfpId !== rfpId || item.state.kind === "queued" || item.state.kind === "working");
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emptyItems: UploadItem[] = [];

export function useUploads(): UploadItem[] {
  return useSyncExternalStore(subscribe, () => items, () => emptyItems);
}

export function isUploadActive(item: UploadItem): boolean {
  return item.state.kind === "queued" || item.state.kind === "working";
}
