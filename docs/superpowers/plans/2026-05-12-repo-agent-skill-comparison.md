# Repo-Agent Skill Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare skills from a git repository against each Agent's local skills directory, showing sync status via color-coded backgrounds and a diff view.

**Architecture:** The Rust backend gets a new `compare_skills` Tauri command that walks both the repo's `skills/` directory and the agent's local skills directory, compares file contents, and returns each skill with a sync status (`identical`, `agent-only`, `repo-only`, `different`). The frontend renders color-coded `SkillCard`s and a `SkillDetail` view with a diff toggle.

**Tech Stack:** Rust (walkdir, serde), React 19, TypeScript, Tailwind CSS v4

---

## File Structure

### Backend (Rust)

| File | Change | Responsibility |
|------|--------|----------------|
| `src-tauri/src/sync.rs` | Modify | Add `collect_skill_files()` helper, `compare_skill_dirs()`, and `compute_skill_diff()` functions |
| `src-tauri/src/commands.rs` | Modify | Add `SkillSyncStatus` struct, `compare_skills` and `get_skill_diff` Tauri commands |
| `src-tauri/src/lib.rs` | Modify | Register `compare_skills` and `get_skill_diff` commands |

### Frontend (TypeScript/React)

| File | Change | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add `SkillSyncStatus` interface and `SyncStatus` type |
| `src/hooks/useSkills.ts` | Modify | Add `useComparedSkills` hook |
| `src/components/SkillCard.tsx` | Modify | Accept optional `syncStatus` prop, apply color-coded background |
| `src/components/SkillList.tsx` | Modify | Pass `syncStatus` to `SkillCard` |
| `src/components/SkillDetail.tsx` | Modify | Add diff view toggle, apply status-colored background |
| `src/App.tsx` | Modify | Use `useComparedSkills` instead of `useSkills` for comparison data |

---

### Task 1: Backend — Add `compare_skills` Rust function and Tauri command

**Files:**
- Modify: `src-tauri/src/sync.rs:1-121`
- Modify: `src-tauri/src/commands.rs:1-415`
- Modify: `src-tauri/src/lib.rs:12-30`

- [ ] **Step 1: Add `collect_skill_files` helper to `sync.rs`**

This helper walks a skill directory and returns a `BTreeMap<relative_path, content>` for deterministic comparison.

Note: Move the existing `compute_diff` function (currently at `commands.rs:156-183`) into `sync.rs` as well, since the new `compute_skill_diff` function needs it.

Add to the bottom of `src-tauri/src/sync.rs`:

```rust
use std::collections::BTreeMap;

/// Collect all files in a skill directory as relative_path -> content bytes.
fn collect_skill_files(skill_dir: &std::path::Path) -> BTreeMap<String, Vec<u8>> {
    let mut files = BTreeMap::new();
    for entry in walkdir::WalkDir::new(skill_dir) {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(skill_dir)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .to_string();
        if let Ok(content) = std::fs::read(entry.path()) {
            files.insert(rel, content);
        }
    }
    files
}
```

- [ ] **Step 2: Add `compare_skill_dirs` function to `sync.rs`**

This function compares the repo's `skills/` directory against an agent's skills directory and returns status for each skill.

Add after `collect_skill_files` in `src-tauri/src/sync.rs`:

```rust
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncStatus {
    pub name: String,
    pub status: String, // "identical" | "agent-only" | "repo-only" | "different"
    pub repo_path: Option<std::path::PathBuf>,
    pub agent_path: Option<std::path::PathBuf>,
}

/// Compare skills in repo_dir/skills/ against agent's skills_dir.
/// Returns a list of SkillSyncStatus for every skill found in either location.
pub fn compare_skill_dirs(
    repo_skills_dir: &std::path::Path,
    agent_skills_dir: &std::path::Path,
) -> Vec<SkillSyncStatus> {
    let repo_skills = if repo_skills_dir.exists() {
        crate::skill::discover_skills(repo_skills_dir, "repo")
    } else {
        Vec::new()
    };
    let agent_skills = crate::skill::discover_skills(agent_skills_dir, "agent");

    let repo_map: std::collections::HashMap<String, &crate::skill::Skill> = repo_skills
        .iter()
        .map(|s| (s.name.clone(), s))
        .collect();
    let agent_map: std::collections::HashMap<String, &crate::skill::Skill> = agent_skills
        .iter()
        .map(|s| (s.name.clone(), s))
        .collect();

    let mut all_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_names.extend(repo_map.keys().cloned());
    all_names.extend(agent_map.keys().cloned());

    let mut result: Vec<SkillSyncStatus> = all_names
        .into_iter()
        .map(|name| {
            let in_repo = repo_map.get(&name);
            let in_agent = agent_map.get(&name);

            let status = match (in_repo, in_agent) {
                (Some(repo_skill), Some(agent_skill)) => {
                    let repo_files = collect_skill_files(&repo_skill.path);
                    let agent_files = collect_skill_files(&agent_skill.path);
                    if repo_files == agent_files {
                        "identical"
                    } else {
                        "different"
                    }
                }
                (Some(_), None) => "repo-only",
                (None, Some(_)) => "agent-only",
                (None, None) => unreachable!(),
            };

            SkillSyncStatus {
                name: name.clone(),
                status: status.to_string(),
                repo_path: in_repo.map(|s| s.path.clone()),
                agent_path: in_agent.map(|s| s.path.clone()),
            }
        })
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}
```

- [ ] **Step 3: Add `compute_skill_diff` function to `sync.rs`**

This function computes a file-by-file diff between an agent skill and the corresponding repo skill.

Add after `compare_skill_dirs` in `src-tauri/src/sync.rs`:

```rust
/// Compute a unified diff between agent's skill files and repo's skill files.
/// Returns a map of relative_file_path -> diff_string.
pub fn compute_skill_diff(
    agent_skill_dir: &std::path::Path,
    repo_skill_dir: &std::path::Path,
) -> std::collections::HashMap<String, String> {
    let agent_files = collect_skill_files(agent_skill_dir);
    let repo_files = collect_skill_files(repo_skill_dir);

    let mut all_files: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_files.extend(agent_files.keys().cloned());
    all_files.extend(repo_files.keys().cloned());

    let mut diffs = std::collections::HashMap::new();

    for file in all_files {
        let agent_content = agent_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());
        let repo_content = repo_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());

        let diff = match (&agent_content, &repo_content) {
            (Some(a), Some(r)) if a == r => continue, // identical, skip
            (Some(a), Some(r)) => compute_diff(a, r),
            (Some(a), None) => {
                a.lines().map(|l| format!("-{}", l)).collect::<Vec<_>>().join("\n")
            }
            (None, Some(r)) => {
                r.lines().map(|l| format!("+{}", l)).collect::<Vec<_>>().join("\n")
            }
            (None, None) => continue,
        };
        diffs.insert(file, diff);
    }

    diffs
}
```

- [ ] **Step 4: Add `SkillSyncStatus` import and commands to `commands.rs`**

First, remove the local `compute_diff` function (lines 156-183) from `commands.rs` since it was moved to `sync.rs` in Step 1. Update the call in `preview_restore` (line 217) to use `sync::compute_diff` instead.

Update the import at the top of `src-tauri/src/commands.rs` (line 1):

```rust
use crate::{config, skill, skill::Skill, sync, sync::SkillSyncStatus, tools::Tool};
use std::collections::HashMap;
```

Add the `compare_skills` command after the `sync_from_git` function (after line 68):

```rust
#[tauri::command]
pub fn compare_skills(tool_id: String) -> Result<Vec<SkillSyncStatus>, String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Err("Git repo not cloned yet. Set a Git URL and sync first.".to_string());
    }

    let repo_skills_dir = std::path::PathBuf::from(&cfg.repo_local_path).join("skills");
    let tool = parse_tool(&tool_id)?;
    let agent_skills_dir = resolve_skills_dir(&tool);

    Ok(sync::compare_skill_dirs(&repo_skills_dir, &agent_skills_dir))
}
```

Add the `get_skill_diff` command after `compare_skills`:

```rust
#[tauri::command]
pub fn get_skill_diff(tool_id: String, skill_name: String, repo_path: String) -> Result<HashMap<String, String>, String> {
    let tool = parse_tool(&tool_id)?;
    let agent_skill_dir = resolve_skills_dir(&tool).join(&skill_name);
    let repo_skill_dir = std::path::PathBuf::from(&repo_path);

    if !agent_skill_dir.exists() {
        return Err(format!("Agent skill directory not found: {}", agent_skill_dir.display()));
    }
    if !repo_skill_dir.exists() {
        return Err(format!("Repo skill directory not found: {}", repo_skill_dir.display()));
    }

    Ok(sync::compute_skill_diff(&agent_skill_dir, &repo_skill_dir))
}
```

Add the `list_repo_skill_files` command for viewing repo-only skills:

```rust
#[tauri::command]
pub fn list_repo_skill_files(repo_path: String) -> Result<Vec<FileEntry>, String> {
    let skill_dir = std::path::PathBuf::from(&repo_path);
    if !skill_dir.exists() {
        return Err(format!("Skill directory does not exist: {}", skill_dir.display()));
    }
    build_file_tree(&skill_dir, 20)
}
```

Add the `read_repo_file_content` command for viewing repo-only skill files:

```rust
#[tauri::command]
pub fn read_repo_file_content(path: String) -> Result<String, String> {
    let file_path = std::path::PathBuf::from(&path);
    let metadata = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    if metadata.len() > 1_048_576 {
        return Err("File is too large (>1MB)".to_string());
    }
    let bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let preview = &bytes[..bytes.len().min(8192)];
    if preview.contains(&0) {
        return Err("Binary file cannot be displayed".to_string());
    }
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}
```

- [ ] **Step 5: Register all new commands in `lib.rs`**

Add `commands::compare_skills` and `commands::get_skill_diff` to the `invoke_handler` macro in `src-tauri/src/lib.rs` (after line 29, before the closing `]`):

```rust
            commands::compare_skills,
            commands::get_skill_diff,
            commands::list_repo_skill_files,
            commands::read_repo_file_content,
```

- [ ] **Step 6: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/sync.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add compare_skills backend command for repo-agent skill comparison"
```

---

### Task 2: Frontend — Add types and `useComparedSkills` hook

**Files:**
- Modify: `src/types.ts:1-55`
- Modify: `src/hooks/useSkills.ts:1-91`

- [ ] **Step 1: Add `SkillSyncStatus` type to `types.ts`**

Add after the `BackupDiff` interface (after line 41) in `src/types.ts`:

```typescript
export type SyncStatus = "identical" | "agent-only" | "repo-only" | "different";

