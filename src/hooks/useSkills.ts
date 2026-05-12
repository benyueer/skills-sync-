import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Skill, AppConfig, ToolId, SkillSyncStatus } from "../types";

export function useSkills(toolId: ToolId) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Skill[]>("get_skills", { toolId });
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

export function useSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await invoke<string[]>("sync_from_git");
      setSyncResult(result);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, syncResult, syncError, sync };
}

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
