export interface Skill {
  name: string;
  description: string;
  path: string;
  toolId: string;
  hasScripts: boolean;
  hasReferences: boolean;
}

export interface AppConfig {
  gitRepoUrl: string;
  lastSync: string | null;
  repoLocalPath: string;
}

export type ToolId = "claude-code" | "opencode" | "codex";

export interface ToolTab {
  id: ToolId;
  label: string;
}

export const TOOLS: ToolTab[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
];
