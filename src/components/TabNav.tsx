import type { ToolTab, ToolId } from "../types";

interface Props {
  tools: ToolTab[];
  active: ToolId;
  onSelect: (id: ToolId) => void;
}

export function TabNav({ tools, active, onSelect }: Props) {
  return (
    <nav className="flex border-b border-gray-200 dark:border-gray-700">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelect(tool.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === tool.id
              ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {tool.label}
        </button>
      ))}
    </nav>
  );
}
