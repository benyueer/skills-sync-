# Edit→OpenDir, Git Status Colors, Diff Viewer Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three features: (1) Replace Edit dropdown with Open Dir button in skill detail, (2) Show git change status with colored backgrounds on repo skills list, (3) Replace naive diff with `react-diff-viewer-continued` library supporting inline/split views.

**Architecture:** Feature 1 is a pure frontend change to SkillDetail. Feature 2 adds a Rust command to parse git status and maps changes to skills on the frontend. Feature 3 installs a diff viewer library and adds a new Rust command returning structured old/new content per file.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tauri v2 (Rust), `react-diff-viewer-continued`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/components/SkillDetail.tsx` | Modify | Replace Edit dropdown with Open Dir button |
| `src/components/RepoPage.tsx` | Modify | Fetch git status, pass change info to skill list |
| `src/components/SkillCard.tsx` | Modify | Add `gitChange` prop for colored background |
| `src/components/SkillList.tsx` | Modify | Pass git change status to SkillCard |
| `src/components/DiffViewer.tsx` | Create | Wrapper around react-diff-viewer-continued with inline/split toggle |
| `src/types.ts` | Modify | Add `GitChangeMap` type |
| `src-tauri/src/sync.rs` | Modify | Add `get_file_content_at_path` helper |
| `src-tauri/src/commands.rs` | Modify | Add `get_skill_diff_content` command |
| `src-tauri/src/lib.rs` | Modify | Register new command |
| `package.json` | Modify | Add `react-diff-viewer-continued` dependency |

---

### Task 1: Replace Edit Dropdown with Open Dir Button

**Files:**
- Modify: `src/components/SkillDetail.tsx:15-19,51-52,136-172,213-235`

- [ ] **Step 1: Replace Edit button and dropdown with Open Dir button**

In `src/components/SkillDetail.tsx`, remove the EDITORS constant (lines 15-19), `menuOpen` state (line 51), `menuRef` (line 52), the click-outside useEffect (lines 136-145), and the `handleOpenWith` function (lines 147-172).

Replace the entire editor dropdown block (lines 213-235) with a single "Open Dir" button:

```tsx
<button
  onClick={async () => {
    try {
      if (syncStatus === "repo-only") {
        await invoke("open_repo_dir");
      } else {
        await invoke("reveal_path", { path: skill.path });
      }
    } catch (e) {
      alert(`Failed to open directory: ${e}`);
    }
  }}
  className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
>
  Open Dir
</button>
```

Remove the `import { open } from "@tauri-apps/plugin-dialog"` since it's no longer needed (check if used elsewhere first — it is NOT used elsewhere in this file).

The final header button area (lines 200-236) should look like:

```tsx
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
  <button
    onClick={async () => {
      try {
        if (syncStatus === "repo-only") {
          await invoke("open_repo_dir");
        } else {
          await invoke("reveal_path", { path: skill.path });
        }
      } catch (e) {
        alert(`Failed to open directory: ${e}`);
      }
    }}
    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
  >
    Open Dir
  </button>
</div>
```

- [ ] **Step 2: Verify the change compiles**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx
git commit -m "feat: replace edit dropdown with open dir button in skill detail"
```

---

### Task 2: Add Git Status to Repo Skills List

**Files:**
- Modify: `src-tauri/src/commands.rs` — add `get_repo_git_changes` command
- Modify: `src-tauri/src/lib.rs` — register command
- Modify: `src/types.ts` — add `GitChangeMap` type
- Modify: `src/components/RepoPage.tsx` — fetch and pass git changes
- Modify: `src/components/SkillCard.tsx` — add `gitChange` prop
- Modify: `src/components/SkillList.tsx` — pass git changes to SkillCard

- [ ] **Step 1: Add `get_repo_git_changes` Rust command**

In `src-tauri/src/commands.rs`, add a new command that runs `git status --short` and parses the output into a map of relative path → change type:

```rust
#[tauri::command]
pub fn get_repo_git_changes() -> Result<HashMap<String, String>, String> {
    let cfg = config::load();
    if cfg.repo_local_path.is_empty() {
        return Ok(HashMap::new());
    }
    let repo_dir = std::path::PathBuf::from(&cfg.repo_local_path);
    let output = sync::git_status(&repo_dir)?;

    let mut changes: HashMap<String, String> = HashMap::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // git status --short format: XY filename (or XY -> filename for renames)
        let (status, path) = if line.len() >= 3 {
            let xy = &line[..2];
            let rest = line[3..].trim();
            // Handle renames: "old -> new"
            let path = if let Some(arrow) = rest.find(" -> ") {
                &rest[arrow + 4..]
            } else {
                rest
            };
            let change_type = match xy.trim() {
                "M" | "MM" | "AM" => "modified",
                "A" | "AM" => "added",
                "D" => "deleted",
                "??" => "untracked",
                "R" => "renamed",
                _ => "other",
            };
            (change_type.to_string(), path.to_string())
        } else {
            continue;
        };
        changes.insert(path, status);
    }

    Ok(changes)
}
```

- [ ] **Step 2: Register the command in lib.rs**

