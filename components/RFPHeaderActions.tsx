"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRfp } from "@/lib/rfps";

export function RFPHeaderActions({
  formId,
  gdriveLink,
  rfpId,
  sourceInputId,
}: {
  formId: string;
  gdriveLink: string | null;
  rfpId: string;
  sourceInputId: string;
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
      window.alert(error instanceof Error ? error.message : "Could not delete this RFP.");
    }
  }

  return (
    <div className="header-actions">
      <button className="button" form={formId} type="submit">
        Save RFP
      </button>
      <label className="ghost-button" htmlFor={sourceInputId}>
        Bulk Upload
      </label>
      <button className="ghost-button" onClick={() => router.push("/")} type="button">
        Back
      </button>
      {gdriveLink ? (
        <a className="ghost-button" href={gdriveLink} rel="noreferrer" target="_blank">
          Open Google Drive
        </a>
      ) : null}
      <button className="danger-button" disabled={isDeleting} onClick={() => void onDelete()} type="button">
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
