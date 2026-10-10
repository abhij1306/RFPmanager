"use client";

import dynamic from "next/dynamic";

// react-markdown and remark-gfm load only when a document is actually rendered.
export const MarkdownView = dynamic(
  () => import("@/components/MarkdownReadingView").then((module) => module.MarkdownReadingView),
  { loading: () => <div aria-busy="true" className="prose"><div className="skeleton" style={{ height: 14, width: "60%" }} /></div> },
);
