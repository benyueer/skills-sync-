# File Tree View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a file tree sidebar to SkillDetail so users can browse all files in complex skills (scripts, references, etc.)

**Architecture:** Extend SkillDetail with a split layout (sidebar + content pane). Add Tauri commands to list directory contents and read arbitrary files. Use highlight.js for syntax highlighting.

**Tech Stack:** React, TypeScript, Tauri (Rust), highlight.js

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Add `FileEntry` interface |
| `src-tauri/src/commands.rs` | Add `list_skill_files` and `read_file_content` commands |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/components/FileTree.tsx` | New recursive tree component |
| `src/components/SkillDetail.tsx` | Modified split layout with sidebar |
| `src/utils/syntaxHighlight.ts` | Syntax highlighting utility |
| `package.json` | Add highlight.js dependency |

---

### Task 1: Add FileEntry Type

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add FileEntry interface to types.ts**

```typescript
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}
```

Add this after the existing `Skill` interface.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add FileEntry type for file tree"
```

---

### Task 2: Add list_skill_files Tauri Command

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add FileEntry struct and list_skill_files command**

Add at the end of `commands.rs`, before the `reveal_path` function:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn list_skill_files(tool_id: String, skill_name: String) -> Result<Vec<FileEntry>, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_dir = resolve_skills_dir(&tool).join(&skill_name);

    if !skill_dir.exists() {
        return Err(format!("Skill directory does not exist: {}", skill_dir.display()));
    }

    build_file_tree(&skill_dir)
}

