import { useState, useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'
import { invoke } from '@tauri-apps/api/core'
import { useSkills, useConfig } from './hooks/useSkills'
import { CentralPage } from './components/CentralPage'

function App() {
  const { config, saveCentralDir, saveCustomDir, saveWindowState, saveDarkMode } = useConfig()
  
  // 直接加载中央目录的技能
  const { skills, loading, refresh: refreshSkills } = useSkills('central')
  
  const [dark, setDark] = useState(false)
  const initialized = useRef(false)
  const darkInitialized = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 首次加载应用时应用配置
  useEffect(() => {
    if (!config || initialized.current) return
    initialized.current = true

    // 应用暗色模式
    if (config.darkMode) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }

    // 应用窗口尺寸和位置
    const win = getCurrentWindow()
    if (config.windowWidth > 0 && config.windowHeight > 0) {
      win.setSize(new LogicalSize(config.windowWidth, config.windowHeight))
    }
    if (config.windowX !== null && config.windowY !== null) {
      win.setPosition(new LogicalPosition(config.windowX, config.windowY))
    }
  }, [config])

  // 监听窗口大小改变和移动，防抖保存窗口状态
  useEffect(() => {
    const win = getCurrentWindow()

    const saveWindow = async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(async () => {
        try {
          const scaleFactor = await win.scaleFactor()
          const size = await win.innerSize()
          const logicalSize = size.toLogical(scaleFactor)
          const pos = await win.outerPosition()
          const logicalPos = pos.toLogical(scaleFactor)
          await saveWindowState(logicalSize.width, logicalSize.height, logicalPos.x, logicalPos.y)
        } catch (e) {
          console.error('保存窗口状态失败:', e)
        }
      }, 500)
    }

    const unlistenResize = win.onResized(() => saveWindow())
    const unlistenMove = win.onMoved(() => saveWindow())

    return () => {
      unlistenResize.then(fn => fn())
      unlistenMove.then(fn => fn())
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [saveWindowState])

  const toggleDark = () => {
    setDark((d) => !d)
  }

  // 监听暗色模式状态改变并持久化
  useEffect(() => {
    if (!darkInitialized.current) {
      darkInitialized.current = true
      return
    }
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    saveDarkMode(dark)
  }, [dark, saveDarkMode])

  const handleBackup = async (toolId: string) => {
    return await invoke<string>('backup_skills', { toolId })
  }

  return (
    <div className='h-screen flex flex-col bg-white dark:bg-[#030712] text-gray-900 dark:text-gray-100'>
      <main className='flex-1 overflow-hidden flex flex-col'>
        <CentralPage
          config={config}
          onSaveCentralDir={saveCentralDir}
          onSaveCustomDir={saveCustomDir}
          onBackup={handleBackup}
          skills={skills}
          loadingSkills={loading}
          refreshSkills={refreshSkills}
          dark={dark}
          toggleDark={toggleDark}
        />
      </main>
    </div>
  )
}

export default App
