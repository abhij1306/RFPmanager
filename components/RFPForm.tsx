"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
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

type RFPFormProps = Readonly<{
  formId?: string;
  initialInput?: RfpInput;
  rfp?: Rfp | null;
  sourceInputId?: string;
  collapsible?: boolean;
}>;

type EditableRfpInput = Pick<
  RfpInput,
  | "client_name"
  | "status"
  | "closing_date"
  | "tender_code"
  | "tender_link"
  | "gdrive_link"
  | "description"
  | "contact_person"
  | "contact_phone"
  | "contact_email"
  | "notes"
  | "pipeline_stage"
>;

type SetField = <K extends keyof RfpInput>(field: K, value: RfpInput[K]) => void;

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

function editableInputFromForm(form: RfpInput): EditableRfpInput {
  return {
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
}

function createInputFromForm(form: RfpInput, editableInput: EditableRfpInput): RfpInput {
  return {
    ...editableInput,
    document_links: form.document_links,
    summary: form.summary,
    summary_generated_at: form.summary_generated_at,
    response_draft_title: form.response_draft_title,
    response_draft_content: form.response_draft_content,
    response_draft_saved_at: form.response_draft_saved_at,
  };
}

async function saveRfp({
  editableInput,
  form,
  isEditing,
  rfp,
}: Readonly<{
  editableInput: EditableRfpInput;
  form: RfpInput;
  isEditing: boolean;
  rfp?: Rfp | null;
}>): Promise<Rfp> {
  if (isEditing && rfp) {
    return updateRfp(rfp.id, editableInput);
  }

  return createRfp(createInputFromForm(form, editableInput));
}

function formatDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pluralSuffix(count: number): string {
  return count === 1 ? "" : "s";
}

function savedNotice(sourceDocumentCount: number): string {
  if (sourceDocumentCount === 0) {
    return "RFP saved.";
  }

  return `RFP saved with ${sourceDocumentCount} source document${pluralSuffix(sourceDocumentCount)}.`;
}

function selectedSourceNotice(sourceFileCount: number): string {
  return `${sourceFileCount} source document${pluralSuffix(sourceFileCount)} selected. Use Save RFP to upload.`;
}

function sourceFileLabel(sourceFileCount: number, sourceUploadProgress: string): string {
  if (sourceFileCount === 0) {
    return "DOCX, PDF, XLSX, CSV, Markdown, or TXT";
  }

  const progressText = sourceUploadProgress ? ` · ${sourceUploadProgress}` : "";
  return `${sourceFileCount} file${pluralSuffix(sourceFileCount)} selected${progressText}`;
}

function saveButtonText(isSaving: boolean, sourceUploadProgress: string): string {
  if (!isSaving) {
    return "Create RFP";
  }

  if (sourceUploadProgress) {
    return `Saving docs ${sourceUploadProgress}`;
  }

  return "Saving...";
}

function statusClassName(status: RfpInput["status"]): string {
  return `summary-item status-badge status-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

function GeneralInfoFields({
  collapsible,
  form,
  setField,
}: Readonly<{
  collapsible: boolean;
  form: RfpInput;
  setField: SetField;
}>) {
  const reviewLabel = form.status === "TBD" ? "In review" : form.status;

  return (
    <>
      <div className="form-card-heading">
        <h2>
          <span aria-hidden="true" className="section-icon">
            i
          </span>{" "}
          General info
        </h2>
        {collapsible ? null : <span className="review-badge">{reviewLabel}</span>}
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
    </>
  );
}

function ContactDetailsFields({
  form,
  setField,
}: Readonly<{
  form: RfpInput;
  setField: SetField;
}>) {
  return (
    <>
      <div className="form-card-heading">
        <h2>
          <span aria-hidden="true" className="section-icon">
            □
          </span>{" "}
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
    </>
  );
}

function FormSections({
  collapsible,
  form,
  setField,
}: Readonly<{
  collapsible: boolean;
  form: RfpInput;
  setField: SetField;
}>) {
  return (
    <>
      <section className={collapsible ? "form-card-inline" : "form-card"}>
        <GeneralInfoFields collapsible={collapsible} form={form} setField={setField} />
      </section>
      <section className={collapsible ? "form-card-inline" : "form-card"}>
        <ContactDetailsFields form={form} setField={setField} />
      </section>
    </>
  );
}

function SummaryLink({
  href,
  title,
  children,
}: Readonly<{
  href: string;
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <a
      className="summary-item link-btn"
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
      title={title}
    >
      {children}
    </a>
  );
}

function CollapsedSummary({ form }: Readonly<{ form: RfpInput }>) {
  return (
    <div className="trigger-summary">
      <span className={statusClassName(form.status)}>{form.status}</span>
      <span className="summary-item stage-badge">{form.pipeline_stage}</span>
      {form.closing_date ? <span className="summary-item date-badge">Due: {formatDateString(form.closing_date)}</span> : null}
      {form.tender_link ? (
        <SummaryLink href={form.tender_link} title="Open Tender Link">
          🔗 Tender
        </SummaryLink>
      ) : null}
      {form.gdrive_link ? (
        <SummaryLink href={form.gdrive_link} title="Open Google Drive">
          📁 Drive
        </SummaryLink>
      ) : null}
    </div>
  );
}

function CollapsibleFields({
  form,
  isCollapsed,
  onToggle,
  setField,
}: Readonly<{
  form: RfpInput;
  isCollapsed: boolean;
  onToggle: () => void;
  setField: SetField;
}>) {
  const triggerText = isCollapsed ? "Show RFP Details & Settings" : "Hide RFP Details & Settings";

  return (
    <div className="collapsible-rfp-details">
      <div className="collapsible-rfp-trigger">
        <button
          aria-expanded={!isCollapsed}
          className="collapsible-rfp-toggle trigger-left"
          onClick={onToggle}
          type="button"
        >
          <span className={`trigger-chevron ${isCollapsed ? "" : "expanded"}`}>▼</span>
          <span className="trigger-title">{triggerText}</span>
        </button>
        {isCollapsed ? <CollapsedSummary form={form} /> : null}
      </div>
      <div className={`collapsible-rfp-content ${isCollapsed ? "collapsed" : ""}`}>
        <div className="collapsible-form-grid">
          <FormSections collapsible form={form} setField={setField} />
        </div>
      </div>
    </div>
  );
}

function SourceUploadInput({
  className,
  hidden = false,
  onFilesSelected,
  sourceInputId,
  sourceInputRef,
}: Readonly<{
  className?: string;
  hidden?: boolean;
  onFilesSelected: (files: File[]) => void;
  sourceInputId: string;
  sourceInputRef: React.RefObject<HTMLInputElement | null>;
}>) {
  return (
    <input
      accept={FILE_ACCEPT}
      className={className}
      hidden={hidden}
      id={sourceInputId}
      multiple
      onChange={(event) => onFilesSelected(Array.from(event.target.files ?? []))}
      ref={sourceInputRef}
      type="file"
    />
  );
}

function EditingSourceUpload({
  isEditing,
  onFilesSelected,
  sourceFileCount,
  sourceInputId,
  sourceInputRef,
}: Readonly<{
  isEditing: boolean;
  onFilesSelected: (files: File[]) => void;
  sourceFileCount: number;
  sourceInputId: string;
  sourceInputRef: React.RefObject<HTMLInputElement | null>;
}>) {
  if (!isEditing) {
    return null;
  }

  return (
    <>
      <SourceUploadInput
        className="visually-hidden-file-input"
        onFilesSelected={onFilesSelected}
        sourceInputId={sourceInputId}
        sourceInputRef={sourceInputRef}
      />
      {sourceFileCount > 0 ? <div className="notice">{selectedSourceNotice(sourceFileCount)}</div> : null}
    </>
  );
}

function CreateSourceUpload({
  isCreating,
  isSaving,
  onFilesSelected,
  sourceFileCount,
  sourceInputId,
  sourceInputRef,
  sourceUploadProgress,
}: Readonly<{
  isCreating: boolean;
  isSaving: boolean;
  onFilesSelected: (files: File[]) => void;
  sourceFileCount: number;
  sourceInputId: string;
  sourceInputRef: React.RefObject<HTMLInputElement | null>;
  sourceUploadProgress: string;
}>) {
  if (!isCreating) {
    return null;
  }

  return (
    <section className="form-card">
      <div className="form-field full source-upload-field">
        <label htmlFor={sourceInputId}>Source Documents</label>
        <SourceUploadInput
          hidden
          onFilesSelected={onFilesSelected}
          sourceInputId={sourceInputId}
          sourceInputRef={sourceInputRef}
        />
        <div className="inline-upload-control">
          <button className="ghost-button" disabled={isSaving} onClick={() => sourceInputRef.current?.click()} type="button">
            Bulk Upload
          </button>
          <span className="document-meta">{sourceFileLabel(sourceFileCount, sourceUploadProgress)}</span>
        </div>
      </div>
    </section>
  );
}

function CreateActions({
  isCreating,
  isSaving,
  onBack,
  sourceUploadProgress,
}: Readonly<{
  isCreating: boolean;
  isSaving: boolean;
  onBack: () => void;
  sourceUploadProgress: string;
}>) {
  if (!isCreating) {
    return null;
  }

  return (
    <div className="form-actions">
      <button className="button" disabled={isSaving} type="submit">
        {saveButtonText(isSaving, sourceUploadProgress)}
      </button>
      <button className="ghost-button" onClick={onBack} type="button">
        Back
      </button>
    </div>
  );
}

export function RFPForm({
  formId = "rfp-form",
  initialInput,
  rfp,
  sourceInputId = "rfp-source-upload",
  collapsible = false,
}: RFPFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<RfpInput>(() => initialInput ?? inputFromRfp(rfp));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceUploadProgress, setSourceUploadProgress] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(rfp);
  const isCreating = !isEditing;

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

    if (sourceInputRef.current) {
      sourceInputRef.current.value = "";
    }

    return saved.length;
  }

  function setField<K extends keyof RfpInput>(field: K, value: RfpInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSaving(true);

    const editableInput = editableInputFromForm(form);

    if (!editableInput.client_name) {
      setError("Client name is required.");
      setIsSaving(false);
      return;
    }

    let saved: Rfp | null = null;

    try {
      saved = await saveRfp({ editableInput, form, isEditing, rfp });
      const uploadedSourceCount = await uploadSelectedSources(saved.id);

      setForm(inputFromRfp(saved));

      if (isEditing) {
        setNotice(savedNotice(uploadedSourceCount));
        router.refresh();
        return;
      }

      router.push(`/rfp/${saved.id}`);
      router.refresh();
    } catch (saveError) {
      const message = getErrorMessage(saveError, saved ? "Could not upload the selected source documents." : "Could not save this RFP.");

      if (saved) {
        setForm(inputFromRfp(saved));
        router.refresh();

        if (!isEditing) {
          window.alert(`The RFP was created, but its source upload was incomplete. ${message}`);
          router.push(`/rfp/${saved.id}`);
          return;
        }

        setError(`The RFP was saved, but its source upload was incomplete. ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setSourceUploadProgress("");
      setIsSaving(false);
    }
  }

  return (
    <form className={`rfp-form ${collapsible ? "collapsible-rfp-form" : ""}`} id={formId} onSubmit={onSubmit}>
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <EditingSourceUpload
        isEditing={isEditing}
        onFilesSelected={setSourceFiles}
        sourceFileCount={sourceFiles.length}
        sourceInputId={sourceInputId}
        sourceInputRef={sourceInputRef}
      />

      {collapsible ? (
        <CollapsibleFields
          form={form}
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed((current) => !current)}
          setField={setField}
        />
      ) : (
        <FormSections collapsible={false} form={form} setField={setField} />
      )}

      <CreateSourceUpload
        isCreating={isCreating}
        isSaving={isSaving}
        onFilesSelected={setSourceFiles}
        sourceFileCount={sourceFiles.length}
        sourceInputId={sourceInputId}
        sourceInputRef={sourceInputRef}
        sourceUploadProgress={sourceUploadProgress}
      />
      <CreateActions
        isCreating={isCreating}
        isSaving={isSaving}
        onBack={() => router.push("/")}
        sourceUploadProgress={sourceUploadProgress}
      />
    </form>
  );
}
