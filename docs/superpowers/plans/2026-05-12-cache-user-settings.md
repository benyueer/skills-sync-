# Cache User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist all user settings (window size/position, dark mode, active tab) across app restarts by extending the existing AppConfig.

**Architecture:** Extend the existing `AppConfig` struct in Rust with new fields for window state, dark mode, and active tab. Add new Tauri commands for saving these settings. Update the React frontend to load settings on mount and save on changes. Window resize/move events are debounced (500ms) before saving.

**Tech Stack:** Rust (serde, tauri), TypeScript, React 19, Tauri 2.x API

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src-tauri/src/config.rs` | AppConfig struct with all persisted fields, load/save logic |
| `src-tauri/src/commands.rs` | Tauri commands: save_window_state, save_dark_mode, save_active_tab |
| `src-tauri/src/lib.rs` | Register new commands in invoke_handler |
| `src/types.ts` | TypeScript AppConfig interface matching Rust struct |
| `src/hooks/useSkills.ts` | useConfig hook extended with saveWindowState, saveDarkMode, saveActiveTab |
| `src/App.tsx` | Wire up config loading on mount, save on changes, window event listeners |

---

### Task 1: Extend Rust AppConfig struct

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add new fields to AppConfig struct**

Open `src-tauri/src/config.rs` and replace the `AppConfig` struct and its `Default` impl with:

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
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default)]
    pub window_x: Option<i32>,
    #[serde(default)]
    pub window_y: Option<i32>,
    #[serde(default)]
    pub dark_mode: bool,
    #[serde(default = "default_active_tab")]
    pub last_active_tab: String,
}

fn default_window_width() -> u32 {
    800
}

fn default_window_height() -> u32 {
    600
}

fn default_active_tab() -> String {
    "claude-code".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            git_repo_url: String::new(),
            last_sync: None,
            repo_local_path: String::new(),
            custom_skills_dirs: HashMap::new(),
            window_width: 800,
            window_height: 600,
            window_x: None,
            window_y: None,
            dark_mode: false,
            last_active_tab: "claude-code".to_string(),
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

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors. Existing `settings.json` files with missing fields will use defaults thanks to `#[serde(default)]`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: extend AppConfig with window state, dark mode, and active tab fields"
```

---

### Task 2: Add Tauri commands for saving new settings

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Add three new commands**

Open `src-tauri/src/commands.rs` and add these three functions at the end of the file (before the `FileEntry` struct and `build_file_tree`):

```rust
#[tauri::command]
pub fn save_window_state(width: u32, height: u32, x: i32, y: i32) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.window_width = width;
    cfg.window_height = height;
    cfg.window_x = Some(x);
    cfg.window_y = Some(y);
    config::save(&cfg)
}

#[tauri::command]
pub fn save_dark_mode(dark: bool) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.dark_mode = dark;
    config::save(&cfg)
}

