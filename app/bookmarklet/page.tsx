import { headers } from "next/headers";
import { BookmarkletInstaller } from "@/components/BookmarkletInstaller";

export const dynamic = "force-dynamic";

export default async function BookmarkletPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const configuredOrigin = process.env.RFPMANAGER_API_BASE_URL;
  let origin = host ? `${protocol}://${host}` : "";
  if (configuredOrigin) {
    try {
      const configuredUrl = new URL(configuredOrigin);
      if (configuredUrl.protocol === "https:" || configuredUrl.protocol === "http:") origin = configuredUrl.origin;
    } catch { /* Keep the request-derived origin when configuration is invalid. */ }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Capture bookmarklet</h1>
          <p>One click on a tender page pre-fills a new RFP with its title, deadline, contacts and document links.</p>
        </div>
      </header>
      <BookmarkletInstaller origin={origin} />
    </div>
  );
}
