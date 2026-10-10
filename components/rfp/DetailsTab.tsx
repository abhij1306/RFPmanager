import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoreRfpFields, ExtraRfpFields, cleanRfpFields, validateRfpFields, type RfpFieldValues, type SetRfpField } from "@/components/rfp/RfpFields";
import { toast } from "@/components/ui/feedback";
import { formatDateOnly } from "@/lib/date";
import { getErrorMessage } from "@/lib/errors";
import { updateRfp } from "@/lib/rfps";
import type { Rfp } from "@/lib/types";

function fieldsFromRfp(rfp: Rfp): RfpFieldValues {
  return {
    client_name: rfp.client_name,
    tender_code: rfp.tender_code,
    closing_date: rfp.closing_date,
    closing_date_text: rfp.closing_date_text ?? null,
    tender_link: rfp.tender_link,
    gdrive_link: rfp.gdrive_link,
    description: rfp.description,
    contact_person: rfp.contact_person,
    contact_phone: rfp.contact_phone,
    contact_email: rfp.contact_email,
    notes: rfp.notes,
    document_links: rfp.document_links,
  };
}

function ExternalLinkValue({ href }: { href: string | null }) {
  return href ? <a href={href} rel="noreferrer" target="_blank">{href}</a> : <span className="muted">—</span>;
}

function TextValue({ value }: { value: string | null | undefined }) {
  return value ? <>{value}</> : <span className="muted">—</span>;
}

export function DetailsTab({ editing, onEditingChange, rfp }: { editing: boolean; onEditingChange: (editing: boolean) => void; rfp: Rfp }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => fieldsFromRfp(rfp));
  const [values, setValues] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField: SetRfpField = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  function startEditing() {
    setValues(saved);
    setError(null);
    onEditingChange(true);
  }

  async function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = cleanRfpFields(values);
    const problem = validateRfpFields(cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateRfp(rfp.id, cleaned);
      setSaved(fieldsFromRfp(updated));
      onEditingChange(false);
      toast("Details saved");
      router.refresh();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save the details."));
    } finally {
      setIsSaving(false);
    }
  }

  if (editing) {
    return (
      <form className="doc-pane" onSubmit={save}>
        <div className="doc-pane-header">
          <div><h2>Edit details</h2><p>Changes are visible to MCP agents straight away.</p></div>
          <div className="header-actions">
            <button className="btn btn-ghost" disabled={isSaving} onClick={() => { setValues(saved); setError(null); onEditingChange(false); }} type="button">Cancel</button>
            <button className="btn btn-primary" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save details"}</button>
          </div>
        </div>
        {error ? <div className="notice notice-error notice-stack" role="alert">{error}</div> : null}
        <div className="panel">
          <div className="panel-body"><CoreRfpFields setField={setField} values={values} /></div>
          <div className="panel-body" style={{ borderTop: "1px solid var(--border)" }}><ExtraRfpFields setField={setField} values={values} /></div>
        </div>
      </form>
    );
  }

  return (
    <div className="doc-pane">
      <div className="doc-pane-header">
        <div><h2>Details</h2><p>What MCP agents see when they look up this RFP</p></div>
        <button className="btn btn-secondary btn-sm" onClick={startEditing} type="button"><Pencil size={14} />Edit</button>
      </div>
      <dl className="details-list">
        <dt>Name</dt><dd>{saved.client_name}</dd>
        <dt>Tender code</dt><dd><TextValue value={saved.tender_code} /></dd>
        <dt>Closing date</dt><dd>{saved.closing_date ? formatDateOnly(saved.closing_date) : <span className="muted">—</span>}</dd>
        {saved.closing_date_text ? <><dt>Deadline as written</dt><dd>{saved.closing_date_text}</dd></> : null}
        <dt>Tender page</dt><dd><ExternalLinkValue href={saved.tender_link} /></dd>
        <dt>Google Drive</dt><dd><ExternalLinkValue href={saved.gdrive_link} /></dd>
        <dt>Description</dt><dd><TextValue value={saved.description} /></dd>
        <dt>Contact</dt>
        <dd>
          {saved.contact_person || saved.contact_email || saved.contact_phone ? (
            <span className="link-list">
              {saved.contact_person ? <span>{saved.contact_person}</span> : null}
              {saved.contact_email ? <a href={`mailto:${saved.contact_email}`}>{saved.contact_email}</a> : null}
              {saved.contact_phone ? <a href={`tel:${saved.contact_phone}`}>{saved.contact_phone}</a> : null}
            </span>
          ) : <span className="muted">—</span>}
        </dd>
        <dt>Notes</dt><dd><TextValue value={saved.notes} /></dd>
        <dt>Portal links</dt>
        <dd>
          {saved.document_links.length ? (
            <span className="link-list">
              {saved.document_links.map((link, index) => <a href={link.url} key={`${link.url}-${index}`} rel="noreferrer" target="_blank">{link.name || link.url}</a>)}
            </span>
          ) : <span className="muted">—</span>}
        </dd>
        <dt>RFP ID</dt><dd className="mono">{rfp.id}</dd>
      </dl>
    </div>
  );
}
