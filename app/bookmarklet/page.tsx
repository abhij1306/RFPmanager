import { headers } from "next/headers";
import { BookmarkletInstaller } from "@/components/BookmarkletInstaller";

export const dynamic = "force-dynamic";

export default async function BookmarkletPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "";

  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>Tender Import Bookmarklet</h1>
          <p>Install a browser bookmark that extracts tender details from the page you are viewing.</p>
        </div>
      </section>
      <BookmarkletInstaller origin={origin} />
    </div>
  );
}
