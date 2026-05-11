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

const DEFAULT_DIRS: Record<ToolId, string> = {
  "claude-code": "~/.claude/skills",
  "opencode": "~/.config/opencode/skills",
  "codex": "~/.agents/skills",
  "hermes": "~/.hermes/skills",
};

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
