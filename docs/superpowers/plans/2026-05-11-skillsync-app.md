# SkillsSync App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri v2 desktop app that manages AI CLI tool skills (Claude Code, OpenCode, Codex) from a unified UI, with git-based skill sync.

**Architecture:** Tauri v2 with React+TypeScript frontend and Rust backend. Rust handles all file I/O, git operations, and SKILL.md parsing. Frontend displays a tabbed UI (one tab per tool) showing each tool's discovered skills, with a settings panel for git repo configuration. Tools are defined as a Rust enum with associated paths, making it trivial to add new tools later.

**Tech Stack:** Tauri 2, React 19, TypeScript 5, Vite, Tailwind CSS 4, Rust, serde_yaml, git2

---

## File Structure

```
skills-sync/
├── src/                              # React frontend
│   ├── App.tsx                       # Root layout with tab nav + content area
│   ├── main.tsx                      # React entry point
│   ├── index.css                     # Tailwind imports
│   ├── components/
│   │   ├── TabNav.tsx                # Tool tab navigation bar
│   │   ├── SkillList.tsx             # List of skills for selected tool
│   │   ├── SkillCard.tsx             # Single skill card (name + description)
│   │   ├── SkillDetail.tsx           # Expanded skill detail with SKILL.md preview
│   │   ├── SettingsPanel.tsx         # Git repo URL config + sync button
│   │   └── EmptyState.tsx            # "No skills found" placeholder
│   ├── hooks/
│   │   └── useSkills.ts              # Hook wrapping Tauri invoke calls
│   └── types.ts                      # Shared TypeScript types
│
├── src-tauri/                        # Rust backend
│   ├── src/
│   │   ├── main.rs                   # Rust entry point (calls lib::run())
│   │   ├── lib.rs                    # Tauri builder, plugin registration, command handler
│   │   ├── commands.rs               # All #[tauri::command] functions
│   │   ├── config.rs                 # App config: load/save settings.json
│   │   ├── skill.rs                  # Skill struct, SKILL.md frontmatter parsing
│   │   ├── tools.rs                  # Tool enum with platform-specific paths
│   │   └── sync.rs                   # Git clone/pull + copy to tool dirs
│   ├── Cargo.toml                    # Rust dependencies
│   ├── tauri.conf.json               # Tauri config
│   ├── capabilities/
│   │   └── default.json              # Permissions
│   └── icons/                        # App icons
│
├── index.html                        # Vite HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

### Task 1: Scaffold Tauri v2 Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Create the project with Tauri CLI**

```bash
cd E:/projects/skills-sync
npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```

If prompted for app name use `skills-sync`, identifier `com.skillssync.app`.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind in vite.config.ts**

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
```

- [ ] **Step 4: Replace src/index.css with Tailwind imports**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run tauri dev
```

Expected: A blank Tauri window opens. Close it after verifying.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 project with React+TS+Tailwind"
```

---

### Task 2: Define Rust Tool Enum and Paths

**Files:**
- Create: `src-tauri/src/tools.rs`
- Modify: `src-tauri/src/lib.rs`

This module defines each supported AI tool and its skills directory path per platform. Adding a new tool = adding one enum variant.

- [ ] **Step 1: Create tools.rs**

```rust
// src-tauri/src/tools.rs
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Tool {
    ClaudeCode,
    OpenCode,
    Codex,
}

impl Tool {
    pub fn all() -> &'static [Tool] {
        &[Tool::ClaudeCode, Tool::OpenCode, Tool::Codex]
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Tool::ClaudeCode => "Claude Code",
            Tool::OpenCode => "OpenCode",
            Tool::Codex => "Codex",
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Tool::ClaudeCode => "claude-code",
            Tool::OpenCode => "opencode",
            Tool::Codex => "codex",
        }
    }

    /// Global skills directory for this tool on the current platform.
    pub fn skills_dir(&self) -> PathBuf {
        let home = dirs::home_dir().expect("Cannot determine home directory");
        match self {
            Tool::ClaudeCode => home.join(".claude").join("skills"),
            #[cfg(target_os = "windows")]
            Tool::OpenCode => {
                let appdata = std::env::var("APPDATA").expect("APPDATA not set");
                PathBuf::from(appdata).join("opencode").join("skills")
            }
            #[cfg(not(target_os = "windows"))]
            Tool::OpenCode => home.join(".config").join("opencode").join("skills"),
            Tool::Codex => home.join(".agents").join("skills"),
        }
    }
}
```

