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
