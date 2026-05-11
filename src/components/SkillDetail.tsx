import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Skill } from "../types";

interface Props {
  skill: Skill;
  onBack: () => void;
}

const EDITORS = [
  { label: "VS Code", command: "code" },
  { label: "Notepad", command: "notepad" },
  { label: "Choose app...", command: "__pick__" },
];

export function SkillDetail({ skill, onBack }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    invoke<string>("read_skill_file", { toolId: skill.toolId, skillName: skill.name })
      .then(setContent)
      .catch((e) => setContent(`Error: ${e}`))
      .finally(() => setLoading(false));
  }, [skill]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleOpenWith = async (command: string) => {
    setMenuOpen(false);
    let appPath = command;

    if (command === "__pick__") {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Executables", extensions: ["exe", "cmd", "bat", "com"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!selected) return;
      appPath = selected as string;
    }

    try {
      await invoke("open_skill_with_app", {
        toolId: skill.toolId,
        skillName: skill.name,
        appPath,
      });
    } catch (e) {
      alert(`Failed to open: ${e}`);
    }
  };

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
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{skill.name}</h2>
          {skill.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</p>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10">
              {EDITORS.map((editor) => (
                <button
                  key={editor.command}
                  onClick={() => handleOpenWith(editor.command)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {editor.label}
                </button>
              ))}
            </div>
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
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={async () => {
            try {
              await invoke("reveal_path", { path: skill.path });
            } catch (e) {
              alert(`Failed to open path: ${e}`);
            }
          }}
          className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:underline cursor-pointer"
          aria-label="Reveal skill folder in file explorer"
          title="Open in file explorer"
        >
          {skill.path}
        </button>
      </div>
    </div>
  );
}
