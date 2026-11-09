import { Link } from 'react-router-dom'
import { BRAND } from '../theme'
import { cn } from '../lib/cn'

export const APP_NAME = BRAND.name

/**
 * Placeholder dumbbell mark — swap for the real Muscle Up logo when it's supplied.
 * `inverted` = white mark for dark backgrounds.
 */
export function LogoMark({ size = 30, inverted }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? '#ffffff' : '#111111'
  const fg = inverted ? '#111111' : '#ffffff'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill={bg} />
      <g fill={fg}>
        <rect x="6" y="11" width="3.2" height="10" rx="1.2" />
        <rect x="9.6" y="9" width="3.2" height="14" rx="1.2" />
        <rect x="19.2" y="9" width="3.2" height="14" rx="1.2" />
        <rect x="22.8" y="11" width="3.2" height="10" rx="1.2" />
        <rect x="12.8" y="14.6" width="6.4" height="2.8" rx="1" />
      </g>
    </svg>
  )
}

export function Logo({ compact, inverted, to = '/' }: { compact?: boolean; inverted?: boolean; to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-3" aria-label={`${APP_NAME} home`}>
      <LogoMark size={compact ? 32 : 38} inverted={inverted} />
      {!compact && (
        <span className="flex flex-col">
          <span className={cn('text-[19px] font-extrabold uppercase leading-none tracking-[0.04em]', inverted ? 'text-white' : 'text-ink')}>{BRAND.short}</span>
          <span className={cn('mt-1.5 whitespace-nowrap text-[9.5px] font-semibold uppercase leading-none tracking-[0.1em]', inverted ? 'text-sidebar-muted' : 'text-muted')}>{BRAND.tagline}</span>
        </span>
      )}
    </Link>
  )
}
