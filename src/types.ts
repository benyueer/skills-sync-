export interface Skill {
  name: string;
  description: string;
  path: string;
  toolId: string;
  hasScripts: boolean;
  hasReferences: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

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

export interface SkillDiff {
  name: string;
  status: string;
  diff: string;
}

export interface BackupDiff {
  backupPath: string;
  added: string[];
  deleted: string[];
  changed: SkillDiff[];
}

export type SyncStatus = "identical" | "agent-only" | "repo-only" | "different";

export interface SkillSyncStatus {
  name: string;
  status: SyncStatus;
  repoPath: string | null;
  agentPath: string | null;
}

export type ToolId = "claude-code" | "opencode" | "codex" | "hermes";

export interface ToolTab {
  id: ToolId;
  label: string;
}

export const TOOLS: ToolTab[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
  { id: "hermes", label: "Hermes" },
];

export interface RepoGitStatus {
  output: string;
  isClean: boolean;
}

export type GitChangeType = "modified" | "added" | "deleted" | "untracked" | "renamed" | "other";
export type GitChangeMap = Record<string, GitChangeType>;
