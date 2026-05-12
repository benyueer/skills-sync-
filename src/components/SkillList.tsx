import type { Skill, ToolId, SkillSyncStatus } from "../types";
import { SkillCard } from "./SkillCard";
import { EmptyState } from "./EmptyState";

interface Props {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  toolId: ToolId;
  onSelect: (skill: Skill) => void;
  onOpenDir: (toolId: ToolId) => void;
  comparedSkills?: SkillSyncStatus[];
  onDelete?: (skillName: string) => void;
  onSyncToRepo?: (skillName: string) => void;
  onSyncToAgent?: (skillName: string) => void;
  onRestoreFromRepo?: (skillName: string) => void;
}

export function SkillList({ skills, loading, error, toolId, onSelect, onOpenDir, comparedSkills, onDelete, onSyncToRepo, onSyncToAgent, onRestoreFromRepo }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full" />
        <span className="ml-2 text-sm">Loading skills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 m-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  // Build a lookup map from comparedSkills for O(1) status access
  const statusMap = new Map(
    (comparedSkills ?? []).map((cs) => [cs.name, cs.status])
  );

  // Merge: show all agent skills + any repo-only skills not in agent list
  const mergedSkills = [...skills];
  const agentNames = new Set(skills.map((s) => s.name));
  for (const cs of comparedSkills ?? []) {
    if (!agentNames.has(cs.name)) {
      // Repo-only skill — synthesize a minimal Skill object for display
      mergedSkills.push({
        name: cs.name,
        description: "",
        path: cs.repoPath ?? "",
        toolId: "repo",
        hasScripts: false,
        hasReferences: false,
      });
    }
  }

  if (mergedSkills.length === 0) {
    return (
      <EmptyState
        message="No skills found for this tool"
        action={{ label: "Open skills directory", onClick: () => onOpenDir(toolId) }}
      />
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {mergedSkills.length} skill{mergedSkills.length !== 1 ? "s" : ""} found
        {comparedSkills && comparedSkills.length > 0 && (
          <span className="ml-2">
            ({comparedSkills.filter((s) => s.status === "identical").length} synced,
            {" "}{comparedSkills.filter((s) => s.status === "different").length} modified,
            {" "}{comparedSkills.filter((s) => s.status === "repo-only").length} repo only,
            {" "}{comparedSkills.filter((s) => s.status === "agent-only").length} agent only)
          </span>
        )}
      </p>
      {mergedSkills.map((skill) => {
        const status = statusMap.get(skill.name);
        return (
          <SkillCard
            key={skill.name}
            skill={skill}
            syncStatus={status}
            onClick={() => onSelect(skill)}
            onDelete={status && onDelete ? () => onDelete(skill.name) : undefined}
            onSyncToRepo={status === "agent-only" || status === "different" ? () => onSyncToRepo?.(skill.name) : undefined}
            onSyncToAgent={status === "repo-only" ? () => onSyncToAgent?.(skill.name) : undefined}
            onRestoreFromRepo={status === "different" ? () => onRestoreFromRepo?.(skill.name) : undefined}
          />
        );
      })}
    </div>
  );
}
