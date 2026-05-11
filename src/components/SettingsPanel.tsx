import { useState } from "react";
import type { AppConfig } from "../types";

interface Props {
  config: AppConfig | null;
  onSave: (gitRepoUrl: string) => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
  syncResult: string[] | null;
  syncError: string | null;
}

export function SettingsPanel({ config, onSave, onSync, syncing, syncResult, syncError }: Props) {
  const [url, setUrl] = useState(config?.gitRepoUrl ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(url);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Git Repository URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/skills-repo.git"
            className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || url === config?.gitRepoUrl}
          className="px-3 py-1.5 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onSync}
          disabled={syncing || !config?.gitRepoUrl}
          className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>
      {config?.lastSync && (
        <p className="text-xs text-gray-400 mt-2">Last sync: {config.lastSync}</p>
      )}
      {syncError && (
        <p className="text-xs text-red-500 mt-2">{syncError}</p>
      )}
      {syncResult && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
          Synced {syncResult.length} skill{syncResult.length !== 1 ? "s" : ""} to all tools
        </p>
      )}
    </div>
  );
}