- [ ] **Step 2: Add dependencies to Cargo.toml**

Add under `[dependencies]` in `src-tauri/Cargo.toml`:

```toml
dirs = "6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
thiserror = "2"
```

- [ ] **Step 3: Register module in lib.rs**

```rust
// src-tauri/src/lib.rs
mod commands;
mod config;
mod skill;
mod sync;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_skills,
            commands::get_config,
            commands::save_config,
            commands::sync_from_git,
            commands::open_skills_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/tools.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add Tool enum with platform-specific skill paths"
```

---

### Task 3: Implement SKILL.md Parser

**Files:**
- Create: `src-tauri/src/skill.rs`

Parses a SKILL.md file to extract frontmatter (name, description) and body content.

- [ ] **Step 1: Create skill.rs**

```rust
// src-tauri/src/skill.rs
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: PathBuf,
    pub tool_id: String,
    pub has_scripts: bool,
    pub has_references: bool,
}

#[derive(Debug, serde::Deserialize)]
struct Frontmatter {
    name: Option<String>,
    description: Option<String>,
}

/// Parse a SKILL.md file into a Skill struct.
pub fn parse_skill(skill_dir: &Path, tool_id: &str) -> Option<Skill> {
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&skill_md).ok()?;
    let (frontmatter, _body) = extract_frontmatter(&content)?;

    let fm: Frontmatter = serde_yaml::from_str(&frontmatter).ok()?;
    let name = fm.name.unwrap_or_else(|| {
        skill_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });

    Some(Skill {
        name,
        description: fm.description.unwrap_or_default(),
        path: skill_dir.to_path_buf(),
        tool_id: tool_id.to_string(),
        has_scripts: skill_dir.join("scripts").exists(),
        has_references: skill_dir.join("references").exists(),
    })
}

/// Extract YAML frontmatter and body from markdown content.
fn extract_frontmatter(content: &str) -> Option<(String, String)> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let after_first = &content[3..];
    let end = after_first.find("---")?;
    let frontmatter = after_first[..end].trim().to_string();
    let body = after_first[end + 3..].trim().to_string();
    Some((frontmatter, body))
}

/// Discover all skills in a directory.
pub fn discover_skills(skills_dir: &Path, tool_id: &str) -> Vec<Skill> {
    if !skills_dir.exists() {
        return Vec::new();
    }

    let mut skills = Vec::new();
    if let Ok(entries) = std::fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(skill) = parse_skill(&path, tool_id) {
                    skills.push(skill);
                }
            }
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/skill.rs
git commit -m "feat: implement SKILL.md parser and skill discovery"
```

---

### Task 4: Implement Config Module

**Files:**
- Create: `src-tauri/src/config.rs`

Stores app settings (git repo URL, last sync time) in a JSON file in the app's config directory.

- [ ] **Step 1: Create config.rs**

```rust
// src-tauri/src/config.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub git_repo_url: String,
    pub last_sync: Option<String>,
    /// Local clone path (auto-managed)
    #[serde(default)]
    pub repo_local_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            git_repo_url: String::new(),
            last_sync: None,
            repo_local_path: String::new(),
        }
    }
}

fn config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .expect("Cannot determine config directory")
        .join("skills-sync");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

pub fn load() -> AppConfig {
    let path = config_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

pub fn save(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add config module for app settings persistence"
```

---

### Task 5: Implement Git Sync Module

**Files:**
- Create: `src-tauri/src/sync.rs`

Clones or updates a git repo, then copies skills to each tool's directory.

- [ ] **Step 1: Create sync.rs**

