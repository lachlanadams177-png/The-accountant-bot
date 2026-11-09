import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, MessageCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useClient } from '../store/hooks'
import { cn } from '../lib/cn'
import { EmptyState } from '../components/ui/misc'

const TABS = [
  { to: '/client', label: 'Home', icon: Home, end: true },
  { to: '/client/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/client/progress', label: 'Progress', icon: TrendingUp },
  { to: '/client/messages', label: 'Messages', icon: MessageCircle },
]

/** Mobile-first client app. On a laptop it shows as a phone-width column. */
export function ClientLayout() {
  const { pathname } = useLocation()
  const clientId = useStore((s) => s.demoClientId)
  const client = useClient(clientId)
  const unread = useStore((s) => s.messages.filter((m) => m.clientId === clientId && m.from === 'trainer' && !m.read).length)
  const inWorkout = pathname.startsWith('/client/workout/')
  const inChat = pathname === '/client/messages'

  return (
    <div className="min-h-[calc(100vh-44px)] sm:py-6 bg-[#eeece6]">
      <div className="relative mx-auto w-full max-w-[440px] min-h-[calc(100vh-44px)] sm:min-h-0 sm:h-[min(880px,calc(100vh-92px))] bg-canvas sm:rounded-[28px] sm:border sm:border-line sm:shadow-lift flex flex-col sm:overflow-hidden">
        <div id="client-scroll" className={cn('flex-1 animate-fade-in sm:overflow-y-auto sm:min-h-0', !inWorkout && !inChat && 'pb-24 sm:pb-4')} key={pathname}>
          {client ? <Outlet /> : <EmptyState title="No client selected" text="Choose a client from the Demo bar above." />}
        </div>
        {!inWorkout && (
          <nav aria-label="Client" className="fixed sm:static bottom-0 inset-x-0 mx-auto w-full max-w-[440px] z-30 border-t border-line bg-white/95 backdrop-blur pb-safe sm:rounded-b-[28px]">
            <div className="grid grid-cols-4">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-1 h-16 text-xs font-medium', isActive ? 'text-sage-700' : 'text-muted')}>
                  {({ isActive }) => (
                    <>
                      <t.icon size={22} strokeWidth={isActive ? 2.3 : 1.9} />
                      {t.label}
                      {t.label === 'Messages' && unread > 0 && <span className="absolute top-2 left-1/2 ml-2.5 h-4 min-w-4 rounded-full bg-sage-600 px-1 text-[10px] text-white inline-flex items-center justify-center">{unread}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