fn build_file_tree(dir: &std::path::Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    if let Ok(read_dir) = std::fs::read_dir(dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let is_directory = path.is_dir();
            let children = if is_directory {
                Some(build_file_tree(&path)?)
            } else {
                None
            };

            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                children,
            });
        }
    }

    entries.sort_by(|a, b| {
        // Directories first, then files
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add list_skill_files command"
```

---

### Task 3: Add read_file_content Tauri Command

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add read_file_content command**

Add after the `list_skill_files` command:

```rust
#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    let file_path = std::path::PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // Check file size (limit to 1MB)
    let metadata = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    if metadata.len() > 1_048_576 {
        return Err("File is too large (>1MB)".to_string());
    }

    // Check if file is binary by reading first 8KB
    let bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let preview = &bytes[..bytes.len().min(8192)];
    if preview.contains(&0) {
        return Err("Binary file cannot be displayed".to_string());
    }

    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add read_file_content command"
```

---

### Task 4: Register New Commands in Tauri

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add new commands to invoke_handler**

Read `src-tauri/src/lib.rs` and add `list_skill_files` and `read_file_content` to the `.invoke_handler(tauri::generate_handler![...])` macro.

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No compilation errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register new file tree commands"
```

---

### Task 5: Add highlight.js Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install highlight.js**

Run: `npm install highlight.js`

- [ ] **Step 2: Verify installation**

Run: `npm list highlight.js`
Expected: Shows installed version

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add highlight.js for syntax highlighting"
```

---

### Task 6: Create Syntax Highlighting Utility

**Files:**
- Create: `src/utils/syntaxHighlight.ts`

- [ ] **Step 1: Create syntax highlighting utility**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/utils/syntaxHighlight.ts
git commit -m "feat: add syntax highlighting utility"
```

---

### Task 7: Create FileTree Component

**Files:**
- Create: `src/components/FileTree.tsx`

- [ ] **Step 1: Create FileTree component**

```typescript
import { useState } from "react";
import type { FileEntry } from "../types";

interface Props {
  files: FileEntry[];
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

function FileTreeItem({ file, selectedPath, onSelect, level = 0 }: Props & { file: FileEntry }) {
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
          files={files}
          selectedPath={selectedPath}
          onSelect={onSelect}
          level={level}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/FileTree.tsx
git commit -m "feat: add FileTree component"
```

---

### Task 8: Modify SkillDetail for Split Layout

**Files:**
- Modify: `src/components/SkillDetail.tsx`

- [ ] **Step 1: Update SkillDetail with file tree sidebar**

Replace the entire content of `src/components/SkillDetail.tsx` with:

```typescript
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Skill, FileEntry } from "../types";
import { FileTree } from "./FileTree";
import { highlightCode } from "../utils/syntaxHighlight";

interface Props {
  skill: Skill;
  onBack: () => void;
}

const EDITORS = [
  { label: "VS Code", command: "code" },
  { label: "Notepad", command: "notepad" },
  { label: "Choose app...", command: "__pick__" },
];

export function SkillDetail({ skill, onBack }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasMultipleFiles = files.length > 1 || (files.length === 1 && files[0].isDirectory);

  useEffect(() => {
    setLoading(true);
    invoke<FileEntry[]>("list_skill_files", { toolId: skill.toolId, skillName: skill.name })
      .then((fileList) => {
        setFiles(fileList);
        // Default to SKILL.md
        const skillMd = fileList.find((f) => f.name === "SKILL.md");
        if (skillMd) {
          setSelectedPath(skillMd.path);
        }
      })
      .catch((e) => {
        // Fallback: try to read SKILL.md directly
        invoke<string>("read_skill_file", { toolId: skill.toolId, skillName: skill.name })
          .then((c) => {
            setContent(c);
            setSelectedPath(null);
          })
          .catch((e2) => setContent(`Error: ${e2}`));
      })
      .finally(() => setLoading(false));
  }, [skill]);

  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    invoke<string>("read_file_content", { path: selectedPath })
      .then((c) => setContent(c))
      .catch((e) => setContent(`Error: ${e}`))
      .finally(() => setLoading(false));
  }, [selectedPath]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleOpenWith = async (command: string) => {
    setMenuOpen(false);
    let appPath = command;

    if (command === "__pick__") {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Executables", extensions: ["exe", "cmd", "bat", "com"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!selected) return;
      appPath = selected as string;
    }

    try {
      await invoke("open_skill_with_app", {
        toolId: skill.toolId,
        skillName: skill.name,
        appPath,
      });
    } catch (e) {
      alert(`Failed to open: ${e}`);
    }
  };

  const getFilename = () => {
    if (!selectedPath) return "SKILL.md";
    return selectedPath.split(/[/\\]/).pop() || "SKILL.md";
  };

  const renderContent = () => {
    if (loading) {
      return <div className="text-gray-400 text-sm">Loading...</div>;
    }

    const filename = getFilename();
    const highlighted = highlightCode(content, filename);

    return (
      <pre
        className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10">
              {EDITORS.map((editor) => (
                <button
                  key={editor.command}
                  onClick={() => handleOpenWith(editor.command)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {editor.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {hasMultipleFiles && (
          <div className="w-48 border-r border-gray-200 dark:border-gray-700 overflow-auto">
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          {renderContent()}
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={async () => {
            try {
              await invoke("reveal_path", { path: skill.path });
            } catch (e) {
              alert(`Failed to open path: ${e}`);
            }
          }}
          className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:underline cursor-pointer"
          aria-label="Reveal skill folder in file explorer"
          title="Open in file explorer"
        >
          {skill.path}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx
git commit -m "feat: add file tree sidebar to SkillDetail"
```

---

### Task 9: Test the Feature

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: App starts without errors

- [ ] **Step 2: Test with a skill that has only SKILL.md**

1. Open the app
2. Click on a skill with only SKILL.md
3. Verify: No sidebar shown, content displays directly

- [ ] **Step 3: Test with a complex skill**

1. Click on a skill with scripts/ or references/
2. Verify: Sidebar shows file tree
3. Click on a file in the tree
4. Verify: Content displays with syntax highlighting

- [ ] **Step 4: Test edge cases**

1. Click on a folder → verify expand/collapse works
2. Click Edit button → verify external editor opens
3. Click path at bottom → verify file explorer opens

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete file tree view for complex skills"
```
