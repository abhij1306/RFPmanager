import { describe, expect, it } from "vitest";
import { buildBookmarklet } from "@/lib/bookmarklet";
import { normalizeImportedRfp } from "@/lib/rfps";

describe("RFP imports", () => {
  it("keeps imported tender enquiry contact details", () => {
    const input = normalizeImportedRfp({
      client_name: "Library Management System",
      contact_person: "Naomi Boardman",
      contact_phone: "(08) 65511421",
      contact_email: "naomi.boardman@dohw.wa.gov.au",
    });

    expect(input.contact_person).toBe("Naomi Boardman");
    expect(input.contact_phone).toBe("(08) 65511421");
    expect(input.contact_email).toBe("naomi.boardman@dohw.wa.gov.au");
  });

  it("includes enquiry contact fields in the generated bookmarklet payload", () => {
    const bookmarklet = buildBookmarklet("https://rfp.example.test");
    const script = decodeURIComponent(bookmarklet.replace(/^javascript:/, ""));

    expect(script).toContain("contactPerson()");
    expect(script).toContain("contactPhone()");
    expect(script).toContain("contactEmail()");
    expect(script).toContain("contact_person:");
    expect(script).toContain("contact_phone:");
    expect(script).toContain("contact_email:");
  });
});