#[tauri::command]
pub fn save_active_tab(tab: String) -> Result<(), String> {
    let mut cfg = config::load();
    cfg.last_active_tab = tab;
    config::save(&cfg)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add save_window_state, save_dark_mode, save_active_tab commands"
```

---

### Task 3: Register new commands in Tauri

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add new commands to invoke_handler**

Open `src-tauri/src/lib.rs` and add the three new commands to the `generate_handler!` macro. The result should look like:

```rust
mod commands;
mod config;
mod skill;
mod sync;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_skills,
            commands::get_config,
            commands::save_config,
            commands::sync_from_git,
            commands::open_skills_dir,
            commands::read_skill_file,
            commands::save_custom_dir,
            commands::backup_skills,
            commands::preview_restore,
            commands::execute_restore,
            commands::open_skill_with_app,
            commands::reveal_path,
            commands::list_skill_files,
            commands::read_file_content,
            commands::save_window_state,
            commands::save_dark_mode,
            commands::save_active_tab,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register save_window_state, save_dark_mode, save_active_tab commands"
```

---

### Task 4: Update TypeScript AppConfig interface

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new fields to AppConfig interface**

Open `src/types.ts` and update the `AppConfig` interface:

```typescript
export interface AppConfig {
  gitRepoUrl: string;
  lastSync: string | null;
  repoLocalPath: string;
  customSkillsDirs: Record<string, string>;
  windowWidth: number;
  windowHeight: number;
  windowX: number | null;
  windowY: number | null;
  darkMode: boolean;
  lastActiveTab: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add window state, dark mode, and active tab to TypeScript AppConfig"
```

---

### Task 5: Extend useConfig hook with new save functions

**Files:**
- Modify: `src/hooks/useSkills.ts`

- [ ] **Step 1: Add new save functions to useConfig**

Open `src/hooks/useSkills.ts` and update the `useConfig` function:

```typescript
export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  const refresh = useCallback(async () => {
    const result = await invoke<AppConfig>("get_config");
    setConfig(result);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (gitRepoUrl: string) => {
    await invoke("save_config", { gitRepoUrl });
    await refresh();
  }, [refresh]);

  const saveCustomDir = useCallback(async (toolId: string, path: string) => {
    await invoke("save_custom_dir", { toolId, path });
    await refresh();
  }, [refresh]);

  const saveWindowState = useCallback(async (width: number, height: number, x: number, y: number) => {
    await invoke("save_window_state", { width, height, x, y });
    // Don't refresh - avoid re-render loop since window events fire frequently
  }, []);

  const saveDarkMode = useCallback(async (dark: boolean) => {
    await invoke("save_dark_mode", { dark });
    await refresh();
  }, [refresh]);

  const saveActiveTab = useCallback(async (tab: string) => {
    await invoke("save_active_tab", { tab });
    await refresh();
  }, [refresh]);

  return { config, save, saveCustomDir, saveWindowState, saveDarkMode, saveActiveTab, refresh };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSkills.ts
git commit -m "feat: add saveWindowState, saveDarkMode, saveActiveTab to useConfig hook"
```

---

### Task 6: Wire up App.tsx to load and persist all settings

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to load config-driven state and persist changes**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import { TOOLS } from "./types";
import type { Skill, ToolId } from "./types";
import { useSkills, useConfig, useSync } from "./hooks/useSkills";
import { TabNav } from "./components/TabNav";
import { TabToolbar } from "./components/TabToolbar";
import { SkillList } from "./components/SkillList";
import { SkillDetail } from "./components/SkillDetail";
import { SettingsPanel } from "./components/SettingsPanel";
import { RestoreDialog } from "./components/RestoreDialog";

const DEFAULT_DIRS: Record<ToolId, string> = {
  "claude-code": "~/.claude/skills",
  "opencode": "~/.config/opencode/skills",
  "codex": "~/.agents/skills",
  "hermes": "~/.hermes/skills",
};

function App() {
  const { config, save, saveCustomDir, saveWindowState, saveDarkMode, saveActiveTab } = useConfig();
  const [activeTab, setActiveTab] = useState<ToolId>("claude-code");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const { skills, loading, error, refresh } = useSkills(activeTab);
  const { syncing, syncResult, syncError, sync } = useSync();
  const [dark, setDark] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<{ toolId: ToolId; backupPath: string } | null>(null);
  const initialized = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply config on first load
  useEffect(() => {
    if (!config || initialized.current) return;
    initialized.current = true;

    // Apply dark mode
    if (config.darkMode) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }

    // Apply active tab
    if (config.lastActiveTab && TOOLS.some(t => t.id === config.lastActiveTab)) {
      setActiveTab(config.lastActiveTab as ToolId);
    }

    // Apply window size and position
    const win = getCurrentWindow();
    if (config.windowWidth > 0 && config.windowHeight > 0) {
      win.setSize(new LogicalSize(config.windowWidth, config.windowHeight));
    }
    if (config.windowX !== null && config.windowY !== null) {
      win.setPosition(new LogicalPosition(config.windowX, config.windowY));
    }
  }, [config]);

  // Listen for window resize/move events and debounce save
  useEffect(() => {
    const win = getCurrentWindow();

    const saveWindow = async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(async () => {
        try {
          const size = await win.innerSize();
          const pos = await win.outerPosition();
          await saveWindowState(size.width, size.height, pos.x, pos.y);
        } catch (e) {
          console.error("Failed to save window state:", e);
        }
      }, 500);
    };

    const unlistenResize = win.onResized(() => saveWindow());
    const unlistenMove = win.onMoved(() => saveWindow());

    return () => {
      unlistenResize.then(fn => fn());
      unlistenMove.then(fn => fn());
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [saveWindowState]);

  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      saveDarkMode(next);
      return next;
    });
  }, [saveDarkMode]);

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
    saveActiveTab(id);
  }, [saveActiveTab]);

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
              defaultDir={DEFAULT_DIRS[activeTab]}
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

export default App;
```

- [ ] **Step 2: Verify the frontend compiles**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: load and persist window state, dark mode, and active tab on startup"
```

---

### Task 7: End-to-end verification

**Files:** None (manual testing)

- [ ] **Step 1: Build and run the app**

Run: `cd /Users/mac/Desktop/pro/skills-sync- && cargo tauri dev`
Expected: App launches successfully.

- [ ] **Step 2: Verify window state persistence**

1. Resize the window to ~1000x800
2. Move the window to a non-default position
3. Close the app
4. Reopen the app
5. Expected: Window restores to the same size and position

- [ ] **Step 3: Verify dark mode persistence**

1. Click the dark mode toggle (moon icon)
2. Close the app
3. Reopen the app
4. Expected: Dark mode is still active

- [ ] **Step 4: Verify active tab persistence**

1. Switch to the "opencode" tab
2. Close the app
3. Reopen the app
4. Expected: "opencode" tab is active on startup

- [ ] **Step 5: Verify existing settings still work**

1. Enter a git repo URL in the settings panel, click Save
2. Edit a custom skills directory for any tool
3. Close the app
4. Reopen the app
5. Expected: Git repo URL and custom directory are restored

- [ ] **Step 6: Verify settings.json contents**

Run: `cat ~/Library/Application\ Support/skills-sync/settings.json`
Expected: JSON file contains all new fields (`windowWidth`, `windowHeight`, `windowX`, `windowY`, `darkMode`, `lastActiveTab`) with correct values.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete user settings persistence across restarts"
```
