import { Link } from 'react-router-dom'
import { SafetyNotice } from '../components/safety/SafetyNotice'
import { Button } from '../components/ui/Button'

export function HomePage() {
  return (
    <div className="page-enter space-y-10">
      <section className="pt-4">
        <p className="mb-3 text-sm tracking-wide text-[var(--color-ink-soft)]">此刻有光</p>
        <h1 className="font-display text-[1.85rem] leading-snug text-[var(--color-ink)] sm:text-[2.15rem]">
          这一刻，你想怎么待着？
        </h1>
        <p className="mt-3 max-w-prose text-[var(--color-ink-soft)]">
          可以先和 AI 聊聊，也可以看看社区里留下的善意。
        </p>
      </section>

      <section className="grid gap-3" aria-label="主要入口">
        <Link
          to="/start"
          className="group rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 transition motion-safe-only hover:-translate-y-0.5 hover:border-[var(--color-action)]/40"
        >
          <div className="text-lg font-medium text-[var(--color-ink)]">先聊一会儿</div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            先与 AI 轻松交流。是否邀请真人，由你之后决定。
          </p>
        </Link>

        <Link
          to="/kindness"
          className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5 transition motion-safe-only hover:-translate-y-0.5 hover:border-[var(--color-human)]/40"
        >
          <div className="text-lg font-medium text-[var(--color-ink)]">看看善意</div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            查看当前可响应的匿名陪伴请求，自主选择是否参与。
          </p>
        </Link>
      </section>

      <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-human)]/40 bg-[var(--color-human)]/8 p-5">
        <h2 className="text-base font-medium text-[var(--color-human)]">我愿意陪伴</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          如果你有 5—10 分钟，可以看看社区里开放中的请求。不催促，也不强制。
        </p>
        <div className="mt-4">
          <Link to="/kindness">
            <Button variant="human">去看看善意</Button>
          </Link>
        </div>
      </section>

      <SafetyNotice />

      <p className="text-xs text-[var(--color-ink-soft)]">
        AI
        可通过服务端代理接入真实大模型（需配置密钥）；未配置时使用明确标注的演示适配器。真人匹配仍为演示，不伪造真实在线人数。
      </p>
    </div>
  )
}
