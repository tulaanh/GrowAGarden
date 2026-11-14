import katex from "katex";
import { Fragment } from "react";

const delimiters = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\$)[^\n$]+?\$)/g;

export function MathText({ text }: { text: string }) {
  return <>{text.split(delimiters).map((part, index) => {
    if (!part) return null;
    const display = part.startsWith("$$") || part.startsWith("\\[");
    const math = display || part.startsWith("\\(") ? part.slice(2, -2) : part.startsWith("$") && part.endsWith("$") ? part.slice(1, -1) : null;
    if (math === null) return <Fragment key={index}>{part}</Fragment>;
    try {
      const html = katex.renderToString(math, { displayMode: display, throwOnError: true, trust: false, maxSize: 20, maxExpand: 500 });
      return <span key={index} className={display ? "math-display" : "math-inline"} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <Fragment key={index}>{part}</Fragment>;
    }
  })}</>;
}
