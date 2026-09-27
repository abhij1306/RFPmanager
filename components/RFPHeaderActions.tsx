"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { deleteRfp } from "@/lib/rfps";

export function RFPHeaderActions({
  gdriveLink,
  rfpId,
}: {
  gdriveLink: string | null;
  rfpId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete this RFP?")) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteRfp(rfpId);
      router.push("/");
      router.refresh();
    } catch (error) {
      setIsDeleting(false);
      window.alert(getErrorMessage(error, "Could not delete this RFP."));
    }
  }

  return (
    <div className="header-actions">
      <a className="ghost-button" href="#opportunity-details">Edit details</a>
      {gdriveLink ? (
        <a className="ghost-button" href={gdriveLink} rel="noreferrer" target="_blank">
          Open Google Drive
        </a>
      ) : null}
      <button aria-label={isDeleting ? "Deleting opportunity" : "Delete opportunity"} className="header-delete-button" disabled={isDeleting} onClick={() => void onDelete()} title="Delete opportunity" type="button">
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16"><path d="M4 7h16M10 4h4m-8 3 1 13h10l1-13M10 11v6m4-6v6" /></svg>
      </button>
    </div>
  );
}
