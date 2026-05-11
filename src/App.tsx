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