export interface SkillSyncStatus {
  name: string;
  status: SyncStatus;
  repoPath: string | null;
  agentPath: string | null;
}
```

- [ ] **Step 2: Add `useComparedSkills` hook to `useSkills.ts`**

Add after the `useSync` function (after line 90) in `src/hooks/useSkills.ts`:

```typescript
export function useComparedSkills(toolId: ToolId) {
  const [comparedSkills, setComparedSkills] = useState<SkillSyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SkillSyncStatus[]>("compare_skills", { toolId });
      setComparedSkills(result);
    } catch (e) {
      // If repo not configured, this is not an error — just no comparison available
      const msg = String(e);
      if (msg.includes("not cloned")) {
        setComparedSkills([]);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { comparedSkills, loading, error, refresh };
}
```

Also add `SkillSyncStatus` to the import from `../types` at line 3:

```typescript
import type { Skill, AppConfig, ToolId, SkillSyncStatus } from "../types";
```

- [ ] **Step 3: Verify frontend compiles**

Run: `pnpm build`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/hooks/useSkills.ts
git commit -m "feat: add SkillSyncStatus types and useComparedSkills hook"
```

---

### Task 3: Frontend — Update `SkillCard` with color-coded backgrounds

**Files:**
- Modify: `src/components/SkillCard.tsx:1-36`

- [ ] **Step 1: Update `SkillCard` to accept and display sync status**

Replace the entire content of `src/components/SkillCard.tsx`:

```typescript
import type { Skill, SyncStatus } from "../types";

interface Props {
  skill: Skill;
  onClick: () => void;
  syncStatus?: SyncStatus;
}

const STATUS_STYLES: Record<SyncStatus, string> = {
  identical: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
  "agent-only": "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
  "repo-only": "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
  different: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  identical: "Synced",
  "agent-only": "Agent only",
  "repo-only": "Repo only",
  different: "Modified",
};

export function SkillCard({ skill, onClick, syncStatus }: Props) {
  const statusStyle = syncStatus ? STATUS_STYLES[syncStatus] : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-colors hover:border-blue-300 dark:hover:border-blue-600 ${statusStyle}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {skill.name}
        </h3>
        {syncStatus && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400">
            {STATUS_LABELS[syncStatus]}
          </span>
        )}
        {skill.hasScripts && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            scripts
          </span>
        )}
        {skill.hasReferences && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            refs
          </span>
        )}
      </div>
      {skill.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {skill.description}
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillCard.tsx
git commit -m "feat: add color-coded backgrounds to SkillCard based on sync status"
```

---

### Task 4: Frontend — Update `SkillList` to pass sync status to cards

**Files:**
- Modify: `src/components/SkillList.tsx:1-51`

- [ ] **Step 1: Update `SkillList` to accept and pass compared skills**

Replace the entire content of `src/components/SkillList.tsx`:

```typescript
import type { Skill, ToolId, SkillSyncStatus } from "../types";
import { SkillCard } from "./SkillCard";
import { EmptyState } from "./EmptyState";

interface Props {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  toolId: ToolId;
  onSelect: (skill: Skill) => void;
  onOpenDir: (toolId: ToolId) => void;
  comparedSkills?: SkillSyncStatus[];
}

export function SkillList({ skills, loading, error, toolId, onSelect, onOpenDir, comparedSkills }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full" />
        <span className="ml-2 text-sm">Loading skills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 m-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  // Build a lookup map from comparedSkills for O(1) status access
  const statusMap = new Map(
    (comparedSkills ?? []).map((cs) => [cs.name, cs.status])
  );

  // Merge: show all agent skills + any repo-only skills not in agent list
  const mergedSkills = [...skills];
  const agentNames = new Set(skills.map((s) => s.name));
  for (const cs of comparedSkills ?? []) {
    if (!agentNames.has(cs.name)) {
      // Repo-only skill — synthesize a minimal Skill object for display
      mergedSkills.push({
        name: cs.name,
        description: "",
        path: cs.repoPath ?? "",
        toolId: "repo",
        hasScripts: false,
        hasReferences: false,
      });
    }
  }

  if (mergedSkills.length === 0) {
    return (
      <EmptyState
        message="No skills found for this tool"
        action={{ label: "Open skills directory", onClick: () => onOpenDir(toolId) }}
      />
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {mergedSkills.length} skill{mergedSkills.length !== 1 ? "s" : ""} found
        {comparedSkills && comparedSkills.length > 0 && (
          <span className="ml-2">
            ({comparedSkills.filter((s) => s.status === "identical").length} synced,
            {" "}{comparedSkills.filter((s) => s.status === "different").length} modified,
            {" "}{comparedSkills.filter((s) => s.status === "repo-only").length} repo only,
            {" "}{comparedSkills.filter((s) => s.status === "agent-only").length} agent only)
          </span>
        )}
      </p>
      {mergedSkills.map((skill) => (
        <SkillCard
          key={skill.name}
          skill={skill}
          syncStatus={statusMap.get(skill.name)}
          onClick={() => onSelect(skill)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillList.tsx
git commit -m "feat: pass sync status to SkillCard and show repo-only skills"
```

---

### Task 5: Frontend — Update `SkillDetail` with status-colored background and diff view

**Files:**
- Modify: `src/components/SkillDetail.tsx:1-193`

- [ ] **Step 1: Add sync status props and diff view to `SkillDetail`**

Replace the entire content of `src/components/SkillDetail.tsx`:

```typescript
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Skill, FileEntry, SyncStatus } from "../types";
import { FileTree } from "./FileTree";
import { highlightCode } from "../utils/syntaxHighlight";

interface Props {
  skill: Skill;
  onBack: () => void;
  syncStatus?: SyncStatus;
  repoPath?: string | null;
}

const EDITORS = [
  { label: "VS Code", command: "code" },
  { label: "Notepad", command: "notepad" },
  { label: "Choose app...", command: "__pick__" },
];

const STATUS_BG: Record<SyncStatus, string> = {
  identical: "bg-green-50 dark:bg-green-900/10",
  "agent-only": "bg-orange-50 dark:bg-orange-900/10",
  "repo-only": "bg-gray-100 dark:bg-gray-800/50",
  different: "bg-yellow-50 dark:bg-yellow-900/10",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  identical: "Synced with repo",
  "agent-only": "Only in agent (not in repo)",
  "repo-only": "Only in repo (not in agent)",
  different: "Modified (differs from repo)",
};

function findFirstFile(entries: FileEntry[]): FileEntry | null {
  for (const entry of entries) {
    if (!entry.isDirectory) return entry;
    if (entry.children) {
      const found = findFirstFile(entry.children);
      if (found) return found;
    }
  }
  return null;
}

export function SkillDetail({ skill, onBack, syncStatus, repoPath }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Diff view state
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Load file list on mount
  useEffect(() => {
    setLoading(true);
    if (syncStatus === "repo-only" && repoPath) {
      // Repo-only: list files from the repo path directly
      invoke<FileEntry[]>("list_repo_skill_files", { repoPath })
        .then((fileList) => {
          setFiles(fileList);
          const firstFile = findFirstFile(fileList);
          if (firstFile) {
            setSelectedPath(firstFile.path);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    } else {
      invoke<FileEntry[]>("list_skill_files", { toolId: skill.toolId, skillName: skill.name })
        .then((fileList) => {
          setFiles(fileList);
          const firstFile = findFirstFile(fileList);
          if (firstFile) {
            setSelectedPath(firstFile.path);
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          invoke<string>("read_skill_file", { toolId: skill.toolId, skillName: skill.name })
            .then((text) => setContent(text))
            .catch((e) => setContent(`Error: ${e}`))
            .finally(() => setLoading(false));
        });
    }
  }, [skill, syncStatus, repoPath]);

  // Load file content when selectedPath changes
  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    if (syncStatus === "repo-only") {
      invoke<string>("read_repo_file_content", { path: selectedPath })
        .then(setContent)
        .catch((e) => setContent(`Error: ${e}`))
        .finally(() => setLoading(false));
    } else {
      invoke<string>("read_file_content", { toolId: skill.toolId, path: selectedPath })
        .then(setContent)
        .catch((e) => setContent(`Error: ${e}`))
        .finally(() => setLoading(false));
    }
  }, [selectedPath, skill.toolId, syncStatus]);

  // Load diff content when toggled — calls backend get_skill_diff
  useEffect(() => {
    if (!showDiff || !repoPath) {
      setDiffContent(null);
      return;
    }
    setDiffLoading(true);
    invoke<Record<string, string>>("get_skill_diff", {
      toolId: skill.toolId,
      skillName: skill.name,
      repoPath,
    })
      .then((diffs) => {
        const parts: string[] = [];
        for (const [file, diff] of Object.entries(diffs)) {
          parts.push(`--- ${file} ---`);
          parts.push(diff);
        }
        setDiffContent(parts.length > 0 ? parts.join("\n") : "No differences found.");
      })
      .catch((e) => setDiffContent(`Error loading diff: ${e}`))
      .finally(() => setDiffLoading(false));
  }, [showDiff, repoPath, skill.name, skill.toolId]);

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

  const bgClass = syncStatus ? STATUS_BG[syncStatus] : "";

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
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
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
            {syncStatus && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400">
                {STATUS_LABELS[syncStatus]}
              </span>
            )}
          </div>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {syncStatus === "different" && repoPath && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showDiff
                  ? "bg-yellow-500 text-white"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {showDiff ? "Hide Diff" : "Show Diff"}
            </button>
          )}
          {syncStatus !== "repo-only" && (
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
          )}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {files.length > 1 && (
          <div className="w-[200px] border-r border-gray-200 dark:border-gray-700 overflow-auto">
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : showDiff && syncStatus === "different" ? (
            <div>
              {diffLoading ? (
                <div className="text-gray-400 text-sm">Computing diff...</div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  {(diffContent ?? "").split("\n").map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.startsWith("+")
                          ? "text-green-600 dark:text-green-400"
                          : line.startsWith("-")
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-500"
                      }
                    >
                      {line}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          ) : (
            <pre
              className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg"
              dangerouslySetInnerHTML={{
                __html: selectedPath
                  ? highlightCode(content, selectedPath)
                  : content,
              }}
            />
          )}
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {syncStatus === "repo-only" ? (
          <span className="text-xs text-gray-400">
            Repo: {repoPath}
          </span>
        ) : (
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
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx
git commit -m "feat: add sync status background and diff view toggle to SkillDetail"
```

---

### Task 6: Frontend — Wire up `useComparedSkills` in `App.tsx`

**Files:**
- Modify: `src/App.tsx:1-207`

- [ ] **Step 1: Import `useComparedSkills` and update App**

In `src/App.tsx`, update the imports (line 8):

```typescript
import { useSkills, useConfig, useSync, useComparedSkills } from "./hooks/useSkills";
```

After line 28 (`const { syncing, syncResult, syncError, sync } = useSync();`), add:

```typescript
  const { comparedSkills, refresh: refreshCompared } = useComparedSkills(activeTab);
```

Update the `handleSync` callback (line 113) to also refresh compared skills:

```typescript
  const handleSync = useCallback(async () => {
    await sync();
    refresh();
    refreshCompared();
  }, [sync, refresh, refreshCompared]);
```

Update the `handleTabChange` callback (line 122) — no change needed since `useComparedSkills` already reacts to `activeTab` changes.

Update the `handleRestoreConfirm` callback (line 139) to also refresh compared skills:

```typescript
  const handleRestoreConfirm = useCallback(() => {
    setRestoreTarget(null);
    refresh();
    refreshCompared();
  }, [refresh, refreshCompared]);
```

Update the `SkillList` usage (around line 183) to pass `comparedSkills`:

```typescript
            <SkillList
              skills={skills}
              loading={loading}
              error={error}
              toolId={activeTab}
              onSelect={setSelectedSkill}
              onOpenDir={handleOpenDir}
              comparedSkills={comparedSkills}
            />
```

Update the `SkillDetail` usage (around line 171) to pass sync status and repo path. We need to find the sync status for the selected skill:

```typescript
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            onBack={() => setSelectedSkill(null)}
            syncStatus={comparedSkills.find((cs) => cs.name === selectedSkill.name)?.status}
            repoPath={comparedSkills.find((cs) => cs.name === selectedSkill.name)?.repoPath}
          />
        ) : (
```

- [ ] **Step 2: Verify frontend compiles**

Run: `pnpm build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up useComparedSkills in App for repo-agent skill comparison"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Build the full project**

Run: `pnpm build && cd src-tauri && cargo build`
Expected: No errors.

- [ ] **Step 2: Manual test — no repo configured**

1. Launch the app with no git URL set.
2. Verify: Skills display normally without color coding (white/default background).
3. Verify: No errors in console.

- [ ] **Step 3: Manual test — with repo configured**

1. Set a Git Repository URL that contains a `skills/` directory with some skills.
2. Click Sync.
3. Switch to a tool tab (e.g., Claude Code).
4. Verify: Skills show color-coded backgrounds:
   - Green if the skill in the agent matches the repo exactly.
   - Yellow if both have the skill but contents differ.
   - Orange if the skill exists only in the agent.
   - Gray if the skill exists only in the repo.
5. Verify: Status label appears on each card ("Synced", "Modified", "Agent only", "Repo only").
6. Verify: Summary counts appear in the list header.

- [ ] **Step 4: Manual test — diff view**

1. Click on a skill with "Modified" (yellow) status.
2. Verify: Detail page has a yellow-tinted background.
3. Verify: "Show Diff" button appears in the header.
4. Click "Show Diff".
5. Verify: Diff view shows `+`/`-` lines with green/red coloring.
6. Click "Hide Diff" to toggle back to normal file view.

- [ ] **Step 5: Manual test — repo-only skills**

1. Verify: Skills that exist only in the repo appear in the list with gray background.
2. Click on a repo-only skill.
3. Verify: Detail page shows gray background and "Only in repo" label.

- [ ] **Step 6: Commit final state if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
```
