# Toolbar, Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toolbar above each tab's skill list with: custom skills directory path override, backup (copy to date-suffixed directory), and restore (with diff preview showing added/deleted/changed skills before confirmation).

**Architecture:** Extend `AppConfig` with per-tool custom directory overrides. Add Rust commands for backup/restore with a `BackupDiff` struct describing additions, deletions, and modifications. Frontend gets a `TabToolbar` component with a `RestoreDialog` that shows unified-style diffs for changed skills.

**Tech Stack:** Rust (walkdir, chrono, serde), TypeScript, React, Tailwind CSS, Tauri v2 dialog plugin

---

### Task 1: Extend config with custom skills directories

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/types.ts`

- [ ] **Step 1: Add custom_skills_dirs to AppConfig**

In `src-tauri/src/config.rs`, add a `HashMap<String, String>` field:

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub git_repo_url: String,
    pub last_sync: Option<String>,
    #[serde(default)]
    pub repo_local_path: String,
    #[serde(default)]
    pub custom_skills_dirs: HashMap<String, String>,
}
```

- [ ] **Step 2: Add save_custom_dir command and resolve_skills_dir helper**

In `src-tauri/src/commands.rs`, add a helper function and the new command:

```rust
fn resolve_skills_dir(tool: &Tool) -> std::path::PathBuf {
    let cfg = config::load();
    if let Some(custom) = cfg.custom_skills_dirs.get(tool.id()) {
        let path = std::path::PathBuf::from(custom);
        if !path.as_os_str().is_empty() {
            return path;
        }
    }
    tool.skills_dir()
}

#[tauri::command]
pub fn save_custom_dir(tool_id: String, path: String) -> Result<(), String> {
    let mut cfg = config::load();
    if path.is_empty() {
        cfg.custom_skills_dirs.remove(&tool_id);
    } else {
        cfg.custom_skills_dirs.insert(tool_id, path);
    }
    config::save(&cfg)
}
```

In `src-tauri/src/commands.rs`, add:

```rust
#[tauri::command]
pub fn save_custom_dir(tool_id: String, path: String) -> Result<(), String> {
    let mut cfg = config::load();
    if path.is_empty() {
        cfg.custom_skills_dirs.remove(&tool_id);
    } else {
        cfg.custom_skills_dirs.insert(tool_id, path);
    }
    config::save(&cfg)
}
```

Update the import to include the new function if needed.

- [ ] **Step 3: Update all commands to use resolve_skills_dir**

In `src-tauri/src/commands.rs`, update `get_skills`, `open_skills_dir`, and `read_skill_file` to use the config-aware path instead of `tool.skills_dir()`:

```rust
#[tauri::command]
pub fn get_skills(tool_id: String) -> Result<Vec<Skill>, String> {
    let tool = parse_tool(&tool_id)?;
    let dir = resolve_skills_dir(&tool);
    Ok(skill::discover_skills(&dir, tool.id()))
}

#[tauri::command]
pub fn open_skills_dir(tool_id: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let dir = resolve_skills_dir(&tool);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    opener::open(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_skill_file(tool_id: String, skill_name: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_md = resolve_skills_dir(&tool).join(&skill_name).join("SKILL.md");
    std::fs::read_to_string(&skill_md).map_err(|e| format!("Cannot read {}: {}", skill_md.display(), e))
}
```

- [ ] **Step 4: Register new command in lib.rs**

Add `commands::save_custom_dir` to the `generate_handler![]` macro in `src-tauri/src/lib.rs`.

- [ ] **Step 5: Update TypeScript types**

In `src/types.ts`, add `customSkillsDirs` to `AppConfig`:

```typescript
export interface AppConfig {
  gitRepoUrl: string;
  lastSync: string | null;
  repoLocalPath: string;
  customSkillsDirs: Record<string, string>;
}
```

- [ ] **Step 6: Add save_custom_dir to useConfig hook**

In `src/hooks/useSkills.ts`, add to the `useConfig` hook:

```typescript
const saveCustomDir = useCallback(async (toolId: string, path: string) => {
  await invoke("save_custom_dir", { toolId, path });
  await refresh();
}, [refresh]);
```

Return it: `return { config, save, saveCustomDir, refresh };`

- [ ] **Step 7: Verify builds**

