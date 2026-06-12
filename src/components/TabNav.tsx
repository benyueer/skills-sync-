import type { ToolTab } from '../types'

interface Props {
  tools: ToolTab[]
  active: string
  onSelect: (id: string) => void
}

export function TabNav({ tools, active, onSelect }: Props) {
  return (
    <nav className='flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900'>
      <button
        onClick={() => onSelect('central')}
        className={`px-4 py-2.5 text-sm font-medium transition-colors ${
          active === 'central'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        中央技能库
      </button>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onSelect(tool.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tool.id
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {tool.label}
        </button>
      ))}
    </nav>
  )
}
