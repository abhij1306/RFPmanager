import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBookmarklet, buildDebugBookmarklet } from "@/lib/bookmarklet";

function runBookmarklet(): Record<string, unknown> {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  vi.spyOn(window, "prompt").mockReturnValue(null);
  window.eval(decodeURIComponent(buildBookmarklet("https://rfp.example.test").slice("javascript:".length)));
  const destination = String(open.mock.calls[0][0]);
  return JSON.parse(decodeURIComponent(destination.split("#import=")[1])) as Record<string, unknown>;
}

describe("generated tender bookmarklets", () => {
  afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

  it("captures table deadlines and preserves their original time and timezone", () => {
    document.body.innerHTML = `<h1>Library tender</h1><table><tr><th>Closing date</th><td>30 September 2026, 2:00 PM AEST</td></tr></table>`;
    const payload = runBookmarklet();
    expect(payload.closing_date).toBe("2026-09-30");
    expect(payload.closing_date_text).toContain("2:00 PM AEST");
  });

  it("leaves conflicting and invalid dates for review", () => {
    document.body.innerHTML = `<h1>Library tender</h1><table><tr><th>Closing date</th><td>31 February 2026</td></tr><tr><th>Deadline</th><td>30 September 2026</td></tr><tr><th>Responses close</th><td>1 October 2026</td></tr></table>`;
    const payload = runBookmarklet();
    expect(payload.closing_date).toBe("");
    expect(payload.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/conflicting/i)]));
  });

  it("keeps tender documents, removes navigation and duplicate links, and flags portal controls", () => {
    document.body.innerHTML = `<h1>Library tender</h1><section><h2>Tender documents</h2><a href="https://portal.example/Terms-and-Conditions.pdf">Terms</a><a href="https://portal.example/privacy-requirements.pdf">Privacy requirements</a><a href="https://portal.example/spec.pdf?id=3">Specification</a><a href="https://portal.example/spec.pdf?id=3">Specification again</a><a href="https://portal.example/my-profile">My profile</a><a href="javascript:downloadDocument('42')">Download document</a><button>Download addendum</button></section>`;
    const payload = runBookmarklet();
    const links = payload.document_links as Array<{ url: string }>;
    expect(links.map((link) => link.url)).toEqual([
      "https://portal.example/Terms-and-Conditions.pdf",
      "https://portal.example/privacy-requirements.pdf",
      "https://portal.example/spec.pdf?id=3",
    ]);
    expect(payload.portal_downloads).toEqual(expect.arrayContaining(["Download addendum"]));
  });

  it("uses a tender-specific title and does not pick a portal support email", () => {
    document.body.innerHTML = `<h1>Supplier Portal</h1><h2 class="tender-title">Website hosting and maintenance</h2><p>Questions are handled via tender Q&A.</p><a href="mailto:support@portal.example">support@portal.example</a>`;
    const payload = runBookmarklet();
    expect(payload.client_name).toBe("Website hosting and maintenance");
    expect(payload.contact_email).toBe("");
  });

  it("does not treat the page title alone as a tender identity", () => {
    document.title = "Supplier Portal";
    document.body.innerHTML = `<div>Loading tender details…</div>`;
    const payload = runBookmarklet();
    expect(payload.client_name).toBe("");
  });

  it("omits synthetic secrets from every diagnostic field", () => {
    document.body.innerHTML = `<h1>SyntheticHeadingSecret</h1><label for="pw">Password</label><input id="pw" type="password" value="SyntheticPasswordSecret"><label for="csrf">Tender number</label><input id="csrf" type="hidden" value="SyntheticCsrfSecret"><table><tr><td>Deadline</td><td>SyntheticTableSecret</td></tr></table><a href="https://portal.example/path/SyntheticPathSecret?token=SyntheticQuerySecret#token=SyntheticFragmentSecret">SyntheticLinkSecret</a>`;
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    window.eval(decodeURIComponent(buildDebugBookmarklet().slice("javascript:".length)));
    const report = String(prompt.mock.calls[0][1]);
    expect(report).not.toMatch(/Synthetic(?:Heading|Password|Csrf|Table|Path|Query|Fragment|Link)Secret/);
    expect(report).toContain("tender number");
  });
});
