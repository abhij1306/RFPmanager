import { notFound } from "next/navigation";
import { RFPForm } from "@/components/RFPForm";
import { getRfp } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export default async function RfpDetailPage({ params }: { params: { id: string } }) {
  const rfp = await getRfp(params.id);

  if (!rfp) {
    notFound();
  }

  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>{rfp.client_name}</h1>
          <p>Edit links, status, dates, and team notes for this RFP.</p>
        </div>
      </section>
      <RFPForm rfp={rfp} />
    </div>
  );
}