```rust
// src-tauri/src/sync.rs
use crate::tools::Tool;
use std::path::{Path, PathBuf};

/// Clone or pull the git repo. Returns the local path.
pub fn ensure_repo(git_url: &str) -> Result<PathBuf, String> {
    let repo_dir = repo_local_path(git_url);

    if repo_dir.join(".git").exists() {
        // Pull existing repo
        run_git(&repo_dir, &["pull", "--ff-only"])?;
    } else {
        // Clone fresh
        if repo_dir.exists() {
            std::fs::remove_dir_all(&repo_dir).map_err(|e| e.to_string())?;
        }
        let parent = repo_dir.parent().ok_or("Invalid repo path")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        run_git(parent, &["clone", git_url, &repo_dir.to_string_lossy()])?;
    }

    Ok(repo_dir)
}

/// Sync skills from repo to each tool's skills directory.
pub fn sync_skills(repo_dir: &Path, tools: &[Tool]) -> Result<Vec<String>, String> {
    let mut synced = Vec::new();

    // Find all skill directories in the repo (look for SKILL.md files)
    let skill_dirs = find_skill_dirs(repo_dir);

    for tool in tools {
        let target_dir = tool.skills_dir();
        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

        for skill_dir in &skill_dirs {
            let skill_name = skill_dir
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let target = target_dir.join(&skill_name);

            // Copy skill directory to target
            copy_dir_recursive(skill_dir, &target)?;
            synced.push(format!("{}/{}", tool.id(), skill_name));
        }
    }

    Ok(synced)
}

/// Find directories containing SKILL.md in the repo.
fn find_skill_dirs(repo_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    find_skill_dirs_recursive(repo_dir, &mut dirs, 0);
    dirs
}

fn find_skill_dirs_recursive(dir: &Path, results: &mut Vec<PathBuf>, depth: u32) {
    if depth > 5 {
        return; // prevent infinite recursion
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if path.join("SKILL.md").exists() {
                    results.push(path);
                } else {
                    find_skill_dirs_recursive(&path, results, depth + 1);
                }
            }
        }
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if dst.exists() {
        std::fs::remove_dir_all(dst).map_err(|e| format!("rm {}: {}", dst.display(), e))?;
    }
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in walkdir::WalkDir::new(src) {
        let entry = entry.map_err(|e| e.to_string())?;
        let rel = entry.path().strip_prefix(src).unwrap();
        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            std::fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn repo_local_path(git_url: &str) -> PathBuf {
    let data_dir = dirs::data_dir()
        .expect("Cannot determine data directory")
        .join("skills-sync")
        .join("repos");
    // Use a hash of the URL as the directory name
    let hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        git_url.hash(&mut h);
        format!("{:x}", h.finish())
    };
    data_dir.join(hash)
}

fn run_git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new("git");
    cmd.current_dir(dir).args(args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("git error: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

- [ ] **Step 2: Add walkdir dependency**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
walkdir = "2"
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync.rs src-tauri/Cargo.toml
git commit -m "feat: implement git sync module with recursive skill copy"
```

---

### Task 6: Implement Tauri Commands

**Files:**
- Create: `src-tauri/src/commands.rs`

Bridges frontend invoke calls to Rust backend logic.

- [ ] **Step 1: Create commands.rs**

```rust
// src-tauri/src/commands.rs
use crate::{config, skill::Skill, sync, tools::Tool};

#[tauri::command]
pub fn get_skills(tool_id: String) -> Result<Vec<Skill>, String> {
    let tool = parse_tool(&tool_id)?;
    Ok(skill::discover_skills(&tool.skills_dir(), tool.id()))
}

#[tauri::command]
pub fn get_config() -> Result<config::AppConfig, String> {
    Ok(config::load())
}

#[tauri::command]
pub fn save_config(git_repo_url: String) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.git_repo_url = git_repo_url;
    config::save(&cfg)
}

#[tauri::command]
pub async fn sync_from_git() -> Result<Vec<String>, String> {
    let cfg = config::load();
    if cfg.git_repo_url.is_empty() {
        return Err("Git repo URL is not configured".to_string());
    }

    let repo_dir = sync::ensure_repo(&cfg.git_repo_url)?;
    let tools: Vec<Tool> = Tool::all().to_vec();
    let synced = sync::sync_skills(&repo_dir, &tools)?;

    // Update last sync time
    let mut cfg = config::load();
    cfg.last_sync = Some(
        chrono::Utc::now()
            .format("%Y-%m-%d %H:%M:%S UTC")
            .to_string(),
    );
    cfg.repo_local_path = repo_dir.to_string_lossy().to_string();
    config::save(&cfg)?;

    Ok(synced)
}

#[tauri::command]
pub fn open_skills_dir(tool_id: String) -> Result<(), String> {
    let tool = parse_tool(&tool_id)?;
    let dir = tool.skills_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    opener::open(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_tool(tool_id: &str) -> Result<Tool, String> {
    match tool_id {
        "claude-code" => Ok(Tool::ClaudeCode),
        "opencode" => Ok(Tool::OpenCode),
        "codex" => Ok(Tool::Codex),
        _ => Err(format!("Unknown tool: {}", tool_id)),
    }
}
```

