import { useEffect, useRef, useState } from 'react'

import { getDeleteImpact, type DeleteTarget } from './deleteConfirmation'

interface Props {
  target: DeleteTarget
  onCancel: () => void
  onConfirm: (target: DeleteTarget) => Promise<void>
}

export function DeleteConfirmationDialog({ target, onCancel, onConfirm }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleting, onCancel])

  const handleConfirm = async () => {
    if (deleting) return

    setDeleting(true)
    setError(null)
    try {
      await onConfirm(target)
    } catch (err) {
      setError(String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel()
        }
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='delete-dialog-title'
        aria-describedby='delete-dialog-description'
        className='w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-[#1f2937] dark:bg-[#0b0f19]'
      >
        <div className='flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-[#1f2937]'>
          <div className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'>
            <svg aria-hidden='true' viewBox='0 0 24 24' fill='none' className='h-4 w-4'>
              <path d='M12 8v5m0 3h.01M10.3 4.7 3.4 17a2 2 0 0 0 1.75 3h13.7a2 2 0 0 0 1.75-3L13.7 4.7a2 2 0 0 0-3.4 0Z' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </div>
          <div className='min-w-0'>
            <h2 id='delete-dialog-title' className='text-sm font-semibold text-gray-900 dark:text-[#f9fafb]'>
              确认删除技能
            </h2>
            <p id='delete-dialog-description' className='mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300'>
              {getDeleteImpact(target)}
            </p>
          </div>
        </div>

        <div className='px-5 py-4'>
          <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>即将删除</p>
          <div className='mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 font-mono text-sm font-semibold text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-300'>
            {target.skillName}
          </div>

          {error && (
            <div role='alert' className='mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-300'>
              删除失败：{error}
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-[#1f2937]'>
          <button
            ref={cancelButtonRef}
            type='button'
            onClick={onCancel}
            disabled={deleting}
            className='rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
          >
            取消
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={deleting}
            className='min-w-24 rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-red-900/50 disabled:text-red-200/60 dark:focus-visible:ring-offset-[#0b0f19]'
          >
            {deleting ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}
