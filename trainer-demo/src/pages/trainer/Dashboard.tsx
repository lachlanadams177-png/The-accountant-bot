import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, ClipboardCheck, FilePlus2, MessageCircle,
  UserPlus, Users, Zap, CalendarClock, Activity, Inbox, UserRoundPlus, Scale,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/ui'
import { useClientMap, useWorkoutMap } from '../../store/hooks'
import { Avatar, Badge, Card, CardHeader, EmptyState, stateLabel, stateTone } from '../../components/ui/misc'
import { SessionModal } from '../../components/AssignDialogs'
import { toast } from '../../components/ui/toast'
import { activityFeed, attentionList, conversations, sessionState, weekStats } from '../../lib/stats'
import { fmtClock, fmtLong, greeting, timeAgo, today } from '../../lib/date'
import { cn } from '../../lib/cn'

export function Dashboard() {
  const data = useStore()
  const navigate = useNavigate()
  const openQuick = useUi((s) => s.openQuickSession)
  const setAddClientOpen = useUi((s) => s.setAddClientOpen)
  const clients = useClientMap()
  const workouts = useWorkoutMap()
  const [openSession, setOpenSession] = useState<string | null>(null)
  const t = today()

  const active = data.clients.filter((c) => c.status === 'active')
  const activeIds = new Set(active.map((c) => c.id))
  const week = weekStats(data.sessions.filter((s) => activeIds.has(s.clientId)))
  const attention = useMemo(() => attentionList(data), [data])
  const attentionClients = new Set(attention.map((a) => a.client.id)).size
  const feed = useMemo(() => activityFeed(data, 8), [data])
  const todays = data.sessions
    .filter((s) => s.date === t && activeIds.has(s.clientId))
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const recentDone = data.completions
    .filter((c) => c.date >= t || c.completedAt.slice(0, 10) === t)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  const convos = conversations(data.messages, active).filter((c) => c.unreadForTrainer > 0)
  const checkIns = data.progress.filter((p) => p.checkIn && !p.reviewed && activeIds.has(p.clientId))

  const stats = [
    { label: 'Active clients', value: active.length, icon: Users, to: '/clients' },
    { label: 'Workouts this week', value: week.scheduled, icon: CalendarDays, to: '/calendar' },
    { label: 'Completed this week', value: week.completed, icon: CheckCircle2, to: '/calendar', sub: week.pct != null ? `${week.pct}%` : undefined },
    { label: 'Need attention', value: attentionClients, icon: AlertCircle, to: '#attention', warn: attentionClients > 0 },
  ]

  const actions = [
    { label: 'Quick Session', icon: Zap, onClick: () => openQuick(), primary: true },
    { label: 'Add Client', icon: UserPlus, onClick: () => setAddClientOpen(true) },
    { label: 'Create Workout', icon: FilePlus2, onClick: () => navigate('/workouts/new') },
    { label: 'Create Program', icon: ClipboardList, onClick: () => navigate('/programs/new') },
    { label: 'View Calendar', icon: CalendarDays, onClick: () => navigate('/calendar') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{fmtLong(t)}</p>
        <h1 className="mt-1 text-[28px] sm:text-[32px] font-semibold tracking-tight">{greeting()}, {data.trainer.name.split(' ')[0]}</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Here’s what’s happening with your clients today.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((a) => (
          <button key={a.label} onClick={a.onClick}
            className={cn('group flex items-center gap-3 rounded-2xl px-4 h-16 text-left font-medium transition-all active:scale-[0.98]',
              a.primary ? 'bg-sage-600 text-white hover:bg-sage-700 shadow-lift col-span-2 sm:col-span-1' : 'bg-white border border-line/70 shadow-card hover:shadow-lift hover:border-line-strong')}>
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', a.primary ? 'bg-white/15' : 'bg-sage-50 text-sage-600')}><a.icon size={18} /></span>
            <span className="text-[14.5px]">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-muted leading-snug">{s.label}</span>
                <s.icon size={17} className={"shrink-0 " + (s.warn ? 'text-warn' : 'text-sage-500')} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-semibold tracking-tight tabular-nums">{s.value}</span>
                {s.sub && <span className="text-sm text-muted">{s.sub}</span>}
              </div>
            </>
          )
          const cls = 'block rounded-2xl bg-white border border-line/70 shadow-card px-4 py-3.5 hover:shadow-lift hover:border-line-strong transition-all'
          return s.to.startsWith('#')
            ? <a key={s.label} href={s.to} className={cls}>{inner}</a>
            : <Link key={s.label} to={s.to} className={cls}>{inner}</Link>
        })}
      </div>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Today */}
          <Card>
            <CardHeader title="Today" icon={CalendarClock} subtitle={`${todays.length} session${todays.length === 1 ? '' : 's'} on the calendar`} action={<Link to="/calendar" className="text-sm text-sage-700 hover:underline">Calendar</Link>} />
            {todays.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing scheduled today" text="Enjoy the breather, or write a quick session for someone." className="py-6" />
            ) : (
              <ul className="px-2 pb-2">
                {todays.map((s) => {
                  const c = clients.get(s.clientId)!
                  const st = sessionState(s)
                  return (
                    <li key={s.id}>
                      <button onClick={() => setOpenSession(s.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50">
                        <span className="w-16 text-[13px] text-muted tabular-nums">{s.time ? fmtClock(s.time) : 'Any time'}</span>
                        <Avatar name={c.name} color={c.color} size={32} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{c.name}</span>
                          <span className="block text-[13px] text-muted truncate">{s.kind === 'appointment' ? s.title : workouts.get(s.workoutId!)?.name}</span>
                        </span>
                        <Badge tone={stateTone[st]}>{st === 'today' ? 'To do' : stateLabel[st]}</Badge>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {recentDone.length > 0 && (
              <div className="border-t border-line px-5 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">Completed today</p>
                <ul className="space-y-1.5">
                  {recentDone.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={15} className="text-done" />
                      <Link to={`/clients/${c.clientId}?tab=progress`} className="font-medium hover:underline">{clients.get(c.clientId)?.name}</Link>
                      <span className="text-muted truncate">· {c.workoutName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Attention */}
          <Card id="attention" className="scroll-mt-32">
            <CardHeader title="Clients needing attention" icon={AlertCircle} subtitle="Missed sessions, check-ins and new messages" />
            {attention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Everyone’s on track" text="No missed sessions, check-ins or unread messages." className="py-6" />
            ) : (
              <ul className="px-2 pb-2">
                {attention.map((a, i) => {
                  const Icon = a.reason === 'message' ? MessageCircle : a.reason === 'checkin' ? ClipboardCheck : AlertCircle
                  const to = a.reason === 'message' ? `/messages/${a.client.id}` : a.reason === 'checkin' ? `/clients/${a.client.id}?tab=progress` : `/clients/${a.client.id}?tab=program`
                  return (
                    <li key={i} className="flex items-center gap-1">
                      <Link to={to} className="flex flex-1 min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-50">
                        <Avatar name={a.client.name} color={a.client.color} size={34} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 text-sm"><span className="font-medium">{a.client.name}</span></span>
                          <span className={cn('flex items-center gap-1.5 text-[13px]', a.reason === 'missed' || a.reason === 'inactive' ? 'text-miss' : 'text-ink-soft')}>
                            <Icon size={13} className="shrink-0" /> <span className="truncate">{a.label}{a.detail ? ` — “${a.detail}”` : ''}</span>
                          </span>
                        </span>
                        <ChevronRight size={16} className="text-muted shrink-0" />
                      </Link>
                      {a.reason === 'checkin' && a.refId && (
                        <button onClick={() => { data.reviewCheckIn(a.refId!); toast.success('Check-in marked as reviewed') }} className="shrink-0 rounded-lg px-2.5 h-8 text-[13px] font-medium text-sage-700 hover:bg-sage-50">Reviewed</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Inbox */}
          <Card>
            <CardHeader title="Messages & check-ins" icon={Inbox} action={<Link to="/messages" className="text-sm text-sage-700 hover:underline">All messages</Link>} />
            {convos.length === 0 && checkIns.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">You’re all caught up.</p>
            ) : (
              <ul className="px-2 pb-2">
                {convos.map((c) => {
                  const cl = clients.get(c.clientId)!
                  return (
                    <li key={c.clientId}>
                      <Link to={`/messages/${c.clientId}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-50">
                        <Avatar name={cl.name} color={cl.color} size={32} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{cl.name}</span><span className="text-xs text-muted">{timeAgo(c.last!.sentAt)}</span></span>
                          <span className="block text-[13px] text-ink-soft truncate">{c.last!.text}</span>
                        </span>
                        <span className="h-2 w-2 rounded-full bg-sage-500 shrink-0" aria-label="Unread" />
                      </Link>
                    </li>
                  )
                })}
                {checkIns.map((p) => {
                  const cl = clients.get(p.clientId)!
                  return (
                    <li key={p.id}>
                      <Link to={`/clients/${p.clientId}?tab=progress`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-50">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-appt-bg text-appt"><ClipboardCheck size={16} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium">{cl.name} — check-in{p.weight ? ` · ${p.weight} kg` : ''}</span>
                          <span className="block text-[13px] text-ink-soft truncate">{p.note ?? 'New progress entry'}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* Feed */}
          <Card>
            <CardHeader title="Recent activity" icon={Activity} />
            {feed.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No activity yet.</p> : (
              <ol className="px-5 pb-4 relative">
                {feed.map((f) => {
                  const Icon = f.kind === 'completed' ? CheckCircle2 : f.kind === 'message' ? MessageCircle : f.kind === 'checkin' ? ClipboardCheck : f.kind === 'weight' ? Scale : UserRoundPlus
                  return (
                    <li key={f.kind + f.id} className="flex gap-3 py-2">
                      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', f.kind === 'completed' ? 'bg-done-bg text-done' : 'bg-stone-100 text-ink-soft')}><Icon size={13} /></span>
                      <Link to={f.link} className="flex-1 min-w-0 text-sm hover:underline decoration-line-strong">{f.text}</Link>
                      <span className="shrink-0 text-xs text-muted pt-0.5">{timeAgo(f.at)}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <SessionModal sessionId={openSession} onClose={() => setOpenSession(null)} />
    </div>
  )
}