- [ ] **Step 2: Add chrono and opener dependencies**

Add to `src-tauri/Cargo.toml`:

```toml
chrono = "0.4"
opener = "0.7"
```

- [ ] **Step 3: Verify full project compiles**

```bash
cd src-tauri && cargo build
```

Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/Cargo.toml
git commit -m "feat: add Tauri command handlers for skills, config, sync"
```

---

### Task 7: Define Frontend Types and Tauri Hook

**Files:**
- Create: `src/types.ts`
- Create: `src/hooks/useSkills.ts`

- [ ] **Step 1: Create types.ts**

```ts
// src/types.ts
export interface Skill {
  name: string;
  description: string;
  path: string;
  toolId: string;
  hasScripts: boolean;
  hasReferences: boolean;
}

export interface AppConfig {
  gitRepoUrl: string;
  lastSync: string | null;
  repoLocalPath: string;
}

export type ToolId = "claude-code" | "opencode" | "codex";

export interface ToolTab {
  id: ToolId;
  label: string;
}

export const TOOLS: ToolTab[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
];
```

- [ ] **Step 2: Create useSkills.ts**

```ts
// src/hooks/useSkills.ts
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Skill, AppConfig, ToolId } from "../types";

export function useSkills(toolId: ToolId) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Skill[]>("getSkills", { toolId });
      setSkills(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { skills, loading, error, refresh };
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  const refresh = useCallback(async () => {
    const result = await invoke<AppConfig>("getConfig");
    setConfig(result);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (gitRepoUrl: string) => {
    await invoke("saveConfig", { gitRepoUrl });
    await refresh();
  }, [refresh]);

  return { config, save, refresh };
}

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await invoke<string[]>("syncFromGit");
      setSyncResult(result);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, syncResult, syncError, sync };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/hooks/useSkills.ts
git commit -m "feat: add TypeScript types and Tauri invoke hooks"
```

---

### Task 8: Build TabNav Component

**Files:**
- Create: `src/components/TabNav.tsx`

- [ ] **Step 1: Create TabNav.tsx**

```tsx
// src/components/TabNav.tsx
import type { ToolTab, ToolId } from "../types";

interface Props {
  tools: ToolTab[];
  active: ToolId;
  onSelect: (id: ToolId) => void;
}

