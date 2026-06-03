import { DocConverter } from "@/components/DocConverter";

export default function ConvertPage() {
  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>Document Converter</h1>
          <p>Convert DOCX or PDF files to Markdown in the browser, then copy the result for Claude.</p>
        </div>
      </section>
      <DocConverter />
    </div>
  );
}
