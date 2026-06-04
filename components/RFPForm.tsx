"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadSourceDocuments } from "@/lib/rfp-source-documents";
import { createRfp, updateRfp } from "@/lib/rfps";
import type { Rfp, RfpInput } from "@/lib/types";
import { pipelineStages, statuses } from "@/lib/types";

const FILE_ACCEPT =
  ".docx,.pdf,.xlsx,.csv,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/markdown,text/plain";

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
    contact_person: rfp.contact_person,
    contact_phone: rfp.contact_phone,
    contact_email: rfp.contact_email,
    document_links: rfp.document_links,
    summary: rfp.summary,
    summary_generated_at: rfp.summary_generated_at,
    response_draft_title: rfp.response_draft_title,
    response_draft_content: rfp.response_draft_content,
    response_draft_saved_at: rfp.response_draft_saved_at,
    notes: rfp.notes,
    pipeline_stage: rfp.pipeline_stage,
  };
}

export function RFPForm({
  formId = "rfp-form",
  initialInput,
  rfp,
  sourceInputId = "rfp-source-upload",
}: {
  formId?: string;
  initialInput?: RfpInput;
  rfp?: Rfp | null;
  sourceInputId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<RfpInput>(() => initialInput ?? inputFromRfp(rfp));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceUploadProgress, setSourceUploadProgress] = useState("");
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(rfp);

  async function uploadSelectedSources(rfpId: string) {
    if (sourceFiles.length === 0) {
      return 0;
    }

    setSourceUploadProgress(`0/${sourceFiles.length}`);
    const saved = await uploadSourceDocuments({
      files: sourceFiles,
      onProgress: (completed, total) => setSourceUploadProgress(`${completed}/${total}`),
      rfpId,
    });
    setSourceFiles([]);
    setSourceUploadProgress("");
    if (sourceInputRef.current) sourceInputRef.current.value = "";
    return saved.length;
  }

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
      contact_person: cleanValue(form.contact_person ?? ""),
      contact_phone: cleanValue(form.contact_phone ?? ""),
      contact_email: cleanValue(form.contact_email ?? ""),
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
              response_draft_title: form.response_draft_title,
              response_draft_content: form.response_draft_content,
              response_draft_saved_at: form.response_draft_saved_at,
            });
      const uploadedSourceCount = await uploadSelectedSources(saved.id);

      setForm(inputFromRfp(saved));

      if (isEditing) {
        setNotice(
          uploadedSourceCount
            ? `RFP saved with ${uploadedSourceCount} source document${uploadedSourceCount === 1 ? "" : "s"}.`
            : "RFP saved.",
        );
        setIsSaving(false);
        router.refresh();
      } else {
        router.push(`/rfp/${saved.id}`);
        router.refresh();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this RFP.");
      setSourceUploadProgress("");
      setIsSaving(false);
    }
  }

  return (
    <form className="rfp-form" id={formId} onSubmit={onSubmit}>
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      {isEditing ? (
        <>
          <input
            accept={FILE_ACCEPT}
            className="visually-hidden-file-input"
            id={sourceInputId}
            multiple
            onChange={(event) => setSourceFiles(Array.from(event.target.files ?? []))}
            ref={sourceInputRef}
            type="file"
          />
          {sourceFiles.length ? (
            <div className="notice">
              {sourceFiles.length} source document{sourceFiles.length === 1 ? "" : "s"} selected. Use Save RFP to upload.
            </div>
          ) : null}
        </>
      ) : null}
      <section className="form-card">
        <div className="form-card-heading">
          <h2>
            <span aria-hidden="true" className="section-icon">i</span>
            General info
          </h2>
          <span className="review-badge">{form.status === "TBD" ? "In review" : form.status}</span>
        </div>
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
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <h2>
            <span aria-hidden="true" className="section-icon">□</span>
            Contact details
          </h2>
        </div>
        <div className="form-grid">
        <div className="form-field">
          <label htmlFor="contact_person">Contact Person</label>
          <input
            className="input"
            id="contact_person"
            onChange={(event) => setField("contact_person", event.target.value)}
            value={form.contact_person ?? ""}
          />
        </div>
        <div className="form-field">
          <label htmlFor="contact_phone">Phone</label>
          <input
            className="input"
            id="contact_phone"
            onChange={(event) => setField("contact_phone", event.target.value)}
            value={form.contact_phone ?? ""}
          />
        </div>
        <div className="form-field full">
          <label htmlFor="contact_email">Email</label>
          <input
            className="input"
            id="contact_email"
            onChange={(event) => setField("contact_email", event.target.value)}
            type="email"
            value={form.contact_email ?? ""}
          />
        </div>
        <div className="form-field full">
          <label htmlFor="description">Tender Description</label>
          <textarea
            className="textarea large-textarea"
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
      </section>

      {!isEditing ? (
        <section className="form-card">
        <div className="form-field full source-upload-field">
          <label htmlFor={sourceInputId}>Source Documents</label>
          <input
            accept={FILE_ACCEPT}
            hidden
            id={sourceInputId}
            multiple
            onChange={(event) => setSourceFiles(Array.from(event.target.files ?? []))}
            ref={sourceInputRef}
            type="file"
          />
          <div className="inline-upload-control">
            <button
              className="ghost-button"
              disabled={isSaving}
              onClick={() => sourceInputRef.current?.click()}
              type="button"
            >
              Bulk Upload
            </button>
            <span className="document-meta">
              {sourceFiles.length
                ? `${sourceFiles.length} file${sourceFiles.length === 1 ? "" : "s"} selected${sourceUploadProgress ? ` · ${sourceUploadProgress}` : ""}`
                : "DOCX, PDF, XLSX, CSV, Markdown, or TXT"}
            </span>
          </div>
        </div>
        </section>
      ) : null}
      {!isEditing ? (
        <div className="form-actions">
          <button className="button" disabled={isSaving} type="submit">
            {isSaving ? (sourceUploadProgress ? `Saving docs ${sourceUploadProgress}` : "Saving...") : "Create RFP"}
          </button>
          <button className="ghost-button" onClick={() => router.push("/")} type="button">
            Back
          </button>
        </div>
      ) : null}
    </form>
  );
}
