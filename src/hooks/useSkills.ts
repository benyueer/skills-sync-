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
