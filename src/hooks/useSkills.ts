import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Skill, AppConfig, ToolId, SkillsDistributionMap } from '../types'

export function useSkills(toolId: ToolId) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<Skill[]>('get_skills', { toolId })
      setSkills(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [toolId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { skills, loading, error, refresh }
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)

  const refresh = useCallback(async () => {
    const result = await invoke<AppConfig>('get_config')
    setConfig(result)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveCentralDir = useCallback(async (centralSkillsDir: string) => {
    await invoke('save_config', { centralSkillsDir })
    await refresh()
  }, [refresh])

  const saveCustomDir = useCallback(async (toolId: string, path: string) => {
    await invoke('save_custom_dir', { toolId, path })
    await refresh()
  }, [refresh])

  const saveWindowState = useCallback(async (width: number, height: number, x: number, y: number) => {
    await invoke('save_window_state', { width, height, x, y })
  }, [])

  const saveDarkMode = useCallback(async (dark: boolean) => {
    await invoke('save_dark_mode', { dark })
    await refresh()
  }, [refresh])

  const saveActiveTab = useCallback(async (tab: string) => {
    await invoke('save_active_tab', { tab })
    await refresh()
  }, [refresh])

  return { config, saveCentralDir, saveCustomDir, saveWindowState, saveDarkMode, saveActiveTab, refresh }
}

export function useSkillsDistributionStatus() {
  const [distribution, setDistribution] = useState<SkillsDistributionMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<SkillsDistributionMap>('get_skills_distribution_status')
      setDistribution(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { distribution, loading, error, refresh }
}
