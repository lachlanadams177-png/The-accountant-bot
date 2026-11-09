import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import type { SessionState } from '../../lib/stats'

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children?: ReactNode; as?: 'div' | 'section' | 'article' } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={cn('bg-white rounded-2xl border border-line/70 shadow-card', className)} {...rest}>
      {children}
    </As>
  )
}

export function CardHeader({ title, action, subtitle, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={17} className="text-sage-600 shrink-0" />}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ name, color = '#3f826d', size = 36, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color + '1f', color }}
    >
      {initials(name)}
    </span>
  )
}

const pill: Record<string, string> = {
  green: 'bg-done-bg text-done',
  red: 'bg-miss-bg text-miss',
  blue: 'bg-plan-bg text-plan',
  purple: 'bg-appt-bg text-appt',
  amber: 'bg-warn-bg text-warn',
  grey: 'bg-stone-100 text-ink-soft',
  sage: 'bg-sage-50 text-sage-700',
}
export function Badge({ tone = 'grey', children, className, icon: Icon }: { tone?: keyof typeof pill; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', pill[tone], className)}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  )
}

export const stateTone: Record<SessionState, keyof typeof pill> = {
  completed: 'green',
  missed: 'red',
  today: 'sage',
  upcoming: 'blue',
  appointment: 'purple',
}
export const stateLabel: Record<SessionState, string> = {
  completed: 'Completed',
  missed: 'Missed',
  today: 'Today',
  upcoming: 'Scheduled',
  appointment: 'Appointment',
}

export function EmptyState({ icon: Icon, title, text, action, className }: { icon?: LucideIcon; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-10', className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-50 text-sage-600">
          <Icon size={22} />
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl bg-stone-200/60 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all',
              size === 'sm' ? 'px-2.5 h-7 text-[13px]' : 'px-3.5 h-8 text-sm',
              active ? 'bg-white text-ink shadow-card' : 'text-ink-soft hover:text-ink',
            )}
          >
            {o.icon && <o.icon size={15} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative -mb-px px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
            t.value === value ? 'border-sage-600 text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-xs text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Small dropdown menu. Items close it on click. */
export function Menu({ trigger, items, align = 'right' }: { trigger: (p: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode; items: ({ label: string; icon?: LucideIcon; onClick: () => void; danger?: boolean } | 'divider')[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open })}
      {open && (
        <div role="menu" className={cn('absolute z-40 mt-1 min-w-[200px] rounded-xl border border-line bg-white p-1 shadow-pop animate-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={() => { setOpen(false); it.onClick() }}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100', it.danger ? 'text-miss' : 'text-ink')}
              >
                {it.icon && <it.icon size={16} className={it.danger ? '' : 'text-muted'} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-stone-200/70 overflow-hidden', className)}>
      <div className="h-full rounded-full bg-sage-500 transition-all" style={{ width: `${value ?? 0}%` }} />
    </div>
  )
}
