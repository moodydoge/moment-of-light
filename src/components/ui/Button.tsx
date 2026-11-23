import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'human' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-action)] text-[var(--color-action-ink)] hover:opacity-92 active:scale-[0.98]',
  secondary:
    'bg-[var(--color-muted-bg)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[var(--color-card)]',
  ghost:
    'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-muted-bg)]',
  human:
    'bg-[var(--color-human)] text-white hover:opacity-92 active:scale-[0.98]',
  danger:
    'bg-transparent text-[#8B3A3A] border border-[#D7B1B1] hover:bg-[#F8ECEC] dark:text-[#E8B4B4] dark:border-[#5A3A3A] dark:hover:bg-[#3A2A2A]',
}

export function Button({
  className,
  variant = 'primary',
  fullWidth,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition motion-safe-only disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
