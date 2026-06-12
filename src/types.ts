export interface Skill {
  name: string
  description: string
  path: string
  toolId: string
  hasScripts: boolean
  hasReferences: boolean
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

export interface AppConfig {
  centralSkillsDir: string
  customSkillsDirs: Record<string, string>
  windowWidth: number
  windowHeight: number
  windowX: number | null
  windowY: number | null
  darkMode: boolean
  lastActiveTab: string
}

export interface SkillDiff {
  name: string
  status: string
  diff: string
}

export interface BackupDiff {
  backupPath: string
  added: string[]
  deleted: string[]
  changed: SkillDiff[]
}

export type SyncStatus = 'identical' | 'agent-only' | 'repo-only' | 'different'

export interface SkillSyncStatus {
  name: string
  status: SyncStatus
  repoPath: string | null
  agentPath: string | null
}

export type ToolId = 'claude-code' | 'opencode' | 'codex' | 'antigravity' | 'hermes' | 'central'

export interface ToolTab {
  id: ToolId
  label: string
}

export const TOOLS: ToolTab[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'codex', label: 'Codex' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'hermes', label: 'Hermes' }
]

export type SkillDistributionStatus = 'linked' | 'unlinked' | 'conflict'

export type SkillsDistributionMap = Record<string, Record<string, SkillDistributionStatus>>

export interface FileDiff {
  file: string
  oldContent: string | null
  newContent: string | null
}

