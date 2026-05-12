import type { Skill, SyncStatus } from "../types";

interface Props {
  skill: Skill;
  onClick: () => void;
  syncStatus?: SyncStatus;
  onDelete?: () => void;
  onSyncToRepo?: () => void;
  onSyncToAgent?: () => void;
  onRestoreFromRepo?: () => void;
}

const STATUS_STYLES: Record<SyncStatus, string> = {
  identical: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
  "agent-only": "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
  "repo-only": "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
  different: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  identical: "Synced",
  "agent-only": "Agent only",
  "repo-only": "Repo only",
  different: "Modified",
};

export function SkillCard({ skill, onClick, syncStatus, onDelete, onSyncToRepo, onSyncToAgent, onRestoreFromRepo }: Props) {
  const statusStyle = syncStatus ? STATUS_STYLES[syncStatus] : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";

  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <div className={`rounded-lg border transition-colors ${statusStyle}`}>
      <button
        onClick={onClick}
        className="w-full text-left p-4 hover:border-blue-300 dark:hover:border-blue-600"
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {skill.name}
          </h3>
          {syncStatus && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400">
              {STATUS_LABELS[syncStatus]}
            </span>
          )}
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
      {syncStatus && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-0">
          {(syncStatus === "identical" || syncStatus === "agent-only" || syncStatus === "different") && onDelete && (
            <button
              onClick={(e) => handleAction(e, onDelete)}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
          )}
          {syncStatus === "agent-only" && onSyncToRepo && (
            <button
              onClick={(e) => handleAction(e, onSyncToRepo)}
              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
            >
              Sync to Repo
            </button>
          )}
          {syncStatus === "repo-only" && onSyncToAgent && (
            <button
              onClick={(e) => handleAction(e, onSyncToAgent)}
              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
            >
              Sync to Agent
            </button>
          )}
          {syncStatus === "different" && onSyncToRepo && (
            <button
              onClick={(e) => handleAction(e, onSyncToRepo)}
              className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
            >
              Sync to Repo
            </button>
          )}
          {syncStatus === "different" && onRestoreFromRepo && (
            <button
              onClick={(e) => handleAction(e, onRestoreFromRepo)}
              className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
            >
              Restore from Repo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
