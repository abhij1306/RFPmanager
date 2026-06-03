import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBookmarklet } from "@/lib/bookmarklet";
import { normalizeImportedRfp } from "@/lib/rfps";

describe("RFP imports", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

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

    expect(script).toContain("optional(contactPerson)");
    expect(script).toContain("optional(contactPhone)");
    expect(script).toContain("optional(contactEmail)");
    expect(script).toContain("contact_person:");
    expect(script).toContain("contact_phone:");
    expect(script).toContain("contact_email:");
  });

  it("opens a populated import draft from a WA tender enquiry table", () => {
    document.body.innerHTML = `
      <table class="subtitle">
        <tbody><tr><th class="h2">Library Management System Issued by Department of Health</th></tr></tbody>
      </table>
      <table>
        <tbody><tr><td>Number:</td><td>LAWA202604</td></tr></tbody>
      </table>
      <table class="contacts">
        <tbody>
          <tr><td class="top"></td><td class="top">
            <div class="LIST_TITLE">Enquiries</div>
            <table>
              <tbody>
                <tr><td>Person</td><td>Naomi Boardman</td></tr>
                <tr><td>Phone</td><td>(08) 65511421</td></tr>
                <tr><td>Email</td><td><a href="mailto:naomi.boardman@dohw.wa.gov.au">naomi.boardman@dohw.wa.gov.au</a><br></td></tr>
              </tbody>
            </table>
          </td></tr>
        </tbody>
      </table>
      <table class="subtitle" id="description">
        <tbody><tr><th class="h2">Description</th></tr></tbody>
      </table>
      <textarea id="desc">Provide library management software.</textarea>
    `;
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const bookmarklet = buildBookmarklet("https://rfp.example.test");
    const script = decodeURIComponent(bookmarklet.replace(/^javascript:/, ""));

    window.eval(script);

    expect(open).toHaveBeenCalledOnce();
    const openedUrl = open.mock.calls[0][0]?.toString() ?? "";
    const payload = JSON.parse(decodeURIComponent(openedUrl.replace(/^.*#import=/, ""))) as Record<string, unknown>;
    expect(payload.client_name).toBe("Library Management System - Issued by Department of Health");
    expect(payload.tender_code).toBe("LAWA202604");
    expect(payload.description).toBe("Provide library management software.");
    expect(payload.contact_person).toBe("Naomi Boardman");
    expect(payload.contact_phone).toBe("(08) 65511421");
    expect(payload.contact_email).toBe("naomi.boardman@dohw.wa.gov.au");
  });

  it("still opens an import draft when optional contact extraction fails", () => {
    document.body.innerHTML = `
      <table class="subtitle">
        <tbody><tr><th class="h2">Library Management System Issued by Department of Health</th></tr></tbody>
      </table>
      <table>
        <tbody><tr><td>Number</td><td>LAWA202604</td></tr></tbody>
      </table>
      <table class="contacts">
        <tbody><tr data-broken-contact><td>Person</td><td>Naomi Boardman</td></tr></tbody>
      </table>
      <textarea id="desc">Provide library management software.</textarea>
    `;
    const brokenRow = document.querySelector("[data-broken-contact]");
    Object.defineProperty(brokenRow, "children", {
      get() {
        throw new Error("Broken contact table");
      },
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const bookmarklet = buildBookmarklet("https://rfp.example.test");
    const script = decodeURIComponent(bookmarklet.replace(/^javascript:/, ""));

    window.eval(script);

    expect(open).toHaveBeenCalledOnce();
    const openedUrl = open.mock.calls[0][0]?.toString() ?? "";
    const payload = JSON.parse(decodeURIComponent(openedUrl.replace(/^.*#import=/, ""))) as Record<string, unknown>;
    expect(payload.client_name).toBe("Library Management System - Issued by Department of Health");
    expect(payload.tender_code).toBe("LAWA202604");
    expect(payload.description).toBe("Provide library management software.");
    expect(payload.contact_person).toBe("");
  });
});
