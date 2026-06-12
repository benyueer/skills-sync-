export type DeleteTargetType = 'central' | 'agent' | 'repo'

export interface DeleteTarget {
  type: DeleteTargetType
  skillName: string
  contextLabel?: string
}

export function getDeleteImpact(target: DeleteTarget): string {
  switch (target.type) {
    case 'central':
      return '将彻底删除中央技能，并移除所有 Agent 目录中的关联软链接。'
    case 'agent':
      return `将从 ${target.contextLabel ?? '当前 Agent'} 中移除该技能，不会删除中央技能源文件。`
    case 'repo':
      return '将从本地仓库中删除该技能目录，Git 将记录这次删除。'
  }
}
