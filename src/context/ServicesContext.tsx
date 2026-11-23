import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createAppServices, type MomentServices } from '../services/createAppServices'

const ServicesContext = createContext<MomentServices | null>(null)

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<MomentServices | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void createAppServices()
      .then((next) => {
        if (!cancelled) setServices(next)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '服务初始化失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-page)] px-5 text-[var(--color-ink)]">
        <p role="alert">无法初始化服务：{error}</p>
      </div>
    )
  }

  if (!services) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-page)] px-5 text-[var(--color-ink-soft)]">
        <p>正在准备陪伴服务…</p>
      </div>
    )
  }

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  )
}

export function useServices(): MomentServices {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used within ServicesProvider')
  return ctx
}
