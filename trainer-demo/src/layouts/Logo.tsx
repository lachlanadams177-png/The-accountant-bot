import { Link } from 'react-router-dom'

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#3f826d" />
      <path d="M10 22c0-7 5-12 12-12-1 7-5 12-12 12Zm0 0 6-6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ compact, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="Fernly home">
      <LogoMark />
      {!compact && <span className="text-[19px] font-semibold tracking-tight">Fernly</span>}
    </Link>
  )
}
