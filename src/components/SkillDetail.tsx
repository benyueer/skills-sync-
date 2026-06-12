import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Skill, FileEntry, SyncStatus, FileDiff } from "../types";
import { FileTree } from "./FileTree";
import { DiffViewer } from "./DiffViewer";
import { highlightCode } from "../utils/syntaxHighlight";

interface Props {
  skill: Skill;
  onBack: () => void;
  syncStatus?: SyncStatus;
  repoPath?: string | null;
}

const STATUS_BG: Record<SyncStatus, string> = {
  identical: "bg-green-50 dark:bg-green-900/10",
  "agent-only": "bg-orange-50 dark:bg-orange-900/10",
  "repo-only": "bg-gray-100 dark:bg-gray-800/50",
  different: "bg-yellow-50 dark:bg-yellow-900/10",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  identical: "Synced with repo",
  "agent-only": "Only in agent (not in repo)",
  "repo-only": "Only in repo (not in agent)",
  different: "Modified (differs from repo)",
};

function findFirstFile(entries: FileEntry[]): FileEntry | null {
  for (const entry of entries) {
    if (!entry.isDirectory) return entry;
    if (entry.children) {
      const found = findFirstFile(entry.children);
      if (found) return found;
    }
  }
  return null;
}

export function SkillDetail({ skill, onBack, syncStatus, repoPath }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // Diff view state
  const [showDiff, setShowDiff] = useState(false);
  const [diffFiles, setDiffFiles] = useState<FileDiff[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  // Load file list on mount
  useEffect(() => {
    setLoading(true);
    if (syncStatus === "repo-only" && repoPath) {
      // Repo-only: list files from the repo path directly
      invoke<FileEntry[]>("list_repo_skill_files", { repoPath })
        .then((fileList) => {
          setFiles(fileList);
          const firstFile = findFirstFile(fileList);
          if (firstFile) {
            setSelectedPath(firstFile.path);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    } else {
      invoke<FileEntry[]>("list_skill_files", { toolId: skill.toolId, skillName: skill.name })
        .then((fileList) => {
          setFiles(fileList);
          const firstFile = findFirstFile(fileList);
          if (firstFile) {
            setSelectedPath(firstFile.path);
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          invoke<string>("read_skill_file", { toolId: skill.toolId, skillName: skill.name })
            .then((text) => setContent(text))
            .catch((e) => setContent(`Error: ${e}`))
            .finally(() => setLoading(false));
        });
    }
  }, [skill, syncStatus, repoPath]);

  // Load file content when selectedPath changes
  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    if (syncStatus === "repo-only") {
      invoke<string>("read_repo_file_content", { path: selectedPath })
        .then(setContent)
        .catch((e) => setContent(`Error: ${e}`))
        .finally(() => setLoading(false));
    } else {
      invoke<string>("read_file_content", { toolId: skill.toolId, path: selectedPath })
        .then(setContent)
        .catch((e) => setContent(`Error: ${e}`))
        .finally(() => setLoading(false));
    }
  }, [selectedPath, skill.toolId, syncStatus]);

  // Load diff content when toggled — calls backend get_skill_diff_content
  useEffect(() => {
    if (!showDiff || !repoPath) {
      setDiffFiles([]);
      return;
    }
    setDiffLoading(true);
    invoke<FileDiff[]>("get_skill_diff_content", {
      toolId: skill.toolId,
      skillName: skill.name,
      repoPath,
    })
      .then(setDiffFiles)
      .catch((e) => {
        console.error("Failed to load diff:", e);
        setDiffFiles([]);
      })
      .finally(() => setDiffLoading(false));
  }, [showDiff, repoPath, skill.name, skill.toolId]);

  const bgClass = syncStatus ? STATUS_BG[syncStatus] : "";

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      <div className='flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'>
        <button
          onClick={onBack}
          className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded p-1'
          aria-label='返回'
        >
          <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
        </button>
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <h2 className='font-mono text-sm font-bold text-gray-900 dark:text-gray-100'>{skill.name}</h2>
            {syncStatus && (
              <span className='text-[10px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-650 dark:text-gray-400 font-mono'>
                {STATUS_LABELS[syncStatus]}
              </span>
            )}
          </div>
          {skill.description && (
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>{skill.description}</p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {syncStatus === 'different' && repoPath && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`px-3 py-1 text-xs rounded font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 ${
                showDiff
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
              }`}
            >
              {showDiff ? '隐藏 Diff' : '查看 Diff'}
            </button>
          )}
          <button
            onClick={async () => {
              try {
                if (syncStatus === 'repo-only') {
                  await invoke('open_repo_dir')
                } else {
                  await invoke('reveal_path', { path: skill.path })
                }
              } catch (e) {
                alert(`打开目录失败: ${e}`)
              }
            }}
            className='px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-medium'
          >
            打开目录
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {files.length > 1 && (
          <div className="w-[200px] border-r border-gray-200 dark:border-gray-700 overflow-auto">
            <FileTree
              files={files}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : showDiff && syncStatus === "different" ? (
            <div>
              {diffLoading ? (
                <div className="text-gray-400 text-sm">Computing diff...</div>
              ) : (
                <DiffViewer files={diffFiles} />
              )}
            </div>
          ) : (
            <pre
              className='text-xs whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 p-4 rounded-md border border-gray-150 dark:border-gray-800'
              dangerouslySetInnerHTML={{
                __html: selectedPath
                  ? highlightCode(content, selectedPath)
                  : content
              }}
            />
          )}
        </div>
      </div>
      <div className='p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'>
        {syncStatus === 'repo-only' ? (
          <span className='text-xs text-gray-400 font-mono'>
            Repo: {repoPath}
          </span>
        ) : (
          <button
            onClick={async () => {
              try {
                await invoke('reveal_path', { path: skill.path })
              } catch (e) {
                alert(`打开路径失败: ${e}`)
              }
            }}
            className='text-xs font-mono text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:underline cursor-pointer focus:outline-none'
            aria-label='在文件浏览器中打开技能目录'
            title='在文件浏览器中打开'
          >
            {skill.path}
          </button>
        )}
      </div>
    </div>
  );
}
