import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Skill, GitChangeMap } from "../types";
import { useRepoSkills } from "../hooks/useRepoSkills";
import { SkillCard } from "./SkillCard";

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [stagedCount, setStagedCount] = useState(0);
  const [unstagedCount, setUnstagedCount] = useState(0);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictedFiles, setConflictedFiles] = useState<string[]>([]);
  const { skills, loading, error, refresh } = useRepoSkills(config?.repoLocalPath ?? "");
  const [gitChanges, setGitChanges] = useState<GitChangeMap>({});

  const fetchGitChanges = useCallback(async () => {
    try {
      const changes = await invoke<GitChangeMap>("get_repo_git_changes");
      setGitChanges(changes);
    } catch {
      // silently ignore
    }
  }, []);

  // Parse git status for staged count, unstaged count, and conflicts
  const refreshStatus = useCallback(async () => {
    try {
      const output = await invoke<string>("git_status");
      let staged = 0;
      let unstaged = 0;
      const conflicts: string[] = [];

      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3) continue;
        const x = trimmed[0]; // index (staged)
        const y = trimmed[1]; // worktree (unstaged)

        // Conflict states: UU, AA, DD, AU, UA, DU, UD
        if ((x === "U" || y === "U") || (x === "A" && y === "A") || (x === "D" && y === "D")) {
          conflicts.push(trimmed.slice(3).trim());
          continue;
        }

        // Untracked files (??) count as unstaged
        if (x === "?" && y === "?") {
          unstaged++;
          continue;
        }

        if (x !== " " && x !== "?") staged++;
        if (y !== " " && y !== "?") unstaged++;
      }

      setStagedCount(staged);
      setUnstagedCount(unstaged);
      setConflictedFiles(conflicts);
      setHasConflicts(conflicts.length > 0);
    } catch {
      setStagedCount(0);
      setUnstagedCount(0);
      setHasConflicts(false);
      setConflictedFiles([]);
    }
    fetchGitChanges();
  }, [fetchGitChanges]);

  useEffect(() => {
    if (config?.repoLocalPath) {
      refreshStatus();
    }
  }, [config?.repoLocalPath, refreshStatus]);

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

  // ── Workflow handlers ──

  // Helper to run a git action with loading state
  const runGitAction = useCallback(async (action: string, fn: () => Promise<string>, onSuccess?: (result: string) => void) => {
    setGitLoading(true);
    setLoadingAction(action);
    setGitOutput(null);
    setGitError(null);
    try {
      const result = await fn();
      setGitOutput(result);
      onSuccess?.(result);
    } catch (e) {
      setGitError(String(e));
    } finally {
      setGitLoading(false);
      setLoadingAction(null);
    }
  }, []);

  const handlePull = useCallback(async () => {
    await runGitAction("Pulling...", () => invoke<string>("git_pull"), () => {
      refresh();
    });
    await refreshStatus();
  }, [runGitAction, refresh, refreshStatus]);

  const handleAdd = useCallback(async () => {
    await runGitAction("Staging...", () => invoke<string>("git_add"));
    await refreshStatus();
  }, [runGitAction, refreshStatus]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) return;
    await runGitAction("Committing...", () => invoke<string>("git_commit", { message: commitMessage.trim() }), () => {
      setCommitMessage("");
    });
    await refreshStatus();
  }, [runGitAction, commitMessage, refreshStatus]);

  const handlePush = useCallback(async () => {
    await runGitAction("Pushing...", () => invoke<string>("git_push"));
    await refreshStatus();
  }, [runGitAction, refreshStatus]);

  // ── Conflict resolution ──

  const handleMergeAbort = useCallback(async () => {
    await runGitAction("Aborting...", () => invoke<string>("git_merge_abort"), () => {
      refresh();
    });
    await refreshStatus();
  }, [runGitAction, refresh, refreshStatus]);

  const handleResolveOurs = useCallback(async () => {
    await runGitAction("Resolving...", () => invoke<string>("git_resolve_ours"));
    await refreshStatus();
  }, [runGitAction, refreshStatus]);

  const handleResolveTheirs = useCallback(async () => {
    await runGitAction("Resolving...", () => invoke<string>("git_resolve_theirs"));
    await refreshStatus();
  }, [runGitAction, refreshStatus]);

  // ── Utility handlers ──

  const handleStatus = useCallback(async () => {
    await runGitAction("Checking...", () => invoke<string>("git_status"));
    refresh();
    await refreshStatus();
  }, [runGitAction, refresh, refreshStatus]);

  const handleSyncToTools = useCallback(async () => {
    await onSync();
    refresh();
    refreshStatus();
  }, [onSync, refresh, refreshStatus]);

  const handleOpenDir = useCallback(async () => {
    await invoke("open_repo_dir");
  }, []);

  const anyDisabled = gitLoading || editing;

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

        {/* Conflict panel */}
        {hasConflicts && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              Merge conflicts detected in {conflictedFiles.length} file{conflictedFiles.length !== 1 ? "s" : ""}:
            </p>
            <ul className="text-xs text-red-600 dark:text-red-400 mb-3 space-y-0.5">
              {conflictedFiles.map((f) => (
                <li key={f} className="font-mono">{f}</li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMergeAbort}
                disabled={anyDisabled}
                className="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Abort Merge
              </button>
              <button
                onClick={handleResolveOurs}
                disabled={anyDisabled}
                className="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                Keep Ours
              </button>
              <button
                onClick={handleResolveTheirs}
                disabled={anyDisabled}
                className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Keep Theirs
              </button>
            </div>
          </div>
        )}

        {/* Git workflow buttons */}
        <div className="mt-3 space-y-2">
          {/* Row 1: Pull · Status, Sync, Open Dir */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePull}
              disabled={anyDisabled || !config?.gitRepoUrl || hasConflicts}
              className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {loadingAction === "Pulling..." ? <><Spinner /> Pulling...</> : "Pull"}
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              onClick={handleStatus}
              disabled={anyDisabled || !config?.repoLocalPath}
              className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Status
            </button>
            <button
              onClick={handleSyncToTools}
              disabled={anyDisabled || syncing || !config?.gitRepoUrl}
              className="px-3 py-1.5 text-sm rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {syncing ? <><Spinner /> Syncing...</> : "Sync to Tools"}
            </button>
            <button
              onClick={handleOpenDir}
              disabled={anyDisabled || !config?.repoLocalPath}
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

          {/* Row 2: Add · Commit message + Commit · Push */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={anyDisabled || unstagedCount === 0 || hasConflicts || !config?.repoLocalPath}
              className="px-3 py-1.5 text-sm rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {loadingAction === "Staging..." ? <><Spinner /> Staging...</> : unstagedCount > 0 ? `Add (${unstagedCount})` : "Add"}
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCommit()}
              placeholder="Commit message"
              disabled={anyDisabled || hasConflicts || !config?.repoLocalPath}
              className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleCommit}
              disabled={anyDisabled || (stagedCount === 0 && !commitMessage.trim()) || hasConflicts || !config?.repoLocalPath}
              className="px-3 py-1.5 text-sm rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {loadingAction === "Committing..." ? <><Spinner /> Committing...</> : stagedCount > 0 ? `Commit (${stagedCount})` : "Commit"}
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              onClick={handlePush}
              disabled={anyDisabled || !config?.repoLocalPath || hasConflicts}
              className="px-3 py-1.5 text-sm rounded bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {loadingAction === "Pushing..." ? <><Spinner /> Pushing...</> : "Push"}
            </button>
          </div>
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
              const repoPath = config?.repoLocalPath ?? "";
              let relSkillPath = skill.path;
              if (repoPath && skill.path.startsWith(repoPath)) {
                relSkillPath = skill.path.slice(repoPath.length).replace(/^[/\\]/, "");
              }
              const changeType = Object.entries(gitChanges).find(([filePath]) =>
                filePath.startsWith(relSkillPath + "/") || filePath === relSkillPath
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