Run: `cd src-tauri && cargo build` and `npm run build`
Expected: Both succeed

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/types.ts src/hooks/useSkills.ts
git commit -m "feat: add custom skills directory config with save_custom_dir command"
```

---

### Task 2: Add backup command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement backup_skills command**

In `src-tauri/src/commands.rs`, add:

```rust
#[tauri::command]
pub fn backup_skills(tool_id: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let src = resolve_skills_dir(&tool);

    if !src.exists() {
        return Err(format!("Skills directory does not exist: {}", src.display()));
    }

    let parent = src.parent().ok_or("Cannot determine parent directory")?;
    let dir_name = src.file_name()
        .ok_or("Cannot determine directory name")?
        .to_string_lossy();

    let date_suffix = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_name = format!("{}-{}", dir_name, date_suffix);
    let dst = parent.join(&backup_name);

    crate::sync::copy_dir_recursive(&src, &dst);

    Ok(dst.to_string_lossy().to_string())
}
```

- [ ] **Step 2: Make copy_dir_recursive public**

In `src-tauri/src/sync.rs`, change `fn copy_dir_recursive` to `pub fn copy_dir_recursive`.

- [ ] **Step 3: Register backup_skills in lib.rs**

Add `commands::backup_skills` to the `generate_handler![]` macro.

- [ ] **Step 4: Verify Rust builds**

Run: `cd src-tauri && cargo build`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/sync.rs src-tauri/src/lib.rs
git commit -m "feat: add backup_skills command"
```

---

