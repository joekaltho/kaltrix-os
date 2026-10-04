import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ComponentProps } from 'react'

// One button system. Rule of thumb for screens: exactly one `primary` per
// view (the thing most users come to do), everything else `secondary`/`ghost`.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brandDim text-white hover:bg-[#15803d]',
  secondary: 'bg-surface text-ink border border-border hover:bg-ivoryDim',
  ghost: 'text-inkMid hover:bg-ivoryDim hover:text-ink',
  danger: 'text-danger hover:bg-dangerBg',
  link: 'text-brandText hover:underline px-0 h-auto',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
}

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  full = false,
  className = '',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  className?: string
}) {
  const sizeClass = variant === 'link' ? 'text-sm' : sizes[size]
  return `${base} ${variants[variant]} ${sizeClass} ${full ? 'w-full' : ''} ${className}`.trim()
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  loading?: boolean
}

export function Button({ variant, size, full, loading, className, disabled, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, full, className })}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
}

export function ButtonLink({ variant, size, full, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, full, className })} {...props} />
}
