import { RFPImportDraft } from "@/components/RFPImportDraft";

export default function NewRfpPage() {
  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>Add RFP</h1>
          <p>Create a shared record for a new tender or opportunity.</p>
        </div>
      </section>
      <RFPImportDraft />
    </div>
  );
}
