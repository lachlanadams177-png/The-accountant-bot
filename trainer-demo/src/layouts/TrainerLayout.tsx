import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Dumbbell, LayoutGrid, MessageCircle, Settings, Users, ClipboardList, Zap, ChevronDown, RotateCcw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUi } from '../store/ui'
import { Avatar, Menu } from '../components/ui/misc'
import { cn } from '../lib/cn'
import { GlobalSearch } from './GlobalSearch'
import { Logo } from './Logo'
import { confirm } from '../components/ui/confirm'
import { toast } from '../components/ui/toast'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, match: (p: string) => p === '/' },
  { to: '/clients', label: 'Clients', icon: Users, match: (p: string) => p.startsWith('/clients') },
  { to: '/programs', label: 'Programs', icon: ClipboardList, match: (p: string) => p.startsWith('/programs') || p.startsWith('/workouts') },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell, match: (p: string) => p.startsWith('/exercises') },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, match: (p: string) => p.startsWith('/calendar') },
  { to: '/messages', label: 'Messages', icon: MessageCircle, match: (p: string) => p.startsWith('/messages') },
]

export function useResetDemo() {
  const resetDemo = useStore((s) => s.resetDemo)
  const navigate = useNavigate()
  return async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'This puts back the original example clients, programs, workouts and history. Anything you have added or changed will be removed.',
      confirmLabel: 'Reset demo data',
      danger: true,
    })
    if (!ok) return
    resetDemo()
    navigate('/')
    toast.success('Demo data has been reset')
  }
}

export function TrainerLayout() {
  const { pathname } = useLocation()
  const trainer = useStore((s) => s.trainer)
  const unread = useStore((s) => s.messages.filter((m) => m.from === 'client' && !m.read && s.clients.some((c) => c.id === m.clientId && c.status === 'active')).length)
  const openQuick = useUi((s) => s.openQuickSession)
  const navigate = useNavigate()
  const reset = useResetDemo()

  const profileMenu = (dark: boolean) => (
    <Menu
      trigger={(p) => (
        <button {...p} className={cn('flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors', dark ? 'hover:bg-sidebar-active' : 'hover:bg-black/[0.04]')} aria-label="Profile menu">
          <Avatar name={trainer.name} size={32} dark={dark} />
          {dark && (
            <span className="text-left leading-tight">
              <span className="block text-sm font-medium text-white">{trainer.name}</span>
              <span className="block text-[11px] text-sidebar-muted">Head coach</span>
            </span>
          )}
          {dark && <ChevronDown size={15} className="text-sidebar-muted" />}
        </button>
      )}
      items={[
        { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
        'divider',
        { label: 'Reset demo data', icon: RotateCcw, onClick: reset, danger: true },
      ]}
    />
  )

  return (
    <div className="flex min-h-[calc(100vh-44px)]">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-text sticky top-11 h-[calc(100vh-44px)]">
        <div className="px-5 pt-6 pb-5">
          <Logo inverted />
        </div>
        <div className="px-4 pb-4">
          <button onClick={() => openQuick()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 h-11 text-sm font-semibold text-ink hover:bg-[#ececec] active:scale-[0.98] transition-all">
            <Zap size={17} /> Quick Session
          </button>
        </div>
        <p className="px-7 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/70">Menu</p>
        <nav className="flex-1 px-4 space-y-0.5" aria-label="Main">
          {NAV.map((n) => {
            const active = n.match(pathname)
            return (
              <NavLink key={n.to} to={n.to} aria-current={active ? 'page' : undefined} className={cn('relative flex items-center gap-3 rounded-xl px-3 h-10 text-[14.5px] font-medium transition-colors', active ? 'bg-sidebar-active text-white' : 'text-white/85 hover:bg-sidebar-raised hover:text-white')}>
                {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-white" aria-hidden />}
                <n.icon size={18} className={active ? 'text-white' : 'text-sidebar-muted'} />
                <span className="flex-1">{n.label}</span>
                {n.label === 'Messages' && unread > 0 && <span className="min-w-5 h-5 rounded-full bg-white px-1.5 text-[11px] font-bold text-ink inline-flex items-center justify-center">{unread}</span>}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-sidebar-line px-3 py-3 flex items-center justify-between">
          {profileMenu(true)}
          <NavLink to="/settings" aria-label="Settings" className="p-2 rounded-lg text-sidebar-muted hover:text-white hover:bg-sidebar-active"><Settings size={17} /></NavLink>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-11 z-30 bg-canvas/90 backdrop-blur border-b border-line">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden"><Logo compact /></div>
            <GlobalSearch className="flex-1 max-w-md" />
            <span className="flex-1 hidden sm:block" />
            <button onClick={() => openQuick()} className="lg:hidden inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 h-10 text-sm font-semibold text-white" aria-label="Quick Session">
              <Zap size={16} /> <span className="hidden sm:inline">Quick Session</span>
            </button>
            <div className="lg:hidden">{profileMenu(false)}</div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-28 lg:pb-10 animate-fade-in" key={pathname.split('/')[1]}>
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom nav — mobile & tablet */}
      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-white/95 backdrop-blur pb-safe">
        <div className="grid grid-cols-6">
          {NAV.map((n) => {
            const active = n.match(pathname)
            return (
              <NavLink key={n.to} to={n.to} className={cn('relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium', active ? 'text-ink font-semibold' : 'text-muted')}>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full bg-ink" aria-hidden />}
                <n.icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                {n.label}
                {n.label === 'Messages' && unread > 0 && <span className="absolute top-2 left-1/2 ml-2 h-4 min-w-4 rounded-full bg-ink px-1 text-[10px] text-white inline-flex items-center justify-center">{unread}</span>}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
