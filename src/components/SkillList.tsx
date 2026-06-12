import type { Skill, ToolId } from '../types'
import { SkillCard } from './SkillCard'
import { EmptyState } from './EmptyState'

interface Props {
  skills: Skill[]
  loading: boolean
  error: string | null
  toolId: ToolId
  onSelect: (skill: Skill) => void
  onOpenDir: (toolId: ToolId) => void
  onDelete?: (skillName: string) => void
}

export function SkillList({
  skills,
  loading,
  error,
  toolId,
  onSelect,
  onOpenDir,
  onDelete
}: Props) {
  if (loading) {
    return (
      <div className='flex items-center justify-center py-16 text-gray-400'>
        <div className='animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full' />
        <span className='ml-2.5 text-sm'>正在读取技能列表...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-4 m-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-900'>
        {error}
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        message='当前助理目录下暂无技能'
        action={{ label: '打开技能文件夹', onClick: () => onOpenDir(toolId) }}
      />
    )
  }

  return (
    <div className='p-5 space-y-3 max-w-4xl mx-auto'>
      <p className='text-xs text-gray-400 dark:text-gray-500 mb-1'>
        共找到 {skills.length} 个技能
      </p>
      <div className='space-y-3'>
        {skills.map((skill) => (
          <SkillCard
            key={skill.name}
            skill={skill}
            onClick={() => onSelect(skill)}
            onDelete={onDelete ? () => onDelete(skill.name) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