export function TabNav({ tools, active, onSelect }: Props) {
  return (
    <nav className="flex border-b border-gray-200 dark:border-gray-700">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelect(tool.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === tool.id
              ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {tool.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TabNav.tsx
git commit -m "feat: add TabNav component"
```

---

### Task 9: Build SkillCard and SkillList Components

**Files:**
- Create: `src/components/SkillCard.tsx`
- Create: `src/components/SkillList.tsx`
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: Create SkillCard.tsx**

```tsx
// src/components/SkillCard.tsx
import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800"
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {skill.name}
        </h3>
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

- [ ] **Step 2: Create EmptyState.tsx**

```tsx
// src/components/EmptyState.tsx
interface Props {
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
      <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p className="text-sm">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create SkillList.tsx**

```tsx
// src/components/SkillList.tsx
import type { Skill, ToolId } from "../types";
import { SkillCard } from "./SkillCard";
import { EmptyState } from "./EmptyState";

interface Props {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  toolId: ToolId;
  onSelect: (skill: Skill) => void;
  onOpenDir: (toolId: ToolId) => void;
}

export function SkillList({ skills, loading, error, toolId, onSelect, onOpenDir }: Props) {
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

  if (skills.length === 0) {
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
        {skills.length} skill{skills.length !== 1 ? "s" : ""} found
      </p>
      {skills.map((skill) => (
        <SkillCard key={skill.name} skill={skill} onClick={() => onSelect(skill)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SkillCard.tsx src/components/SkillList.tsx src/components/EmptyState.tsx
git commit -m "feat: add SkillCard, SkillList, EmptyState components"
```

---

### Task 10: Build SkillDetail Component

**Files:**
- Create: `src/components/SkillDetail.tsx`

Shows full SKILL.md content when a skill is selected.

- [ ] **Step 1: Create SkillDetail.tsx**

```tsx
// src/components/SkillDetail.tsx
import { useEffect, useState } from "react";
import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onBack: () => void;
}

export function SkillDetail({ skill, onBack }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Read the SKILL.md file content via Tauri FS
    import("@tauri-apps/plugin-fs").then(({ readTextFile }) => {
      readTextFile("SKILL.md", { baseDir: undefined, dir: undefined })
        .then((text) => setContent(text))
        .catch(() => setContent("Failed to read SKILL.md"))
        .finally(() => setLoading(false));
    });
  }, [skill]);

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
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            {content}
          </pre>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
        {skill.path}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add fs plugin permission**

Update `src-tauri/capabilities/default.json` to allow reading skill files:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$HOME/.claude/**" },
        { "path": "$HOME/.config/opencode/**" },
        { "path": "$HOME/.agents/**" },
        { "path": "$APPDATA/opencode/**" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillDetail.tsx src-tauri/capabilities/default.json
git commit -m "feat: add SkillDetail component with SKILL.md preview"
```

---

### Task 11: Build SettingsPanel Component

**Files:**
- Create: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Create SettingsPanel.tsx**

```tsx
// src/components/SettingsPanel.tsx
import { useState } from "react";
import type { AppConfig } from "../types";

interface Props {
  config: AppConfig | null;
  onSave: (gitRepoUrl: string) => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
  syncResult: string[] | null;
  syncError: string | null;
}

export function SettingsPanel({ config, onSave, onSync, syncing, syncResult, syncError }: Props) {
  const [url, setUrl] = useState(config?.gitRepoUrl ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(url);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Git Repository URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/skills-repo.git"
            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || url === config?.gitRepoUrl}
          className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onSync}
          disabled={syncing || !config?.gitRepoUrl}
          className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>
      {config?.lastSync && (
        <p className="text-xs text-gray-400 mt-2">Last sync: {config.lastSync}</p>
      )}
      {syncError && (
        <p className="text-xs text-red-500 mt-2">{syncError}</p>
      )}
      {syncResult && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
          Synced {syncResult.length} skill{syncResult.length !== 1 ? "s" : ""} to all tools
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel with git repo config and sync button"
```

---

### Task 12: Build Main App Layout

**Files:**
- Modify: `src/App.tsx`

Assembles all components into the final UI.

- [ ] **Step 1: Replace App.tsx**

```tsx
// src/App.tsx
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TOOLS } from "./types";
import type { Skill, ToolId } from "./types";
import { useSkills, useConfig, useSync } from "./hooks/useSkills";
import { TabNav } from "./components/TabNav";
import { SkillList } from "./components/SkillList";
import { SkillDetail } from "./components/SkillDetail";
import { SettingsPanel } from "./components/SettingsPanel";

function App() {
  const [activeTab, setActiveTab] = useState<ToolId>("claude-code");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const { skills, loading, error, refresh } = useSkills(activeTab);
  const { config, save } = useConfig();
  const { syncing, syncResult, syncError, sync } = useSync();

  const handleSync = useCallback(async () => {
    await sync();
    refresh();
  }, [sync, refresh]);

  const handleOpenDir = useCallback(async (toolId: ToolId) => {
    await invoke("openSkillsDir", { toolId });
  }, []);

  const handleTabChange = useCallback((id: ToolId) => {
    setActiveTab(id);
    setSelectedSkill(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-bold">SkillsSync</h1>
        <p className="text-xs text-gray-400">Manage AI CLI skills from one place</p>
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
          <SkillList
            skills={skills}
            loading={loading}
            error={error}
            toolId={activeTab}
            onSelect={setSelectedSkill}
            onOpenDir={handleOpenDir}
          />
        )}
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Verify the full app builds and runs**

```bash
npm run tauri dev
```

Expected: App opens with header, settings bar, tabs, and skill list (empty if no skills installed yet).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: assemble main App layout with all components"
```

---

### Task 13: Read Skill Detail via Rust Command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/components/SkillDetail.tsx`

The SkillDetail component currently tries to use tauri-plugin-fs which may not have the right scope. Instead, add a Rust command to read the file content.

- [ ] **Step 1: Add read_skill_file command to commands.rs**

Append to `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn read_skill_file(tool_id: String, skill_name: String) -> Result<String, String> {
    let tool = parse_tool(&tool_id)?;
    let skill_md = tool.skills_dir().join(&skill_name).join("SKILL.md");
    std::fs::read_to_string(&skill_md).map_err(|e| format!("Cannot read {}: {}", skill_md.display(), e))
}
```

- [ ] **Step 2: Register the command in lib.rs**

Add `commands::read_skill_file` to the `generate_handler![]` list in `src-tauri/src/lib.rs`.

- [ ] **Step 3: Update SkillDetail.tsx to use the Rust command**

Replace the useEffect in `src/components/SkillDetail.tsx`:

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onBack: () => void;
}

export function SkillDetail({ skill, onBack }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<string>("readSkillFile", { toolId: skill.toolId, skillName: skill.name })
      .then(setContent)
      .catch((e) => setContent(`Error: ${e}`))
      .finally(() => setLoading(false));
  }, [skill]);

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
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            {content}
          </pre>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
        {skill.path}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify app builds**

```bash
npm run tauri dev
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/components/SkillDetail.tsx
git commit -m "feat: read SKILL.md content via Rust command instead of FS plugin"
```

---

### Task 14: Add Dark Mode Toggle and Polish

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add dark mode class toggle**

Add to `src/App.tsx` inside the component, before the return:

```tsx
const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

const toggleDark = () => {
  setDark((d) => !d);
  document.documentElement.classList.toggle("dark");
};
```

Add a toggle button in the header:

```tsx
<header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
  <div>
    <h1 className="text-lg font-bold">SkillsSync</h1>
    <p className="text-xs text-gray-400">Manage AI CLI skills from one place</p>
  </div>
  <button onClick={toggleDark} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
    {dark ? "Light" : "Dark"}
  </button>
</header>
```

- [ ] **Step 2: Enable dark mode in Tailwind**

Add to `tailwind.config.js` (create if not exists):

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
```

- [ ] **Step 3: Set initial dark class**

In `src/main.tsx`, after `App` renders, check system preference and apply:

```tsx
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.add("dark");
}
```

- [ ] **Step 4: Verify dark mode works**

```bash
npm run tauri dev
```

Toggle dark/light mode. Verify both look correct.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css src/main.tsx tailwind.config.js
git commit -m "feat: add dark mode toggle with system preference detection"
```

---

### Task 15: End-to-End Test with Real Skills

**Files:** None (manual testing)

- [ ] **Step 1: Create a test skill in Claude Code's directory**

```bash
mkdir -p ~/.claude/skills/test-skill
cat > ~/.claude/skills/test-skill/SKILL.md << 'EOF'
---
name: test-skill
description: A test skill for verifying SkillsSync works
---

This is a test skill. It does nothing useful.
EOF
```

- [ ] **Step 2: Start the app and verify**

```bash
npm run tauri dev
```

Verify:
- Claude Code tab shows "test-skill" in the list
- Clicking it shows the SKILL.md content
- OpenCode and Codex tabs show empty state (no skills installed)
- "Open skills directory" button works

- [ ] **Step 3: Test git sync (optional, requires a skills repo)**

If you have a git repo with skills:
1. Paste the URL in the settings bar
2. Click Save
3. Click Sync
4. Verify skills appear in all tool tabs

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify end-to-end skill discovery and display"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- Tab UI for Claude Code, OpenCode, Codex: Task 8, 12
- Skills list per tool: Task 9, 12
- SKILL.md parsing: Task 3
- Git repo config: Task 11
- Git sync to tool dirs: Task 5, 6
- Extensible tool architecture: Task 2
- Dark mode: Task 14

**2. Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**3. Type consistency:**
- `ToolId` type in TypeScript matches `Tool` enum IDs in Rust
- `Skill` struct fields match between Rust and TypeScript
- `AppConfig` fields match between Rust and TypeScript
- Command names: `getSkills`, `getConfig`, `saveConfig`, `syncFromGit`, `openSkillsDir`, `readSkillFile` — consistent across Rust commands.rs and TypeScript invoke calls
