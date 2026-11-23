export function SafetyNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm text-[var(--color-ink-soft)]">
        自主选择 · 随时退出 · AI 与真人身份明确区分 · 非专业心理咨询或紧急援助
      </p>
    )
  }

  return (
    <section
      aria-label="陪伴约定"
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-card)] p-5"
    >
      <h2 className="mb-2 text-base font-medium text-[var(--color-ink)]">陪伴约定</h2>
      <ul className="space-y-1.5 text-sm text-[var(--color-ink-soft)]">
        <li>是否参与、是否邀请真人，都由你自主选择。</li>
        <li>不需要建立或维持长期关系，随时可以退出。</li>
        <li>AI 陪伴与真人参与者会明确标注，不会互相伪装。</li>
        <li>这不是专业心理咨询，也不是紧急援助服务。</li>
        <li>若你或他人处于危机，请寻求当地紧急求助渠道。</li>
      </ul>
    </section>
  )
}
