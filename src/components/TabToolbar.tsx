import { useState, useRef } from "react";
import type { ToolId } from "../types";

interface Props {
  toolId: ToolId;
  customDir: string;
  defaultDir: string;
  onSaveDir: (toolId: string, path: string) => Promise<void>;
  onBackup: (toolId: string) => Promise<string>;
  onOpenRestore: (toolId: string) => void;
  onRefresh: () => void;
}

export function TabToolbar({
  toolId,
  customDir,
  defaultDir,
  onSaveDir,
  onBackup,
  onOpenRestore,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [dirValue, setDirValue] = useState(customDir || defaultDir);
  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayDir = customDir || defaultDir;

  const handleSaveDir = async () => {
    await onSaveDir(toolId, dirValue === defaultDir ? "" : dirValue);
    setEditing(false);
    onRefresh();
  };

  const handleBackup = async () => {
    setBacking(true);
    setBackupResult(null);
    try {
      const path = await onBackup(toolId);
      setBackupResult(path);
    } catch (e) {
      setBackupResult(`Error: ${e}`);
    } finally {
      setBacking(false);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3 text-sm">
        {/* Skills directory */}
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={dirValue}
              onChange={(e) => setDirValue(e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              onKeyDown={(e) => e.key === "Enter" && handleSaveDir()}
            />
            <button
              onClick={handleSaveDir}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setDirValue(customDir || defaultDir); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-gray-400 text-xs shrink-0">Dir:</span>
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={displayDir}>
              {displayDir}
            </span>
            <button
              onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="text-xs text-blue-500 hover:text-blue-600 shrink-0"
            >
              Edit
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackup}
            disabled={backing}
            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {backing ? "Backing up..." : "Backup"}
          </button>
          <button
            onClick={() => onOpenRestore(toolId)}
            className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Restore
          </button>
        </div>
      </div>

      {/* Backup result */}
      {backupResult && (
        <div className={`mt-1 text-xs ${backupResult.startsWith("Error") ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
          {backupResult.startsWith("Error") ? backupResult : `Backup saved: ${backupResult}`}
        </div>
      )}
    </div>
  );
}