In `src-tauri/src/lib.rs`, add `commands::get_repo_git_changes` to the `generate_handler![]` list (after `commands::restore_skill_from_repo`).

- [ ] **Step 3: Add TypeScript type**

In `src/types.ts`, add:

```typescript
export type GitChangeType = "modified" | "added" | "deleted" | "untracked" | "renamed" | "other";
export type GitChangeMap = Record<string, GitChangeType>;
```

- [ ] **Step 4: Fetch git changes in RepoPage**

In `src/components/RepoPage.tsx`, add state and fetch logic for git changes:

Add import: `import type { ..., GitChangeMap } from "../types";`

Add state:
```tsx
const [gitChanges, setGitChanges] = useState<GitChangeMap>({});
```

Add a function to fetch git changes:
```tsx
const fetchGitChanges = useCallback(async () => {
  try {
    const changes = await invoke<GitChangeMap>("get_repo_git_changes");
    setGitChanges(changes);
  } catch {
    // silently ignore — git status is best-effort
  }
}, []);
```

Call `fetchGitChanges()` after `refresh()` in `handlePull` and `handleSyncToTools`. Also call it in a `useEffect` when `config?.repoLocalPath` changes:

```tsx
useEffect(() => {
  if (config?.repoLocalPath) {
    fetchGitChanges();
  }
}, [config?.repoLocalPath, fetchGitChanges]);
```

Pass `gitChanges` to the `SkillList` component (note: RepoPage currently renders `SkillCard` directly, not `SkillList` — we need to update the rendering at lines 204-212):

Replace the skill rendering section (lines 204-212) to pass git change info:

```tsx
<div className="grid gap-2">
  {skills.map((skill) => {
    // Find git change for this skill by matching path prefix
    const skillDirName = skill.path.split(/[/\\]/).pop() ?? "";
    const changeType = Object.entries(gitChanges).find(([filePath]) =>
      filePath.startsWith(skillDirName + "/") || filePath === skillDirName
    )?.[1];
    return (
      <SkillCard
        key={skill.name}
        skill={skill}
        onClick={() => onSelectSkill(skill)}
        gitChange={changeType}
      />
    );
  })}
</div>
```

- [ ] **Step 5: Add gitChange prop to SkillCard**

In `src/components/SkillCard.tsx`, add the prop and styling:

Add to Props interface:
```typescript
gitChange?: string;
```

Add a style map (after the existing STATUS_STYLES):
```typescript
const GIT_CHANGE_STYLES: Record<string, string> = {
  modified: "border-l-4 border-l-amber-400 dark:border-l-amber-500",
  added: "border-l-4 border-l-emerald-400 dark:border-l-emerald-500",
  deleted: "border-l-4 border-l-red-400 dark:border-l-red-500",
  untracked: "border-l-4 border-l-blue-400 dark:border-l-blue-500",
  renamed: "border-l-4 border-l-purple-400 dark:border-l-purple-500",
};
```

Add a label map:
```typescript
const GIT_CHANGE_LABELS: Record<string, string> = {
  modified: "modified",
  added: "new",
  deleted: "deleted",
  untracked: "untracked",
  renamed: "renamed",
};
```

Update the component to destructure `gitChange` and apply the style:

```tsx
const { skill, onClick, syncStatus, gitChange } = props;
```

In the outer `<div>` className (line 99), append the git change style:

```tsx
<div className={`rounded-lg border transition-colors ${statusStyle} ${gitChange ? GIT_CHANGE_STYLES[gitChange] ?? "" : ""}`}>
```

Add a git change badge next to the existing sync status badge (after line 113):

```tsx
{gitChange && (
  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
    {GIT_CHANGE_LABELS[gitChange] ?? gitChange}
  </span>
)}
```

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/types.ts src/components/RepoPage.tsx src/components/SkillCard.tsx
git commit -m "feat: show git change status with colored borders on repo skills list"
```

---

### Task 3: Install Diff Viewer Library

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-diff-viewer-continued**

```bash
cd /Users/mac/Desktop/pro/skills-sync-
npm install react-diff-viewer-continued
```

- [ ] **Step 2: Verify installation**

Check that `react-diff-viewer-continued` appears in `package.json` dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-diff-viewer-continued for diff rendering"
```

---

### Task 4: Add Structured Diff Content Command

**Files:**
- Modify: `src-tauri/src/sync.rs` — add `compute_skill_diff_content` function
- Modify: `src-tauri/src/commands.rs` — add `get_skill_diff_content` command
- Modify: `src-tauri/src/lib.rs` — register command
- Modify: `src/types.ts` — add `FileDiff` type

- [ ] **Step 1: Add `compute_skill_diff_content` to sync.rs**

Add after the existing `compute_skill_diff` function (after line 263):

