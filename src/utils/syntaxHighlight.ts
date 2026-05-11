import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import rust from "highlight.js/lib/languages/rust";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);

const EXTENSION_MAP: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".sh": "bash",
  ".bash": "bash",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".rs": "rust",
  ".css": "css",
  ".html": "xml",
  ".xml": "xml",
};

export function highlightCode(code: string, filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const language = EXTENSION_MAP[ext];

  if (language) {
    try {
      const result = hljs.highlight(code, { language });
      return result.value;
    } catch {
      // Fallback to auto-detection
    }
  }

  // Auto-detect or plain text
  try {
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    return code;
  }
}
