import { Link, Outlet } from 'react-router-dom'
import { useCompanion } from '../../context/CompanionContext'
import { useServices } from '../../context/ServicesContext'
import { useTheme } from '../../context/ThemeContext'
import { Button } from '../ui/Button'

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const { ai, aiStatus } = useServices()
  const companion = useCompanion()

  const badge =
    ai.kind === 'live'
      ? `真实 AI${aiStatus.model ? ` · ${aiStatus.model}` : ''}`
      : 'AI 演示'
  const humanBadge =
    companion.status?.kind === 'live-controlled' ? '真人受控试点' : null

  return (
    <div className="min-h-dvh bg-[var(--color-page)] text-[var(--color-ink)]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(182,90,58,0.06),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(86,114,96,0.07),_transparent_45%)]"
      />
      <header className="relative z-10 border-b border-[var(--color-line)]/80">
        <div className="mx-auto flex max-w-[680px] items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="font-display text-lg tracking-wide text-[var(--color-ink)]">
            此刻有光
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-muted-bg)] px-3 py-1 text-xs text-[var(--color-ink-soft)]">
              {badge}
            </span>
            {humanBadge ? (
              <span className="rounded-full bg-[var(--color-human)]/15 px-3 py-1 text-xs text-[var(--color-human)]">
                {humanBadge}
              </span>
            ) : null}
            <Button
              variant="ghost"
              className="px-3 text-sm"
              onClick={toggleTheme}
              aria-label="切换日间/夜间主题"
            >
              {theme === 'light' ? '夜间' : '日间'}
            </Button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[680px] px-5 py-6 pb-28">
        <Outlet />
      </main>
    </div>
  )
}