```rust
/// Compute structured diff content (old/new) for each file in a skill.
/// Returns a map of relative_file_path -> (old_content, new_content).
/// Either may be None if the file only exists in one side.
pub fn compute_skill_diff_content(
    agent_skill_dir: &std::path::Path,
    repo_skill_dir: &std::path::Path,
) -> std::collections::HashMap<String, (Option<String>, Option<String>)> {
    let agent_files = collect_skill_files(agent_skill_dir);
    let repo_files = collect_skill_files(repo_skill_dir);

    let mut all_files: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_files.extend(agent_files.keys().cloned());
    all_files.extend(repo_files.keys().cloned());

    let mut diffs = std::collections::HashMap::new();

    for file in all_files {
        let agent_content = agent_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());
        let repo_content = repo_files.get(&file).map(|b| String::from_utf8_lossy(b).to_string());

        // Skip identical files
        if agent_content == repo_content {
            continue;
        }

        diffs.insert(file, (agent_content, repo_content));
    }

    diffs
}
```

- [ ] **Step 2: Add `FileDiff` struct and `get_skill_diff_content` command**

In `src-tauri/src/commands.rs`, add a struct and command:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub file: String,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
}

#[tauri::command]
pub fn get_skill_diff_content(tool_id: String, skill_name: String, repo_path: String) -> Result<Vec<FileDiff>, String> {
    let tool = parse_tool(&tool_id)?;
    let agent_skill_dir = resolve_skills_dir(&tool).join(&skill_name);
    let repo_skill_dir = std::path::PathBuf::from(&repo_path);

    if !agent_skill_dir.exists() {
        return Err(format!("Agent skill directory not found: {}", agent_skill_dir.display()));
    }
    if !repo_skill_dir.exists() {
        return Err(format!("Repo skill directory not found: {}", repo_skill_dir.display()));
    }

    let diffs = sync::compute_skill_diff_content(&agent_skill_dir, &repo_skill_dir);
    let mut result: Vec<FileDiff> = diffs
        .into_iter()
        .map(|(file, (old_content, new_content))| FileDiff {
            file,
            old_content,
            new_content,
        })
        .collect();
    result.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(result)
}
```

- [ ] **Step 3: Register command in lib.rs**

Add `commands::get_skill_diff_content` to the `generate_handler![]` list.

- [ ] **Step 4: Add TypeScript types**

In `src/types.ts`, add:

```typescript
export interface FileDiff {
  file: string;
  oldContent: string | null;
  newContent: string | null;
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit && cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/sync.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/types.ts
git commit -m "feat: add get_skill_diff_content command for structured diff data"
```

---

### Task 5: Create DiffViewer Component with Inline/Split Toggle

**Files:**
- Create: `src/components/DiffViewer.tsx`

- [ ] **Step 1: Create DiffViewer component**

Create `src/components/DiffViewer.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/DiffViewer.tsx
git commit -m "feat: create DiffViewer component with inline/split view toggle"
```

---

### Task 6: Integrate DiffViewer into SkillDetail

**Files:**
- Modify: `src/components/SkillDetail.tsx`

- [ ] **Step 1: Replace naive diff rendering with DiffViewer**

In `src/components/SkillDetail.tsx`:

Add imports:
```tsx
import { DiffViewer } from "./DiffViewer";
import type { FileDiff } from "../types";
```

Replace the diff state variables (lines 55-57):
```tsx
const [showDiff, setShowDiff] = useState(false);
const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
const [diffLoading, setDiffLoading] = useState(false);
```

Replace the diff loading useEffect (lines 112-134) with:
```tsx
useEffect(() => {
  if (!showDiff || !repoPath) {
    setDiffFiles([]);
    return;
  }
  setDiffLoading(true);
  invoke<FileDiff[]>("get_skill_diff_content", {
    toolId: skill.toolId,
    skillName: skill.name,
    repoPath,
  })
    .then(setDiffFiles)
    .catch((e) => {
      console.error("Failed to load diff:", e);
      setDiffFiles([]);
    })
    .finally(() => setDiffLoading(false));
}, [showDiff, repoPath, skill.name, skill.toolId]);
```

Replace the diff rendering section (lines 251-273) with:
```tsx
) : showDiff && syncStatus === "different" ? (
  <div>
    {diffLoading ? (
      <div className="text-gray-400 text-sm">Computing diff...</div>
    ) : (
      <DiffViewer files={diffFiles} />
    )}
  </div>
)
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx
git commit -m "feat: integrate DiffViewer with inline/split toggle in skill detail"
```

---

### Task 7: Build and Test

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 2: Run Rust check**

```bash
cd /Users/mac/Desktop/pro/skills-sync-/src-tauri && cargo check
```
Expected: No errors

- [ ] **Step 3: Build the app**

```bash
cd /Users/mac/Desktop/pro/skills-sync- && npm run build
```
Expected: Successful build

- [ ] **Step 4: Manual test**

Run the app and verify:
1. Skill detail shows "Open Dir" button instead of "Edit" dropdown
2. Clicking "Open Dir" opens the skill directory in file explorer
3. Repo page skills list shows colored left borders for git-changed skills
4. Skills with git changes show a badge (modified/new/deleted/untracked)
5. Clicking "Show Diff" on a modified skill shows the diff viewer
6. Split/Inline toggle switches the diff view mode
7. Dark mode renders correctly in the diff viewer

- [ ] **Step 5: Final commit if any fixes needed**
