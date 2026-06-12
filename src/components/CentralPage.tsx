import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import type { AppConfig, Skill, ToolId, SkillDistributionStatus } from '../types'
import { useSkillsDistributionStatus } from '../hooks/useSkills'
import { SkillDetail } from './SkillDetail'
import { RestoreDialog } from './RestoreDialog'
import { AgentLogo } from './AgentLogo'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import type { DeleteTarget } from './deleteConfirmation'

interface Props {
  config: AppConfig | null
  onSaveCentralDir: (path: string) => Promise<void>
  onSaveCustomDir: (toolId: string, path: string) => Promise<void>
  onBackup: (toolId: string) => Promise<string>
  skills: Skill[]
  loadingSkills: boolean
  refreshSkills: () => void
  dark: boolean
  toggleDark: () => void
}

const AGENTS: {
  id: Exclude<ToolId, 'central'>
  label: string
  defaultDir: string
}[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    defaultDir: '~/.claude/skills'
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    defaultDir: '~/.config/opencode/skills'
  },
  {
    id: 'codex',
    label: 'Codex',
    defaultDir: '~/.agents/skills'
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    defaultDir: '~/.antigravity/skills'
  },
  {
    id: 'hermes',
    label: 'Hermes',
    defaultDir: '~/.hermes/skills'
  }
]

