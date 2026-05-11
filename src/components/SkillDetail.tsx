import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onBack: () => void;
}

export function SkillDetail({ skill, onBack }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<string>("read_skill_file", { toolId: skill.toolId, skillName: skill.name })
      .then(setContent)
      .catch((e) => setContent(`Error: ${e}`))
      .finally(() => setLoading(false));
  }, [skill]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            {content}
          </pre>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
        {skill.path}
      </div>
    </div>
  );
}
