import { useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import type { FileDiff } from "../types";

interface Props {
  files: FileDiff[];
}

export function DiffViewer({ files }: Props) {
  const [splitView, setSplitView] = useState(true);

  if (files.length === 0) {
    return <p className="text-sm text-gray-400">No differences found.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setSplitView(true)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            splitView
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          }`}
        >
          Split
        </button>
        <button
          onClick={() => setSplitView(false)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            !splitView
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          }`}
        >
          Inline
        </button>
      </div>
      {files.map((f) => (
        <div key={f.file} className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-1">
            {f.file}
          </h4>
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <ReactDiffViewer
              oldValue={f.oldContent ?? ""}
              newValue={f.newContent ?? ""}
              splitView={splitView}
              useDarkTheme={document.documentElement.classList.contains("dark")}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: "#1f2937",
                    diffViewerColor: "#e5e7eb",
                    addedBackground: "#064e3b33",
                    addedColor: "#6ee7b7",
                    removedBackground: "#7f1d1d33",
                    removedColor: "#fca5a5",
                    wordAddedBackground: "#065f4655",
                    wordRemovedBackground: "#991b1b55",
                    addedGutterBackground: "#064e3b22",
                    removedGutterBackground: "#7f1d1d22",
                    gutterBackground: "#1f2937",
                    gutterBackgroundDark: "#111827",
                    highlightBackground: "#fbbf2422",
                    highlightGutterBackground: "#fbbf2411",
                    codeFoldGutterBackground: "#1f2937",
                    codeFoldBackground: "#111827",
                    emptyLineBackground: "#1f2937",
                    gutterColor: "#6b7280",
                    addedGutterColor: "#6ee7b7",
                    removedGutterColor: "#fca5a5",
                    codeFoldContentColor: "#6b7280",
                    diffViewerTitleBackground: "#111827",
                    diffViewerTitleColor: "#e5e7eb",
                    diffViewerTitleBorderColor: "#374151",
                  },
                },
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
