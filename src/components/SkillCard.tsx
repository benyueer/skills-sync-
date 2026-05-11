import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800"
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {skill.name}
        </h3>
        {skill.hasScripts && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            scripts
          </span>
        )}
        {skill.hasReferences && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            refs
          </span>
        )}
      </div>
      {skill.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {skill.description}
        </p>
      )}
    </button>
  );
}
