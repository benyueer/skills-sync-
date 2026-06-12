import type { Skill } from '../types'

interface Props {
  skill: Skill
  onClick: () => void
  onDelete?: () => void
}

export function SkillCard({ skill, onClick, onDelete }: Props) {
  return (
    <div className='rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors shadow-sm flex items-center justify-between p-4'>
      <button
        onClick={onClick}
        className='flex-1 text-left min-w-0 mr-4'
      >
        <div className='flex items-center gap-2 mb-1.5 flex-wrap'>
          <h3 className='font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-500 transition-colors truncate max-w-sm'>
            {skill.name}
          </h3>
          {skill.hasScripts && (
            <span className='text-[10px] px-1.5 py-0.5 font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'>
              scripts
            </span>
          )}
          {skill.hasReferences && (
            <span className='text-[10px] px-1.5 py-0.5 font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'>
              refs
            </span>
          )}
        </div>
        {skill.description && (
          <p className='text-sm text-gray-500 dark:text-gray-400 line-clamp-2'>
            {skill.description}
          </p>
        )}
      </button>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className='text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 px-2.5 py-1.5 rounded-lg transition-colors shrink-0'
        >
          删除
        </button>
      )}
    </div>
  )
}
