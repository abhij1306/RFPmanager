"use client";

import { useSyncExternalStore } from "react";
import { RFPForm } from "@/components/RFPForm";
import type { RfpInput, TenderDocumentLink } from "@/lib/types";

const emptyInput: RfpInput = {
  client_name: "",
  status: "TBD",
  closing_date: null,
  tender_code: null,
  tender_link: null,
  gdrive_link: null,
  description: null,
  contact_person: null,
  contact_phone: null,
  contact_email: null,
  document_links: [],
  summary: null,
  summary_generated_at: null,
  response_draft_title: null,
  response_draft_content: null,
  response_draft_saved_at: null,
  notes: null,
  pipeline_stage: "Prospects",
};

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanLinks(value: unknown): TenderDocumentLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((link): link is Record<string, unknown> => Boolean(link) && typeof link === "object")
    .map((link) => ({
      name: cleanString(link.name) ?? cleanString(link.url) ?? "Document",
      url: cleanString(link.url) ?? "",
    }))
    .filter((link) => link.url);
}

let cachedHash = "";
let cachedDraft: RfpInput | null = null;

function readDraftFromHash(): RfpInput | null {
  const match = window.location.hash.match(/^#import=(.+)$/);
  if (!match) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeURIComponent(match[1])) as Record<string, unknown>;
    const clientName = cleanString(payload.client_name);

    if (!clientName) {
      return null;
    }

    return {
      ...emptyInput,
      client_name: clientName,
      closing_date: cleanString(payload.closing_date),
      tender_code: cleanString(payload.tender_code),
      tender_link: cleanString(payload.tender_link),
      description: cleanString(payload.description),
      contact_person: cleanString(payload.contact_person),
      contact_phone: cleanString(payload.contact_phone),
      contact_email: cleanString(payload.contact_email),
      document_links: cleanLinks(payload.document_links),
    };
  } catch {
    return null;
  }
}

export function RFPImportDraft() {
  const initialInput = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (window.location.hash === cachedHash) {
        return cachedDraft;
      }

      cachedHash = window.location.hash;
      cachedDraft = readDraftFromHash();
      return cachedDraft;
    },
    () => null,
  );

  const formKey = initialInput
    ? `import:${initialInput.tender_link ?? initialInput.tender_code ?? initialInput.client_name}`
    : "empty";

  return <RFPForm key={formKey} initialInput={initialInput ?? undefined} />;
}
