import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownReadingView({ children, className = "" }: { children: string; className?: string }) {
  return <div className={`markdown-reading ${className}`}><Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown></div>;
}
