import type { Skill, ToolId } from "../types";
import { SkillCard } from "./SkillCard";
import { EmptyState } from "./EmptyState";

interface Props {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  toolId: ToolId;
  onSelect: (skill: Skill) => void;
  onOpenDir: (toolId: ToolId) => void;
}

export function SkillList({ skills, loading, error, toolId, onSelect, onOpenDir }: Props) {
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

  if (skills.length === 0) {
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
        {skills.length} skill{skills.length !== 1 ? "s" : ""} found
      </p>
      {skills.map((skill) => (
        <SkillCard key={skill.name} skill={skill} onClick={() => onSelect(skill)} />
      ))}
    </div>
  );
}
