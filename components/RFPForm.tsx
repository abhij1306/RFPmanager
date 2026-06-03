"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRfp, deleteRfp, updateRfp } from "@/lib/rfps";
import type { Rfp, RfpInput } from "@/lib/types";
import { pipelineStages, statuses } from "@/lib/types";

const emptyInput: RfpInput = {
  client_name: "",
  status: "TBD",
  closing_date: null,
  tender_code: null,
  tender_link: null,
  gdrive_link: null,
  description: null,
  document_links: [],
  summary: null,
  summary_generated_at: null,
  notes: null,
  pipeline_stage: "Prospects",
};

function cleanValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function inputFromRfp(rfp?: Rfp | null): RfpInput {
  if (!rfp) {
    return emptyInput;
  }

  return {
    client_name: rfp.client_name,
    status: rfp.status,
    closing_date: rfp.closing_date,
    tender_code: rfp.tender_code,
    tender_link: rfp.tender_link,
    gdrive_link: rfp.gdrive_link,
    description: rfp.description,
    document_links: rfp.document_links,
    summary: rfp.summary,
    summary_generated_at: rfp.summary_generated_at,
    notes: rfp.notes,
    pipeline_stage: rfp.pipeline_stage,
  };
}

export function RFPForm({ initialInput, rfp }: { initialInput?: RfpInput; rfp?: Rfp | null }) {
  const router = useRouter();
  const [form, setForm] = useState<RfpInput>(() => initialInput ?? inputFromRfp(rfp));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(rfp);

  function setField<K extends keyof RfpInput>(field: K, value: RfpInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSaving(true);

    const editableInput = {
      client_name: form.client_name.trim(),
      status: form.status,
      closing_date: form.closing_date || null,
      tender_code: cleanValue(form.tender_code ?? ""),
      tender_link: cleanValue(form.tender_link ?? ""),
      gdrive_link: cleanValue(form.gdrive_link ?? ""),
      description: cleanValue(form.description ?? ""),
      notes: cleanValue(form.notes ?? ""),
      pipeline_stage: form.pipeline_stage,
    };

    if (!editableInput.client_name) {
      setError("Client name is required.");
      setIsSaving(false);
      return;
    }

    try {
      const saved =
        isEditing && rfp
          ? await updateRfp(rfp.id, editableInput)
          : await createRfp({
              ...editableInput,
              document_links: form.document_links,
              summary: form.summary,
              summary_generated_at: form.summary_generated_at,
            });

      setForm(inputFromRfp(saved));

      if (isEditing) {
        setNotice("RFP saved.");
        setIsSaving(false);
        router.refresh();
      } else {
        router.push(`/rfp/${saved.id}`);
        router.refresh();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this RFP.");
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!rfp || !window.confirm("Delete this RFP?")) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await deleteRfp(rfp.id);
      router.push("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this RFP.");
      setIsSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit} style={{ padding: 20 }}>
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="client_name">Client Name</label>
          <input
            className="input"
            id="client_name"
            onChange={(event) => setField("client_name", event.target.value)}
            required
            value={form.client_name}
          />
        </div>
        <div className="form-field">
          <label htmlFor="status">Status</label>
          <select
            className="select"
            id="status"
            onChange={(event) => setField("status", event.target.value as RfpInput["status"])}
            value={form.status}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="closing_date">Closing Date</label>
          <input
            className="input"
            id="closing_date"
            onChange={(event) => setField("closing_date", event.target.value || null)}
            type="date"
            value={form.closing_date ?? ""}
          />
        </div>
        <div className="form-field">
          <label htmlFor="pipeline_stage">Pipeline Stage</label>
          <select
            className="select"
            id="pipeline_stage"
            onChange={(event) => setField("pipeline_stage", event.target.value as RfpInput["pipeline_stage"])}
            value={form.pipeline_stage}
          >
            {pipelineStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="tender_code">Tender Code</label>
          <input
            className="input"
            id="tender_code"
            onChange={(event) => setField("tender_code", event.target.value)}
            value={form.tender_code ?? ""}
          />
        </div>
        <div className="form-field">
          <label htmlFor="tender_link">Tender Link</label>
          <input
            className="input"
            id="tender_link"
            onChange={(event) => setField("tender_link", event.target.value)}
            type="url"
            value={form.tender_link ?? ""}
          />
        </div>
        <div className="form-field full">
          <label htmlFor="gdrive_link">Google Drive Link</label>
          <input
            className="input"
            id="gdrive_link"
            onChange={(event) => setField("gdrive_link", event.target.value)}
            type="url"
            value={form.gdrive_link ?? ""}
          />
        </div>
        <div className="form-field full">
          <label htmlFor="description">Tender Description</label>
          <textarea
            className="textarea"
            id="description"
            onChange={(event) => setField("description", event.target.value)}
            value={form.description ?? ""}
          />
        </div>
        <div className="form-field full">
          <label htmlFor="notes">Notes</label>
          <textarea
            className="textarea"
            id="notes"
            onChange={(event) => setField("notes", event.target.value)}
            value={form.notes ?? ""}
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="button" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : isEditing ? "Save RFP" : "Create RFP"}
        </button>
        <button className="ghost-button" onClick={() => router.push("/")} type="button">
          Back
        </button>
        {rfp?.tender_link ? (
          <a className="ghost-button" href={rfp.tender_link} rel="noreferrer" target="_blank">
            Open Tender Link
          </a>
        ) : null}
        {rfp?.gdrive_link ? (
          <a className="ghost-button" href={rfp.gdrive_link} rel="noreferrer" target="_blank">
            Open Google Drive
          </a>
        ) : null}
        {isEditing ? (
          <button className="danger-button" disabled={isSaving} onClick={onDelete} type="button">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
