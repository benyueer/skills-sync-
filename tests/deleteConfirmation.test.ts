import assert from 'node:assert/strict'
import test from 'node:test'

import { getDeleteImpact, type DeleteTarget } from '../src/components/deleteConfirmation.ts'

test('describes the impact of each delete target', () => {
  const cases: Array<[DeleteTarget, string]> = [
    [
      { type: 'central', skillName: 'demo-skill' },
      '将彻底删除中央技能，并移除所有 Agent 目录中的关联软链接。'
    ],
    [
      { type: 'agent', skillName: 'demo-skill', contextLabel: 'Codex' },
      '将从 Codex 中移除该技能，不会删除中央技能源文件。'
    ],
    [
      { type: 'repo', skillName: 'demo-skill' },
      '将从本地仓库中删除该技能目录，Git 将记录这次删除。'
    ]
  ]

  for (const [target, expected] of cases) {
    assert.equal(getDeleteImpact(target), expected)
  }
})
