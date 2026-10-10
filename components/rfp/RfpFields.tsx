import { Plus, X } from "lucide-react";
import type { RfpInput, TenderDocumentLink } from "@/lib/types";

export type RfpFieldValues = Pick<
  RfpInput,
  | "client_name"
  | "tender_code"
  | "closing_date"
  | "closing_date_text"
  | "tender_link"
  | "gdrive_link"
  | "description"
  | "contact_person"
  | "contact_phone"
  | "contact_email"
  | "notes"
  | "document_links"
>;

export type SetRfpField = <K extends keyof RfpFieldValues>(field: K, value: RfpFieldValues[K]) => void;

export function emptyRfpFields(): RfpFieldValues {
  return {
    client_name: "",
    tender_code: null,
    closing_date: null,
    closing_date_text: null,
    tender_link: null,
    gdrive_link: null,
    description: null,
    contact_person: null,
    contact_phone: null,
    contact_email: null,
    notes: null,
    document_links: [],
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

/** Trim free text and drop empty values before saving. */
export function cleanRfpFields(values: RfpFieldValues): RfpFieldValues {
  return {
    client_name: values.client_name.trim(),
    tender_code: clean(values.tender_code),
    closing_date: values.closing_date || null,
    closing_date_text: clean(values.closing_date_text),
    tender_link: clean(values.tender_link),
    gdrive_link: clean(values.gdrive_link),
    description: clean(values.description),
    contact_person: clean(values.contact_person),
    contact_phone: clean(values.contact_phone),
    contact_email: clean(values.contact_email),
    notes: clean(values.notes),
    document_links: values.document_links
      .map((link) => ({ name: link.name.trim(), url: link.url.trim() }))
      .filter((link) => link.url),
  };
}

export function validateRfpFields(values: RfpFieldValues): string | null {
  if (!values.client_name) return "Give the RFP a name.";
  const badLink = values.document_links.find((link) => {
    try {
      return !["http:", "https:"].includes(new URL(link.url).protocol);
    } catch {
      return true;
    }
  });
  return badLink ? `“${badLink.url}” is not a valid web link.` : null;
}

function TextField({ id, label, value, onChange, type = "text", placeholder, required, autoFocus }: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}{required ? <span className="required"> · required</span> : null}</label>
      <input autoFocus={autoFocus} className="input" id={id} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value ?? ""} />
    </div>
  );
}

export function CoreRfpFields({ values, setField, autoFocus = false }: { values: RfpFieldValues; setField: SetRfpField; autoFocus?: boolean }) {
  return (
    <div className="form-grid">
      <div className="span-2">
        <TextField autoFocus={autoFocus} id="client_name" label="RFP name" onChange={(value) => setField("client_name", value)} placeholder="e.g. City of Sydney — CRM replacement" required value={values.client_name} />
      </div>
      <TextField id="tender_code" label="Tender code" onChange={(value) => setField("tender_code", value)} placeholder="e.g. RFT-2026-118" value={values.tender_code} />
      <TextField id="closing_date" label="Closing date" onChange={(value) => setField("closing_date", value || null)} type="date" value={values.closing_date} />
      {values.closing_date_text ? (
        <div className="span-2 field">
          <label className="field-label" htmlFor="closing_date_text">Deadline as written in the tender</label>
          <input className="input" id="closing_date_text" onChange={(event) => setField("closing_date_text", event.target.value || null)} value={values.closing_date_text} />
          <span className="field-hint">Check the time and timezone against the tender page.</span>
        </div>
      ) : null}
      <TextField id="tender_link" label="Tender page" onChange={(value) => setField("tender_link", value)} placeholder="https://" type="url" value={values.tender_link} />
      <TextField id="gdrive_link" label="Google Drive folder" onChange={(value) => setField("gdrive_link", value)} placeholder="https://drive.google.com/…" type="url" value={values.gdrive_link} />
      <div className="span-2 field">
        <label className="field-label" htmlFor="description">Description</label>
        <textarea className="textarea" id="description" onChange={(event) => setField("description", event.target.value)} placeholder="What the buyer is asking for, in a sentence or two" value={values.description ?? ""} />
      </div>
    </div>
  );
}

export function ExtraRfpFields({ values, setField }: { values: RfpFieldValues; setField: SetRfpField }) {
  function updateLink(index: number, patch: Partial<TenderDocumentLink>) {
    setField("document_links", values.document_links.map((link, itemIndex) => (itemIndex === index ? { ...link, ...patch } : link)));
  }

  return (
    <div className="form-grid">
      <TextField id="contact_person" label="Contact person" onChange={(value) => setField("contact_person", value)} value={values.contact_person} />
      <TextField id="contact_email" label="Contact email" onChange={(value) => setField("contact_email", value)} type="email" value={values.contact_email} />
      <TextField id="contact_phone" label="Contact phone" onChange={(value) => setField("contact_phone", value)} type="tel" value={values.contact_phone} />
      <div />
      <div className="span-2 field">
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea className="textarea" id="notes" onChange={(event) => setField("notes", event.target.value)} value={values.notes ?? ""} />
      </div>
      <div className="span-2 field" role="group" aria-labelledby="portal-links-label">
        <span className="field-label" id="portal-links-label">Portal links</span>
        {values.document_links.map((link, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr) auto", gap: 8 }}>
            <input aria-label={`Link ${index + 1} name`} className="input" onChange={(event) => updateLink(index, { name: event.target.value })} placeholder="Name" value={link.name} />
            <input aria-label={`Link ${index + 1} URL`} className="input" onChange={(event) => updateLink(index, { url: event.target.value })} placeholder="https://" type="url" value={link.url} />
            <button aria-label={`Remove link ${index + 1}`} className="btn btn-ghost btn-icon" onClick={() => setField("document_links", values.document_links.filter((_, itemIndex) => itemIndex !== index))} type="button"><X size={15} /></button>
          </div>
        ))}
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => setField("document_links", [...values.document_links, { name: "", url: "" }])} type="button"><Plus size={14} />Add link</button>
        </div>
      </div>
    </div>
  );
}
