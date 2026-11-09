import { Link } from 'react-router-dom'

export const APP_NAME = 'Muscle up, strength and conditioning'

/** Dumbbell mark */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#3f826d" />
      <g fill="#fff">
        <rect x="6" y="11" width="3.2" height="10" rx="1.2" />
        <rect x="9.6" y="9" width="3.2" height="14" rx="1.2" />
        <rect x="19.2" y="9" width="3.2" height="14" rx="1.2" />
        <rect x="22.8" y="11" width="3.2" height="10" rx="1.2" />
        <rect x="12.8" y="14.6" width="6.4" height="2.8" rx="1" />
      </g>
    </svg>
  )
}

export function Logo({ compact, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <LogoMark size={compact ? 30 : 34} />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-[18px] font-semibold tracking-tight">Muscle up</span>
          <span className="text-[12px] font-medium text-muted">strength and conditioning</span>
        </span>
      )}
    </Link>
  )
}
