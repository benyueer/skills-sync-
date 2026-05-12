import { useState, useRef, useEffect } from "react";
import type { Skill, SyncStatus } from "../types";

interface Props {
  skill: Skill;
  onClick: () => void;
  syncStatus?: SyncStatus;
  gitChange?: string;
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

const GIT_CHANGE_STYLES: Record<string, string> = {
  modified: "border-l-4 border-l-amber-400 dark:border-l-amber-500",
  added: "border-l-4 border-l-emerald-400 dark:border-l-emerald-500",
  deleted: "border-l-4 border-l-red-400 dark:border-l-red-500",
  untracked: "border-l-4 border-l-blue-400 dark:border-l-blue-500",
  renamed: "border-l-4 border-l-purple-400 dark:border-l-purple-500",
};

const GIT_CHANGE_LABELS: Record<string, string> = {
  modified: "modified",
  added: "new",
  deleted: "deleted",
  untracked: "untracked",
  renamed: "renamed",
};

type ActionKey = "delete" | "syncToRepo" | "syncToAgent" | "restoreFromRepo";

interface MenuItem {
  key: ActionKey;
  label: string;
  confirmLabel: string;
  danger?: boolean;
}

function getMenuItems(syncStatus: SyncStatus | undefined, props: Props): MenuItem[] {
  const items: MenuItem[] = [];
  if (!syncStatus) return items;

  if ((syncStatus === "identical" || syncStatus === "agent-only" || syncStatus === "different") && props.onDelete) {
    items.push({ key: "delete", label: "Delete from Agent", confirmLabel: "Confirm delete?", danger: true });
  }
  if (syncStatus === "agent-only" && props.onSyncToRepo) {
    items.push({ key: "syncToRepo", label: "Sync to Repo", confirmLabel: "Confirm sync to repo?" });
  }
  if (syncStatus === "repo-only" && props.onSyncToAgent) {
    items.push({ key: "syncToAgent", label: "Sync to Agent", confirmLabel: "Confirm sync to agent?" });
  }
  if (syncStatus === "different") {
    if (props.onSyncToRepo) {
      items.push({ key: "syncToRepo", label: "Sync to Repo", confirmLabel: "Confirm sync to repo?" });
    }
    if (props.onRestoreFromRepo) {
      items.push({ key: "restoreFromRepo", label: "Restore from Repo", confirmLabel: "Confirm restore from repo?" });
    }
  }
  return items;
}

export function SkillCard(props: Props) {
  const { skill, onClick, syncStatus, gitChange } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<ActionKey | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusStyle = syncStatus ? STATUS_STYLES[syncStatus] : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
  const items = getMenuItems(syncStatus, props);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleMenuAction = (key: ActionKey) => {
    if (confirming === key) {
      const actionMap: Record<ActionKey, (() => void) | undefined> = {
        delete: props.onDelete,
        syncToRepo: props.onSyncToRepo,
        syncToAgent: props.onSyncToAgent,
        restoreFromRepo: props.onRestoreFromRepo,
      };
      actionMap[key]?.();
      setMenuOpen(false);
      setConfirming(null);
    } else {
      setConfirming(key);
    }
  };

  return (
    <div className={`rounded-lg border transition-colors ${statusStyle} ${gitChange ? GIT_CHANGE_STYLES[gitChange] ?? "" : ""}`}>
      <div className="flex items-start">
        <button
          onClick={onClick}
          className="flex-1 text-left p-4"
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
            {gitChange && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                {GIT_CHANGE_LABELS[gitChange] ?? gitChange}
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

        {items.length > 0 && (
          <div className="relative pr-2 pt-2" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
                setConfirming(null);
              }}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 w-48 py-1 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {items.map((item) => (
                  <button
                    key={item.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuAction(item.key);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      confirming === item.key
                        ? item.danger
                          ? "bg-red-500 text-white"
                          : "bg-blue-500 text-white"
                        : item.danger
                          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {confirming === item.key ? item.confirmLabel : item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
