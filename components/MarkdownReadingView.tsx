import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownReadingView({ children }: { children: string }) {
  return <div className="prose"><Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown></div>;
}
