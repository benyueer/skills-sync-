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
