import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type ThemeMode = 'light' | 'dark' | 'auto'

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return mode === 'dark'
}

function applyTheme(mode: ThemeMode) {
  const dark = resolveDark(mode)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const initial: ThemeMode =
      stored === 'light' || stored === 'dark' ? stored : 'auto'
    setMode(initial)
    applyTheme(initial)
  }, [])

  const cycle = () => {
    const next: ThemeMode =
      mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light'
    setMode(next)
    applyTheme(next)
    localStorage.setItem('theme', next)
  }

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  const label = `Theme: ${mode}. Click to switch.`

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
