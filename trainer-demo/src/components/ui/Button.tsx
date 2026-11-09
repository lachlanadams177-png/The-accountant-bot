import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]'
const variants: Record<Variant, string> = {
  primary: 'bg-sage-600 text-white hover:bg-sage-700 shadow-[0_1px_2px_rgba(0,0,0,0.12)]',
  secondary: 'bg-white text-ink border border-line hover:border-line-strong hover:bg-stone-50 shadow-card',
  ghost: 'text-ink-soft hover:bg-black/[0.04] hover:text-ink',
  danger: 'bg-miss text-white hover:bg-[#9c3b30]',
  soft: 'bg-sage-50 text-sage-700 hover:bg-sage-100',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, className, children, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 15 : 17
  return (
    <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden />}
      {children}
      {IconR && <IconR size={iconSize} strokeWidth={2} aria-hidden />}
    </button>
  )
})

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden />}
      {children}
    </Link>
  )
}

export function IconButton({
  icon: Icon,
  label,
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-black/[0.05] transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 18} aria-hidden />
    </button>
  )
}