### Task 3: Add restore preview and execute commands

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types.ts`

- [ ] **Step 1: Define BackupDiff struct and related types**

In `src-tauri/src/commands.rs`, add at the top:

```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDiff {
    pub name: String,
    pub status: String,  // "added", "deleted", "changed"
    pub diff: String,     // unified diff for "changed", empty otherwise
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDiff {
    pub backup_path: String,
    pub added: Vec<String>,
    pub deleted: Vec<String>,
    pub changed: Vec<SkillDiff>,
}
```

- [ ] **Step 2: Implement preview_restore command**

In `src-tauri/src/commands.rs`, add:

```rust
#[tauri::command]
pub fn preview_restore(tool_id: String, backup_path: String) -> Result<BackupDiff, String> {
    let tool = parse_tool(&tool_id)?;
    let current_dir = resolve_skills_dir(&tool);
    let backup_dir = std::path::PathBuf::from(&backup_path);

    if !backup_dir.exists() {
        return Err(format!("Backup directory does not exist: {}", backup_path));
    }

    let current_skills = skill::discover_skills(&current_dir, tool.id());
    let backup_skills = skill::discover_skills(&backup_dir, tool.id());

    let current_names: std::collections::HashSet<String> =
        current_skills.iter().map(|s| s.name.clone()).collect();
    let backup_names: std::collections::HashSet<String> =
        backup_skills.iter().map(|s| s.name.clone()).collect();

    let added: Vec<String> = backup_names.difference(&current_names).cloned().collect();
    let deleted: Vec<String> = current_names.difference(&backup_names).cloned().collect();

    let mut changed = Vec::new();
    for name in current_names.intersection(&backup_names) {
        let current_md = current_dir.join(name).join("SKILL.md");
        let backup_md = backup_dir.join(name).join("SKILL.md");

        let current_content = std::fs::read_to_string(&current_md)
            .unwrap_or_default();
        let backup_content = std::fs::read_to_string(&backup_md)
            .unwrap_or_default();

        if current_content != backup_content {
            let diff = compute_diff(&current_content, &backup_content);
            changed.push(SkillDiff {
                name: name.clone(),
                status: "changed".to_string(),
                diff,
            });
        }
    }

    Ok(BackupDiff {
        backup_path,
        added,
        deleted,
        changed,
    })
}

fn compute_diff(current: &str, backup: &str) -> String {
    let current_lines: Vec<&str> = current.lines().collect();
    let backup_lines: Vec<&str> = backup.lines().collect();

    let mut result = String::new();
    let max_len = current_lines.len().max(backup_lines.len());

    for i in 0..max_len {
        match (current_lines.get(i), backup_lines.get(i)) {
            (Some(a), Some(b)) if a == b => {
                result.push_str(&format!(" {}\n", a));
            }
            (Some(a), Some(b)) => {
                result.push_str(&format!("-{}\n", a));
                result.push_str(&format!("+{}\n", b));
            }
            (Some(a), None) => {
                result.push_str(&format!("-{}\n", a));
            }
            (None, Some(b)) => {
                result.push_str(&format!("+{}\n", b));
            }
            (None, None) => {}
        }
    }

    result
}
```

- [ ] **Step 3: Implement execute_restore command**

In `src-tauri/src/commands.rs`, add:

```rust
#[tauri::command]
pub fn execute_restore(tool_id: String, backup_path: String) -> Result<Vec<String>, String> {
    let tool = parse_tool(&tool_id)?;
    let current_dir = resolve_skills_dir(&tool);
    let backup_dir = std::path::PathBuf::from(&backup_path);

    if !backup_dir.exists() {
        return Err(format!("Backup directory does not exist: {}", backup_path));
    }

    let preview = preview_restore(tool_id.clone(), backup_path)?;

    let mut actions = Vec::new();

    // Delete skills that are not in backup
    for name in &preview.deleted {
        let skill_dir = current_dir.join(name);
        if skill_dir.exists() {
            std::fs::remove_dir_all(&skill_dir)
                .map_err(|e| format!("Failed to delete {}: {}", name, e))?;
            actions.push(format!("deleted: {}", name));
        }
    }

    // Add new skills from backup and update changed skills
    for name in preview.added.iter().chain(preview.changed.iter().map(|d| &d.name)) {
        let src = backup_dir.join(name);
        let dst = current_dir.join(name);
        crate::sync::copy_dir_recursive(&src, &dst);
        if preview.added.contains(name) {
            actions.push(format!("added: {}", name));
        } else {
            actions.push(format!("updated: {}", name));
        }
    }

    Ok(actions)
}
```

- [ ] **Step 4: Register new commands in lib.rs**

Add `commands::preview_restore` and `commands::execute_restore` to the `generate_handler![]` macro.

- [ ] **Step 5: Add TypeScript types for BackupDiff**

In `src/types.ts`, add:

```typescript
export interface SkillDiff {
  name: string;
  status: string;
  diff: string;
}

export interface BackupDiff {
  backupPath: string;
  added: string[];
  deleted: string[];
  changed: SkillDiff[];
}
```

- [ ] **Step 6: Verify Rust builds**

Run: `cd src-tauri && cargo build`
Expected: Compiles successfully

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/types.ts
git commit -m "feat: add preview_restore and execute_restore commands with diff"
```

---

### Task 4: Add TabToolbar component

**Files:**
- Create: `src/components/TabToolbar.tsx`

- [ ] **Step 1: Create TabToolbar component**

Create `src/components/TabToolbar.tsx`:

```typescript
import { useState, useRef } from "react";
import type { ToolId } from "../types";

interface Props {
  toolId: ToolId;
  customDir: string;
  defaultDir: string;
  onSaveDir: (toolId: string, path: string) => Promise<void>;
  onBackup: (toolId: string) => Promise<string>;
  onOpenRestore: (toolId: string) => void;
  onRefresh: () => void;
}

export function TabToolbar({
  toolId,
  customDir,
  defaultDir,
  onSaveDir,
  onBackup,
  onOpenRestore,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [dirValue, setDirValue] = useState(customDir || defaultDir);
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayDir = customDir || defaultDir;

  const handleSaveDir = async () => {
    await onSaveDir(toolId, dirValue === defaultDir ? "" : dirValue);
    setEditing(false);
    onRefresh();
  };

  const handleBackup = async () => {
    setBacking(true);
    setBackupResult(null);
    try {
      const path = await onBackup(toolId);
      setBackupResult(path);
    } catch (e) {
      setBackupResult(`Error: ${e}`);
    } finally {
      setBacking(false);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3 text-sm">
        {/* Skills directory */}
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={dirValue}
              onChange={(e) => setDirValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              onKeyDown={(e) => e.key === "Enter" && handleSaveDir()}
            />
            <button
              onClick={handleSaveDir}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setDirValue(customDir || defaultDir); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-gray-400 text-xs shrink-0">Dir:</span>
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={displayDir}>
              {displayDir}
            </span>
            <button
              onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="text-xs text-blue-500 hover:text-blue-600 shrink-0"
            >
              Edit
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackup}
            disabled={backing}
            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {backing ? "Backing up..." : "Backup"}
          </button>
          <button
            onClick={() => onOpenRestore(toolId)}
            className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Restore
          </button>
        </div>
      </div>

      {/* Backup result */}
      {backupResult && (
        <div className={`mt-1 text-xs ${backupResult.startsWith("Error") ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
          {backupResult.startsWith("Error") ? backupResult : `Backup saved: ${backupResult}`}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `npm run build`
Expected: tsc + vite succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/TabToolbar.tsx
git commit -m "feat: add TabToolbar with dir edit, backup, restore buttons"
```

---

### Task 5: Add RestoreDialog component

**Files:**
- Create: `src/components/RestoreDialog.tsx`

- [ ] **Step 1: Create RestoreDialog component**

Create `src/components/RestoreDialog.tsx`:

```typescript
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupDiff, ToolId } from "../types";

interface Props {
  toolId: ToolId;
  backupPath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreDialog({ toolId, backupPath, onConfirm, onCancel }: Props) {
  const [diff, setDiff] = useState<BackupDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setLoading(true);
    invoke<BackupDiff>("preview_restore", { toolId, backupPath })
      .then(setDiff)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [toolId, backupPath]);

  const handleConfirm = async () => {
    setRestoring(true);
    try {
      await invoke("execute_restore", { toolId, backupPath });
      onConfirm();
    } catch (e) {
      setError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const hasChanges = diff && (diff.added.length > 0 || diff.deleted.length > 0 || diff.changed.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Confirm Restore
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            From: {backupPath}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400">Analyzing differences...</div>
          ) : error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : !hasChanges ? (
            <div className="text-center text-gray-400">No differences found.</div>
          ) : (
            <div className="space-y-4">
              {/* Added */}
              {diff!.added.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                    Will be added ({diff!.added.length})
                  </h3>
                  <ul className="space-y-1">
                    {diff!.added.map((name) => (
                      <li key={name} className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <span className="text-green-500">+</span> {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deleted */}
              {diff!.deleted.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    Will be deleted ({diff!.deleted.length})
                  </h3>
                  <ul className="space-y-1">
                    {diff!.deleted.map((name) => (
                      <li key={name} className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                        <span className="text-red-500">-</span> {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changed */}
              {diff!.changed.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                    Will be updated ({diff!.changed.length})
                  </h3>
                  <div className="space-y-3">
                    {diff!.changed.map((skill) => (
                      <details key={skill.name} className="border border-gray-200 dark:border-gray-700 rounded">
                        <summary className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                          {skill.name}
                        </summary>
                        <pre className="px-3 py-2 text-xs font-mono overflow-auto bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                          {skill.diff.split("\n").map((line, i) => (
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
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={restoring || loading || !hasChanges}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {restoring ? "Restoring..." : "Confirm Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `npm run build`
Expected: tsc + vite succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/RestoreDialog.tsx
git commit -m "feat: add RestoreDialog with diff preview and confirmation"
```

---

### Task 6: Wire toolbar and restore dialog into App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add Tauri dialog plugin dependency**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-dialog = "2"
```

In `src-tauri/src/lib.rs`, add `.plugin(tauri_plugin_dialog::init())` before `.invoke_handler(...)`.

- [ ] **Step 2: Update App.tsx with TabToolbar and RestoreDialog**

Replace `src/App.tsx` with:

```typescript
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { TOOLS } from "./types";
import type { Skill, ToolId } from "./types";
import { useSkills, useConfig, useSync } from "./hooks/useSkills";
import { TabNav } from "./components/TabNav";
import { TabToolbar } from "./components/TabToolbar";
import { SkillList } from "./components/SkillList";
import { SkillDetail } from "./components/SkillDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import { RestoreDialog } from "./components/RestoreDialog";

function App() {
  const [activeTab, setActiveTab] = useState<ToolId>("claude-code");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const { skills, loading, error, refresh } = useSkills(activeTab);
  const { config, save, saveCustomDir } = useConfig();
  const { syncing, syncResult, syncError, sync } = useSync();
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [restoreTarget, setRestoreTarget] = useState<{ toolId: ToolId; backupPath: string } | null>(null);

  const toggleDark = () => {
    setDark((d) => !d);
    document.documentElement.classList.toggle("dark");
  };

  const handleSync = useCallback(async () => {
    await sync();
    refresh();
  }, [sync, refresh]);

  const handleOpenDir = useCallback(async (toolId: ToolId) => {
    await invoke("open_skills_dir", { toolId });
  }, []);

  const handleTabChange = useCallback((id: ToolId) => {
    setActiveTab(id);
    setSelectedSkill(null);
  }, []);

  const handleBackup = useCallback(async (toolId: string) => {
    return await invoke<string>("backup_skills", { toolId });
  }, []);

  const handleOpenRestore = useCallback(async (toolId: string) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setRestoreTarget({ toolId: toolId as ToolId, backupPath: selected });
    }
  }, []);

  const handleRestoreConfirm = useCallback(() => {
    setRestoreTarget(null);
    refresh();
  }, [refresh]);

  const currentCustomDir = config?.customSkillsDirs?.[activeTab] ?? "";
  const currentTool = TOOLS.find((t) => t.id === activeTab);
  const defaultDir = currentTool ? getDefaultDir(activeTab) : "";

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">SkillsSync</h1>
          <p className="text-xs text-gray-400">Manage AI CLI skills from one place</p>
        </div>
        <button onClick={toggleDark} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      <SettingsPanel
        config={config}
        onSave={save}
        onSync={handleSync}
        syncing={syncing}
        syncResult={syncResult}
        syncError={syncError}
      />

      <TabNav tools={TOOLS} active={activeTab} onSelect={handleTabChange} />

      <main className="flex-1 overflow-auto">
        {selectedSkill ? (
          <SkillDetail skill={selectedSkill} onBack={() => setSelectedSkill(null)} />
        ) : (
          <>
            <TabToolbar
              toolId={activeTab}
              customDir={currentCustomDir}
              defaultDir={defaultDir}
              onSaveDir={saveCustomDir}
              onBackup={handleBackup}
              onOpenRestore={handleOpenRestore}
              onRefresh={refresh}
            />
            <SkillList
              skills={skills}
              loading={loading}
              error={error}
              toolId={activeTab}
              onSelect={setSelectedSkill}
              onOpenDir={handleOpenDir}
            />
          </>
        )}
      </main>

      {restoreTarget && (
        <RestoreDialog
          toolId={restoreTarget.toolId}
          backupPath={restoreTarget.backupPath}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}

function getDefaultDir(toolId: ToolId): string {
  const home = "";  // resolved by backend
  const defaults: Record<ToolId, string> = {
    "claude-code": "~/.claude/skills",
    "opencode": "~/.config/opencode/skills",
    "codex": "~/.agents/skills",
    "hermes": "~/.hermes/skills",
  };
  return defaults[toolId] ?? "";
}

export default App;
```

- [ ] **Step 3: Install Tauri dialog plugin npm package**

Run: `npm install @tauri-apps/plugin-dialog`

- [ ] **Step 4: Configure dialog plugin permissions**

In `src-tauri/capabilities/default.json`, add `"dialog:allow-open"` to the permissions array.

- [ ] **Step 5: Verify full build**

Run: `cd src-tauri && cargo build` and `npm run build`
Expected: Both succeed

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json package-lock.json
git commit -m "feat: wire TabToolbar and RestoreDialog into App with dialog plugin"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Create test skills**

```bash
mkdir -p ~/.hermes/skills/skill-a ~/.hermes/skills/skill-b
cat > ~/.hermes/skills/skill-a/SKILL.md << 'EOF'
---
name: skill-a
description: First test skill
---
Content of skill A
EOF
cat > ~/.hermes/skills/skill-b/SKILL.md << 'EOF'
---
name: skill-b
description: Second test skill
---
Content of skill B
EOF
```

- [ ] **Step 2: Run the app**

Run: `cd src-tauri && cargo tauri dev`

Verify:
1. Hermes tab shows 2 skills
2. TabToolbar shows the directory path
3. Clicking "Edit" allows changing the path
4. Clicking "Backup" creates a `skills-YYYYMMDD-HHMMSS` directory
5. Modifying a skill, then clicking "Restore" and selecting the backup shows the diff
6. Confirming restore reverts the change

- [ ] **Step 3: Clean up**

```bash
rm -rf ~/.hermes/skills/skill-a ~/.hermes/skills/skill-b
# Also remove any backup directories created during testing
```
