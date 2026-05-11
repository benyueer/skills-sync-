import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupDiff, ToolId } from "../types";

interface Props {
  toolId: ToolId;
  backupPath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreDialog({ toolId, backupPath, onConfirm, onCancel }: Props) {
  const [diff, setDiff] = useState<BackupDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setLoading(true);
    invoke<BackupDiff>("preview_restore", { toolId, backupPath })
      .then(setDiff)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [toolId, backupPath]);

  const handleConfirm = async () => {
    setRestoring(true);
    try {
      await invoke("execute_restore", { toolId, backupPath });
      onConfirm();
    } catch (e) {
      setError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const hasChanges = diff && (diff.added.length > 0 || diff.deleted.length > 0 || diff.changed.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Confirm Restore
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            From: {backupPath}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400">Analyzing differences...</div>
          ) : error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : !hasChanges ? (
            <div className="text-center text-gray-400">No differences found.</div>
          ) : (
            <div className="space-y-4">
              {/* Added */}
              {diff!.added.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                    Will be added ({diff!.added.length})
                  </h3>
                  <ul className="space-y-1">
                    {diff!.added.map((name) => (
                      <li key={name} className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <span className="text-green-500">+</span> {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deleted */}
              {diff!.deleted.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                    Will be deleted ({diff!.deleted.length})
                  </h3>
                  <ul className="space-y-1">
                    {diff!.deleted.map((name) => (
                      <li key={name} className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                        <span className="text-red-500">-</span> {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Changed */}
              {diff!.changed.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                    Will be updated ({diff!.changed.length})
                  </h3>
                  <div className="space-y-3">
                    {diff!.changed.map((skill) => (
                      <details key={skill.name} className="border border-gray-200 dark:border-gray-700 rounded">
                        <summary className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                          {skill.name}
                        </summary>
                        <pre className="px-3 py-2 text-xs font-mono overflow-auto bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                          {skill.diff.split("\n").map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith("+")
                                  ? "text-green-600 dark:text-green-400"
                                  : line.startsWith("-")
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-500"
                              }
                            >
                              {line}
                            </div>
                          ))}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={restoring || loading || !hasChanges}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {restoring ? "Restoring..." : "Confirm Restore"}
          </button>
        </div>
      </div>
    </div>
  );
}