export function CentralPage({
  config,
  onSaveCentralDir,
  onSaveCustomDir,
  onBackup,
  skills,
  loadingSkills,
  refreshSkills,
  dark,
  toggleDark
}: Props) {
  const isConfigured = !!config?.centralSkillsDir
  const [editingDir, setEditingDir] = useState(false)
  const [dirPath, setDirPath] = useState(config?.centralSkillsDir ?? '')
  const [savingDir, setSavingDir] = useState(false)
  
  // ── Modals ──
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ toolId: ToolId; backupPath: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  
  // ── 新技能创建 ──
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillDesc, setNewSkillDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── 错误与状态 ──
  const [actionError, setActionError] = useState<string | null>(null)
  const [simpleMode, setSimpleMode] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const { distribution, refresh: refreshDist, loading: loadingDist } = useSkillsDistributionStatus()

  // ── 终端交互 ──
  const [consoleVisible, setConsoleVisible] = useState(false)
  const [cliCommand, setCliCommand] = useState('npx impeccable skills install')
  const [consoleLog, setConsoleLog] = useState('')
  const [runningCmd, setRunningCmd] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const terminalRef = useRef<HTMLPreElement>(null)

  // ── 备份与路径状态 ──
  const [backingTool, setBackingTool] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<Record<string, string>>({})
  const [editToolPath, setEditToolPath] = useState<string | null>(null)
  const [toolPathValue, setToolPathValue] = useState('')

  // 保持配置同步
  useEffect(() => {
    if (config?.centralSkillsDir) {
      setDirPath(config.centralSkillsDir)
    }
  }, [config?.centralSkillsDir])

  // 自动滚至终端底部
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [consoleLog])

  useEffect(() => {
    if (!showAdvancedSettings) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdvancedSettings(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAdvancedSettings])

  // 监听 Rust 发送的标准输出和进程退出事件
  useEffect(() => {
    let unlistenStdout: (() => void) | null = null
    let unlistenExit: (() => void) | null = null

    const setupListeners = async () => {
      const subStdout = await listen<string>('term-stdout', (event) => {
        setConsoleLog((prev) => {
          const next = prev + event.payload
          return next.slice(-20000)
        })
      })
      unlistenStdout = subStdout

      const subExit = await listen<number>('term-exit', (event) => {
        setRunningCmd(false)
        const code = event.payload
        setConsoleLog((prev) => prev + `\n\n[进程执行完毕，退出码: ${code}]\n`)
        refreshSkills()
        refreshDist()
      })
      unlistenExit = subExit
    }

    setupListeners()

    return () => {
      if (unlistenStdout) unlistenStdout()
      if (unlistenExit) unlistenExit()
    }
  }, [refreshSkills, refreshDist])

  const handleBrowseDir = async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected) {
        setDirPath(selected)
      }
    } catch (e) {
      console.error('选择目录失败:', e)
    }
  }

  const handleSaveDir = async () => {
    if (!dirPath) return
    setSavingDir(true)
    try {
      await onSaveCentralDir(dirPath)
      setEditingDir(false)
      refreshSkills()
      refreshDist()
    } catch (e) {
      console.error('保存中央目录失败:', e)
    } finally {
      setSavingDir(false)
    }
  }

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkillName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await invoke('create_central_skill', {
        skillName: newSkillName.trim(),
        description: newSkillDesc.trim()
      })
      setNewSkillName('')
      setNewSkillDesc('')
      setShowCreateModal(false)
      refreshSkills()
      refreshDist()
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  // ── 启动命令行指令安装 ──
  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliCommand.trim()) return
    setRunningCmd(true)
    setConsoleLog(`> ${cliCommand.trim()}\n\n`)
    setConsoleVisible(true)
    try {
      await invoke('run_interactive_command', { commandLine: cliCommand.trim() })
    } catch (e) {
      setConsoleLog((prev) => prev + `[进程启动失败: ${e}]\n`)
      setRunningCmd(false)
    }
  }

  // ── 发送标准输入 ──
  const handleSendInput = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!runningCmd) return
    const text = inputValue
    try {
      setConsoleLog((prev) => prev + text + '\n')
      await invoke('send_command_input', { input: text + '\n' })
      setInputValue('')
    } catch (err) {
      setConsoleLog((prev) => prev + `\n[发送输入失败: ${err}]\n`)
    }
  }

  // ── 终止进程 ──
  const handleKillCommand = async () => {
    try {
      await invoke('kill_interactive_command')
    } catch (e) {
      console.error('终止命令进程失败:', e)
    }
  }

  const handleToggleLink = async (skillName: string, agentId: ToolId, currentStatus: SkillDistributionStatus) => {
    setActionError(null)
    try {
      if (currentStatus === 'linked') {
        await invoke('unlink_skill_from_agent', { toolId: agentId, skillName })
      } else if (currentStatus === 'unlinked') {
        await invoke('link_skill_to_agent', { toolId: agentId, skillName })
      }
      refreshDist()
    } catch (e) {
      setActionError(String(e))
    }
  }

  const handleDeleteSkill = (skillName: string) => {
    setDeleteTarget({ type: 'central', skillName })
  }

  const confirmDeleteSkill = async (target: DeleteTarget) => {
    await invoke('delete_central_skill', { skillName: target.skillName })
    refreshSkills()
    refreshDist()
    setDeleteTarget(null)
  }

  const handleOpenCentralDir = async () => {
    try {
      await invoke('open_central_dir')
    } catch (e) {
      alert(String(e))
    }
  }

  const handleOpenAgentDir = async (agentId: ToolId) => {
    try {
      await invoke('open_agent_dir', { toolId: agentId })
    } catch (e) {
      alert(String(e))
    }
  }

  // ── 备份还原操作 ──
  const handleToolBackup = async (toolId: string) => {
    setBackingTool(toolId)
    setBackupMessage((prev) => ({ ...prev, [toolId]: '' }))
    try {
      const path = await onBackup(toolId)
      setBackupMessage((prev) => ({ ...prev, [toolId]: `备份成功: ${path}` }))
    } catch (e) {
      setBackupMessage((prev) => ({ ...prev, [toolId]: `备份失败: ${e}` }))
    } finally {
      setBackingTool(null)
    }
  }

  const handleOpenRestore = async (toolId: string) => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected) {
        setRestoreTarget({ toolId: toolId as ToolId, backupPath: selected })
      }
    } catch (e) {
      console.error('选择还原备份目录失败:', e)
    }
  }

  const handleSaveToolPath = async (toolId: string) => {
    try {
      await onSaveCustomDir(toolId, toolPathValue)
      setEditToolPath(null)
      refreshSkills()
      refreshDist()
    } catch (e) {
      alert(String(e))
    }
  }

  return (
    <div className='flex flex-col h-full bg-gray-50 dark:bg-[#030712] overflow-hidden'>
      {/* 统一紧凑的顶部 Header */}
      <header data-tauri-drag-region className='px-4 pt-7 pb-2.5 border-b border-gray-200/50 dark:border-[#1f2937]/50 bg-transparent flex items-center justify-between shrink-0 select-none'>
        <div className='flex items-center gap-4 min-w-0'>
          <div className='flex items-center gap-2'>
            <h1 className='text-sm font-bold tracking-tight text-gray-900 dark:text-[#f9fafb] uppercase font-mono'>
              SkillsSync
            </h1>
            <span className='text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 font-mono'>
              v0.1.0
            </span>
          </div>

          {/* 工作目录选择 Popover */}
          <div className='relative'>
            <button
              onClick={() => setEditingDir(!editingDir)}
              className='px-2.5 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium transition-colors flex items-center gap-1 focus:outline-none'
            >
              <span className='truncate max-w-[150px] font-mono'>
                📁 {config?.centralSkillsDir ? config.centralSkillsDir.split('/').pop() : '配置中央目录'}
              </span>
              <span className='text-[9px] opacity-70'>{editingDir ? '▲' : '▼'}</span>
            </button>

            {editingDir && (
              <div className='absolute left-0 top-full mt-2 z-50 w-80 p-4 bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded shadow-xl'>
                <div className='flex items-center justify-between mb-2'>
                  <h4 className='text-sm font-bold text-gray-800 dark:text-gray-200'>
                    工作目录设置
                  </h4>
                  {isConfigured && (
                    <button
                      onClick={handleOpenCentralDir}
                      className='text-xs text-emerald-500 hover:text-emerald-600 dark:text-[#10b981] dark:hover:text-[#059669] font-medium focus:outline-none'
                    >
                      打开文件夹
                    </button>
                  )}
                </div>
                <div className='space-y-3'>
                  <input
                    type='text'
                    value={dirPath}
                    onChange={(e) => setDirPath(e.target.value)}
                    placeholder='/path/to/my-skills'
                    className='w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono'
                  />
                  <div className='flex gap-2'>
                    <button
                      onClick={handleBrowseDir}
                      className='flex-1 px-2.5 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors'
                    >
                      浏览...
                    </button>
                    <button
                      onClick={handleSaveDir}
                      disabled={savingDir || !dirPath}
                      className='flex-1 px-2.5 py-1.5 text-xs rounded bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors'
                    >
                      确定
                    </button>
                  </div>
                  <div className='text-[10px] text-gray-400 dark:text-gray-500 truncate'>
                    完整路径: {config?.centralSkillsDir || '未配置'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2.5 shrink-0'>
          {isConfigured && (
            <>
              {/* 终端控制台开启状态切换 */}
              <button
                onClick={() => setConsoleVisible(!consoleVisible)}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors flex items-center gap-1 ${
                  consoleVisible
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-gray-200 dark:border-[#1f2937] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                终端控制台
              </button>

              <button
                onClick={() => setShowAdvancedSettings(true)}
                className='px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 dark:border-[#1f2937] bg-white dark:bg-[#0b0f19] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors'
              >
                高级设置与备份
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className='px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 hover:bg-emerald-600 dark:bg-[#10b981] dark:hover:bg-[#059669] text-white dark:text-[#030712] transition-colors'
              >
                + 新建技能
              </button>
              <button
                onClick={() => { refreshSkills(); refreshDist() }}
                disabled={loadingSkills || loadingDist}
                className='px-3 py-1.5 text-xs font-medium rounded border border-gray-200 dark:border-[#1f2937] bg-white dark:bg-[#0b0f19] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors'
              >
                刷新
              </button>
              <button
                onClick={() => setSimpleMode(!simpleMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  simpleMode
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-[#1f2937] bg-white dark:bg-[#0b0f19] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                {simpleMode ? '简约 ✓' : '简约'}
              </button>
            </>
          )}
          <div className='w-[1px] h-4 bg-gray-200 dark:bg-[#1f2937]' />
          <button
            onClick={toggleDark}
            className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-[#f9fafb] rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Content Area - 满屏 Fluid，无纵向 overflow 溢出，整体不可滚 */}
      <div className='flex-1 flex flex-col overflow-hidden p-3 gap-3 min-h-0 bg-[#f9fafb] dark:bg-[#030712]'>
        
        {/* CLI 交互终端面板 - 可折叠，高度固定 */}
        {isConfigured && consoleVisible && (
          <div className='bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded-md p-3.5 flex flex-col gap-2.5 shrink-0'>
            <div className='flex items-center justify-between border-b border-gray-100 dark:border-[#1f2937] pb-2'>
              <h3 className='text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-1.5'>
                <span>💻 Terminal Console</span>
                {runningCmd && <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />}
              </h3>
              <div className='flex items-center gap-2'>
                {runningCmd && (
                  <button
                    onClick={handleKillCommand}
                    className='px-2 py-0.5 text-xs rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors font-mono'
                  >
                    强杀进程
                  </button>
                )}
                <button
                  onClick={() => setConsoleVisible(false)}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm'
                >
                  ×
                </button>
              </div>
            </div>

            <div className='flex gap-3 items-start'>
              <form onSubmit={handleRunCommand} className='flex-1 flex gap-2'>
                <div className='flex-1 relative'>
                  <span className='absolute left-2.5 top-2 text-xs font-mono text-gray-400'>$</span>
                  <input
                    type='text'
                    value={cliCommand}
                    onChange={(e) => setCliCommand(e.target.value)}
                    disabled={runningCmd}
                    placeholder='npx impeccable skills install'
                    className='w-full pl-6 pr-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono'
                  />
                </div>
                <button
                  type='submit'
                  disabled={runningCmd || !cliCommand.trim()}
                  className='px-3.5 py-1.5 text-sm rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 transition-colors'
                >
                  运行
                </button>
              </form>
            </div>

            {/* 终端输出区 */}
            <div className='relative bg-gray-950 dark:bg-black rounded border border-gray-800 p-2.5'>
              <pre
                ref={terminalRef}
                className='h-32 overflow-y-auto text-xs leading-relaxed text-gray-300 dark:text-emerald-400 font-mono whitespace-pre-wrap select-text'
              >
                {consoleLog || '等待命令执行...\n可以使用 `npx impeccable skills install` 交互式安装指定技能。'}
              </pre>
              
              {runningCmd && (
                <div className='mt-2 pt-2 border-t border-gray-900 flex gap-2 items-center'>
                  <form onSubmit={handleSendInput} className='flex-1 flex gap-2'>
                    <input
                      type='text'
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder='输入交互内容并按回车...'
                      className='flex-1 bg-transparent text-gray-200 font-mono text-xs focus:outline-none'
                    />
                    <button
                      type='submit'
                      className='px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-mono border border-gray-700'
                    >
                      发送
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 核心矩阵表格区域 - 撑满剩余高度，自滚动 */}
        <div className='flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded overflow-hidden'>
          <div className='px-4 py-2.5 border-b border-gray-100 dark:border-[#1f2937] flex items-center justify-between shrink-0 bg-white dark:bg-[#0b0f19]'>
            <h3 className='text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono flex items-center gap-2'>
              <span>📊 Skills Mounting & Sync Matrix</span>
              <span className='px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-600 dark:text-[#10b981] font-normal normal-case'>
                共 {skills.length} 个技能
              </span>
            </h3>
            {actionError && (
              <span className='text-xs text-red-500 truncate max-w-md bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-100 dark:border-red-900 animate-pulse'>
                错误: {actionError}
              </span>
            )}
          </div>

          <div className='flex-1 overflow-auto min-h-0 bg-white dark:bg-[#0b0f19]'>
            {loadingSkills ? (
              <div className='h-full flex flex-col justify-center items-center gap-2 text-gray-400 py-12'>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500' />
                <span className='text-sm'>正在加载技能列表...</span>
              </div>
            ) : skills.length === 0 ? (
              <div className='h-full flex flex-col justify-center items-center p-8 text-center text-gray-400'>
                <p className='text-sm mb-3'>
                  {isConfigured ? '中央技能目录里暂未发现任何技能' : '请先配置本地中央目录以管理技能'}
                </p>
                {isConfigured && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className='text-sm text-emerald-500 hover:text-emerald-600 dark:text-[#10b981] dark:hover:text-[#059669] font-bold'
                  >
                    创建首个技能 +
                  </button>
                )}
              </div>
            ) : (
              <table className='w-full border-collapse text-left text-sm text-gray-900 dark:text-[#f9fafb]'>
                <thead className='sticky top-0 z-10 border-b border-gray-100 dark:border-[#1f2937] shadow-[0_1px_0_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_0_0_rgba(31,41,55,1)] text-xs uppercase font-semibold text-gray-500 dark:text-gray-400'>
                  <tr>
                    <th scope='col' className={`px-4 py-3 font-semibold bg-gray-50 dark:bg-[#0b0f19] ${simpleMode ? 'w-2/5' : 'w-1/4'}`}>技能标识名 (点击详情)</th>
                    {!simpleMode && (
                      <th scope='col' className='px-4 py-3 font-semibold bg-gray-50 dark:bg-[#0b0f19] w-1/3'>技能描述</th>
                    )}
                    {AGENTS.map((agent) => (
                      <th key={agent.id} scope='col' className='px-2 py-3 text-center font-semibold bg-gray-50 dark:bg-[#0b0f19]'>
                        <div
                          className='flex min-h-8 items-center justify-center text-gray-700 dark:text-gray-200'
                          title={agent.label}
                        >
                          <AgentLogo toolId={agent.id} label={agent.label} />
                        </div>
                      </th>
                    ))}
                    <th scope='col' className='px-4 py-3 text-right font-semibold bg-gray-50 dark:bg-[#0b0f19]'>操作</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-[#1f2937] bg-white dark:bg-[#0b0f19]'>
                  {skills.map((skill) => {
                    const dist = distribution[skill.name] || {}
                    return (
                      <tr key={skill.name} className='hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors'>
                        <td className='px-4 py-2.5 font-medium'>
                          <button
                            onClick={() => setSelectedSkill(skill)}
                            className='hover:text-emerald-500 dark:hover:text-[#10b981] font-mono font-semibold text-left transition-colors truncate max-w-xs block text-sm'
                          >
                            {skill.name}
                          </button>
                          {!simpleMode && (
                            <div className='flex items-center gap-1.5 mt-1'>
                              {skill.hasScripts && (
                                <span className='text-[10px] px-1.5 py-0.5 font-mono rounded bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shrink-0'>
                                  scripts
                                </span>
                              )}
                              {skill.hasReferences && (
                                <span className='text-[10px] px-1.5 py-0.5 font-mono rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0'>
                                  refs
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        {!simpleMode && (
                          <td className='px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-normal leading-relaxed break-words max-w-xs'>
                            {skill.description || '暂无描述。'}
                          </td>
                        )}
                        {AGENTS.map((agent) => {
                          const status = dist[agent.id] || 'unlinked'
                          return (
                            <td key={agent.id} className='px-2 py-2.5 text-center'>
                              <div className='flex items-center justify-center'>
                                {status === 'conflict' ? (
                                  <div className='flex items-center gap-1'>
                                    <span
                                      className='text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 rounded cursor-help shrink-0'
                                      title='冲突：该 Agent 目录下已存在常规同名子目录，无法挂载软链。请点击右侧文件夹手动处理。'
                                    >
                                      冲突 ⚠
                                    </span>
                                    <button
                                      onClick={() => handleOpenAgentDir(agent.id)}
                                      className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded shrink-0'
                                      title='打开该 Agent 的 skills 目录以手动清理同名文件夹'
                                    >
                                      📁
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleToggleLink(skill.name, agent.id, status)}
                                    className={`group relative inline-flex h-5 w-9 items-center rounded-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                                      status === 'linked' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    title={status === 'linked' ? '点击卸载' : '点击挂载'}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 rounded-[2px] bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                        status === 'linked' ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                      }`}
                                    />
                                    {status === 'linked' && (
                                      <span className='absolute inset-0 rounded-sm shadow-[0_0_6px_rgba(16,185,129,0.35)] -z-10' />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        <td className='px-4 py-2.5 text-right'>
                          <button
                            onClick={() => handleDeleteSkill(skill.name)}
                            className='text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-0.5 rounded transition-colors font-medium font-mono'
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ── ADVANCED SETTINGS & BACKUPS MODAL ── */}
      {showAdvancedSettings && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'
          onClick={() => setShowAdvancedSettings(false)}
        >
          <div
            role='dialog'
            aria-modal='true'
            aria-labelledby='advanced-settings-title'
            className='bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='px-5 py-4 border-b border-gray-200 dark:border-[#1f2937] flex items-start justify-between gap-4'>
              <div>
                <h3 id='advanced-settings-title' className='text-sm font-bold text-gray-900 dark:text-gray-100'>
                  助理高级设置与备份
                </h3>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  管理各助理的技能目录，并执行备份或还原。
                </p>
              </div>
              <button
                type='button'
                onClick={() => setShowAdvancedSettings(false)}
                aria-label='关闭高级设置与备份'
                className='p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none'
              >
                ×
              </button>
            </div>

            <div className='flex-1 overflow-y-auto p-4 space-y-2'>
              {AGENTS.map((agent) => {
                const customDir = config?.customSkillsDirs?.[agent.id] ?? ''
                const isEditing = editToolPath === agent.id
                const displayPath = customDir || agent.defaultDir

                return (
                  <div key={agent.id} className='flex items-center justify-between gap-4 p-3 rounded border border-gray-200 dark:border-[#1f2937] bg-gray-50 dark:bg-gray-800/10 text-xs'>
                    <div className='flex-1 min-w-0'>
                      <h4 className='font-bold text-gray-800 dark:text-gray-200'>{agent.label}</h4>
                      {isEditing ? (
                        <div className='flex items-center gap-1.5 mt-2'>
                          <input
                            type='text'
                            value={toolPathValue}
                            onChange={(event) => setToolPathValue(event.target.value)}
                            aria-label={`${agent.label} 技能目录`}
                            className='flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono'
                          />
                          <button
                            onClick={() => handleSaveToolPath(agent.id)}
                            className='px-2.5 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded font-medium transition-colors'
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditToolPath(null)}
                            className='px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded transition-colors'
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className='flex items-center gap-1.5 mt-1.5 min-w-0'>
                          <span className='text-gray-400 shrink-0'>路径:</span>
                          <span className='font-mono text-gray-500 dark:text-gray-400 truncate' title={displayPath}>
                            {displayPath}
                          </span>
                          <button
                            onClick={() => {
                              setEditToolPath(agent.id)
                              setToolPathValue(displayPath)
                            }}
                            className='text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium shrink-0'
                          >
                            自定义
                          </button>
                        </div>
                      )}
                      {backupMessage[agent.id] && (
                        <p className='text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium'>
                          {backupMessage[agent.id]}
                        </p>
                      )}
                    </div>

                    <div className='flex items-center gap-1.5 shrink-0'>
                      <button
                        onClick={() => handleToolBackup(agent.id)}
                        disabled={backingTool === agent.id}
                        className='px-2.5 py-1 text-xs font-medium rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors'
                      >
                        {backingTool === agent.id ? '备份中...' : '备份'}
                      </button>
                      <button
                        onClick={() => handleOpenRestore(agent.id)}
                        className='px-2.5 py-1 text-xs font-medium rounded bg-amber-500 hover:bg-amber-600 text-white transition-colors'
                      >
                        还原
                      </button>
                      <button
                        onClick={() => handleOpenAgentDir(agent.id)}
                        className='px-2.5 py-1 text-xs font-medium rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors'
                      >
                        目录
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE SKILL MODAL ── */}
      {showCreateModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in'>
          <div className='bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded w-full max-w-md p-5 shadow-2xl relative'>
            <button
              onClick={() => setShowCreateModal(false)}
              className='absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold'
            >
              ×
            </button>
            <h3 className='text-sm font-bold text-gray-800 dark:text-gray-100 mb-3 uppercase tracking-wider font-mono'>
              新建通用技能
            </h3>
            <form onSubmit={handleCreateSkill} className='space-y-3'>
              <div>
                <label className='block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase font-mono'>
                  技能标识名 (英文字母/破折号)
                </label>
                <input
                  type='text'
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  disabled={creating}
                  placeholder='git-commit-helper'
                  required
                  className='w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono disabled:opacity-50'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase font-mono'>
                  技能描述 (一句话介绍)
                </label>
                <textarea
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  disabled={creating}
                  placeholder='描述此技能的 Instruction 功能。'
                  rows={2}
                  className='w-full px-2.5 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 resize-none'
                />
              </div>
              {createError && (
                <div className='text-xs text-red-500 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-100 dark:border-red-900'>
                  {createError}
                </div>
              )}
              <div className='flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1f2937]'>
                <button
                  type='button'
                  onClick={() => setShowCreateModal(false)}
                  className='px-3.5 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                >
                  取消
                </button>
                <button
                  type='submit'
                  disabled={creating || !newSkillName.trim()}
                  className='px-3.5 py-1.5 text-sm rounded bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-50 transition-colors'
                >
                  {creating ? '创建中...' : '提交创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SKILL DETAIL MODAL ── */}
      {selectedSkill && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
          <div className='bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-[#1f2937] rounded w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative'>
            <SkillDetail
              skill={selectedSkill}
              onBack={() => setSelectedSkill(null)}
              syncStatus={undefined}
              repoPath={undefined}
            />
          </div>
        </div>
      )}

      {/* ── RESTORE DIALOG MODAL ── */}
      {restoreTarget && (
        <RestoreDialog
          toolId={restoreTarget.toolId}
          backupPath={restoreTarget.backupPath}
          onConfirm={() => { setRestoreTarget(null); refreshSkills() }}
          onCancel={() => setRestoreTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationDialog
          target={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteSkill}
        />
      )}
    </div>
  )
}
