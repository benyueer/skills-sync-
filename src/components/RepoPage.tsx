import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Skill, GitChangeMap } from "../types";
import { useRepoSkills } from "../hooks/useRepoSkills";
import { SkillCard } from "./SkillCard";

interface Props {
  config: AppConfig | null;
  onSaveUrl: (url: string) => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
  onSelectSkill: (skill: Skill) => void;
}

export function RepoPage({ config, onSaveUrl, onSync, syncing, onSelectSkill }: Props) {
  const isConfigured = !!config?.gitRepoUrl;
  const [editing, setEditing] = useState(!isConfigured);
  const [url, setUrl] = useState(config?.gitRepoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [gitOutput, setGitOutput] = useState<string | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const { skills, loading, error, refresh } = useRepoSkills(config?.repoLocalPath ?? "");
  const [gitChanges, setGitChanges] = useState<GitChangeMap>({});

  const fetchGitChanges = useCallback(async () => {
    try {
      const changes = await invoke<GitChangeMap>("get_repo_git_changes");
      setGitChanges(changes);
    } catch {
      // silently ignore — git status is best-effort
    }
  }, []);

  useEffect(() => {
    if (config?.repoLocalPath) {
      fetchGitChanges();
    }
  }, [config?.repoLocalPath, fetchGitChanges]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isConfigured && url !== config?.gitRepoUrl) {
        await invoke("update_repo_url", { newUrl: url });
        await onSaveUrl(url);
      } else {
        await onSaveUrl(url);
      }
      setEditing(false);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setUrl(config?.gitRepoUrl ?? "");
    setEditing(false);
  };

  const handlePull = useCallback(async () => {
    setGitLoading(true);
    setGitOutput(null);
    setGitError(null);
    try {
      const result = await invoke<string>("git_pull");
      setGitOutput(result || "Pull completed successfully");
      refresh();
      fetchGitChanges();
    } catch (e) {
      setGitError(String(e));
    } finally {
      setGitLoading(false);
    }
  }, [refresh, fetchGitChanges]);

  const handleStatus = useCallback(async () => {
    setGitLoading(true);
    setGitOutput(null);
    setGitError(null);
    try {
      const result = await invoke<string>("git_status");
      setGitOutput(result || "Working tree clean");
    } catch (e) {
      setGitError(String(e));
    } finally {
      setGitLoading(false);
    }
  }, []);

  const handleSyncToTools = useCallback(async () => {
    await onSync();
    refresh();
    fetchGitChanges();
  }, [onSync, refresh, fetchGitChanges]);

  const handleOpenDir = useCallback(async () => {
    await invoke("open_repo_dir");
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Repository URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={!editing}
              placeholder="https://github.com/user/skills-repo.git"
              className={`w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                editing
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              }`}
            />
          </div>
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving || !url || url === config?.gitRepoUrl}
                className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {isConfigured && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing && isConfigured && url !== config?.gitRepoUrl && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            更改地址会删除已有仓库
          </p>
        )}

        {/* Git operation buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handlePull}
            disabled={gitLoading || !config?.gitRepoUrl || editing}
            className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {gitLoading ? "Loading..." : "Pull"}
          </button>
          <button
            onClick={handleStatus}
            disabled={gitLoading || !config?.repoLocalPath || editing}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Status
          </button>
          <button
            onClick={handleSyncToTools}
            disabled={syncing || !config?.gitRepoUrl || editing}
            className="px-3 py-1.5 text-sm rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing..." : "Sync to Tools"}
          </button>
          <button
            onClick={handleOpenDir}
            disabled={!config?.repoLocalPath || editing}
            className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Open Dir
          </button>
          {config?.lastSync && (
            <span className="text-xs text-gray-400 ml-auto">
              Last sync: {config.lastSync}
            </span>
          )}
        </div>

        {/* Git output */}
        {gitOutput && (
          <pre className="mt-2 p-2 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
            {gitOutput}
          </pre>
        )}
        {gitError && (
          <p className="text-xs text-red-500 mt-2">{gitError}</p>
        )}
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Repository Skills ({skills.length})
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : skills.length === 0 ? (
          <p className="text-sm text-gray-400">
            {config?.repoLocalPath
              ? "No skills found in repository"
              : "Configure a repository URL and sync to see skills"}
          </p>
        ) : (
          <div className="grid gap-2">
            {skills.map((skill) => {
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
        )}
      </div>
    </div>
  );
}
