import { useState } from "react";
import type { FileEntry } from "../types";

interface Props {
  files: FileEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  level?: number;
}

interface TreeItemProps {
  file: FileEntry;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  level?: number;
}

function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return "📁";
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const icons: Record<string, string> = {
    ".md": "📄",
    ".py": "🐍",
    ".sh": "🔧",
    ".bash": "🔧",
    ".js": "📜",
    ".ts": "📜",
    ".json": "📋",
    ".yaml": "📋",
    ".yml": "📋",
    ".rs": "⚙️",
    ".html": "🌐",
    ".css": "🎨",
  };
  return icons[ext] || "📄";
}

function FileTreeItem({ file, selectedPath, onSelect, level = 0 }: TreeItemProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const isSelected = file.path === selectedPath;
  const hasChildren = file.children && file.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (file.isDirectory) {
            setExpanded(!expanded);
          } else {
            onSelect(file.path);
          }
        }}
        className={`w-full text-left px-2 py-1 text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
          isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {file.isDirectory && (
          <span className="w-4 text-gray-400">
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!file.isDirectory && <span className="w-4" />}
        <span>{getFileIcon(file.name, file.isDirectory)}</span>
        <span className="truncate">{file.name}</span>
      </button>
      {file.isDirectory && expanded && hasChildren && file.children && (
        <FileTree
          files={file.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          level={level + 1}
        />
      )}
    </div>
  );
}

export function FileTree({ files, selectedPath, onSelect, level = 0 }: Props) {
  return (
    <div>
      {files.map((file) => (
        <FileTreeItem
          key={file.path}
          file={file}
          selectedPath={selectedPath}
          onSelect={onSelect}
          level={level}
        />
      ))}
    </div>
  );
}
