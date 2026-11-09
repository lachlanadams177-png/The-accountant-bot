import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, ChevronRight, MessageCircle, Moon, Play, TrendingUp } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useClient, useWorkoutMap } from '../../store/hooks'
import { Card } from '../../components/ui/misc'
import { activeProgram, nextSession, sessionState, weekStats, weightSeries } from '../../lib/stats'
import { DAY_SHORT, fmtClock, fmtLong, relDay, startOfWeek, today, weekDates } from '../../lib/date'
import { workoutSummary } from '../../lib/workout'
import { cn } from '../../lib/cn'

export function ClientHome() {
  const clientId = useStore((s) => s.demoClientId)
  const client = useClient(clientId)!
  const { sessions, completions, programs, progress, trainer } = useStore()
  const workouts = useWorkoutMap()
  const navigate = useNavigate()
  const t = today()
  const mine = sessions.filter((s) => s.clientId === clientId)
  const todays = mine.filter((s) => s.date === t && s.kind === 'workout')
  const appts = mine.filter((s) => s.kind === 'appointment' && s.date >= t).sort((a, b) => a.date.localeCompare(b.date))
  const next = nextSession(sessions, clientId, t)
  const week = weekStats(sessions, clientId)
  const total = completions.filter((c) => c.clientId === clientId).length
  const weights = weightSeries(progress, clientId)
  const program = activeProgram(programs, clientId)
  const first = client.name.split(' ')[0]
  const todo = todays.find((s) => s.status !== 'completed')
  const unread = useStore((s) => s.messages.filter((m) => m.clientId === clientId && m.from === 'trainer' && !m.read).length)

  return (
    <div className="px-5 pt-6">
      <p className="text-sm text-muted">{fmtLong(t)}</p>
      <h1 className="mt-1 text-[30px] font-semibold tracking-tight">Hi {first}!</h1>
      <p className="text-[16px] text-ink-soft">{todo ? 'Ready for today’s workout?' : todays.length ? 'All done for today. Great work!' : 'No workout today — enjoy your rest.'}</p>

      {/* Today */}
      <div className="mt-5 space-y-3">
        {todays.map((s) => {
          const w = workouts.get(s.workoutId!)
          const done = s.status === 'completed'
          return (
            <Card key={s.id} className={cn('p-5', !done && 'border-sage-200 shadow-lift')}>
              <p className="text-xs font-semibold uppercase tracking-wider text-sage-700">Today’s workout</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight leading-tight">{w?.name}</h2>
              {w && <p className="mt-1 text-sm text-muted line-clamp-2">{workoutSummary(w)}</p>}
              {done ? (
                <Link to={`/client/workout/${s.id}`} className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-done-bg text-done font-semibold"><CheckCircle2 size={20} /> Completed — view</Link>
              ) : (
                <button onClick={() => navigate(`/client/workout/${s.id}`)} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 text-[17px] font-semibold text-white shadow-lift active:scale-[0.98] transition-transform"><Play size={20} className="fill-white" /> Start workout</button>
              )}
            </Card>
          )
        })}
        {todays.length === 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-ink-soft"><Moon size={19} /></span><div><p className="font-semibold">Rest day</p><p className="text-sm text-muted">{next ? `Next up: ${workouts.get(next.workoutId!)?.name} · ${relDay(next.date)}` : 'Nothing else scheduled yet.'}</p></div></div>
            {next && <Link to={`/client/workout/${next.id}`} className="mt-4 flex h-12 items-center justify-center rounded-xl border border-line font-medium">Preview next workout</Link>}
          </Card>
        )}
      </div>

      {/* Week */}
      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="font-semibold">This week</h2><span className="text-sm text-muted">{week.completed} of {week.scheduled} done</span></div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDates(startOfWeek(t)).map((d, i) => {
            const s = mine.find((x) => x.date === d && x.kind === 'workout')
            const st = s ? sessionState(s) : null
            return (
              <button key={d} disabled={!s} onClick={() => s && navigate(`/client/workout/${s.id}`)} className={cn('flex flex-col items-center gap-1.5 rounded-xl py-2.5 border', d === t ? 'border-sage-300 bg-white shadow-card' : 'border-transparent')}>
                <span className="text-[11px] font-medium text-muted">{DAY_SHORT[i]}</span>
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs',
                  st === 'completed' ? 'bg-sage-600 text-white' : st === 'missed' ? 'bg-miss-bg text-miss' : st ? 'border-2 border-sage-300 text-sage-700' : 'text-muted/60')}>
                  {st === 'completed' ? <CheckCircle2 size={16} /> : st ? '•' : '–'}
                </span>
              </button>
            )
          })}
        </div>
        {program && <p className="mt-2 text-xs text-muted">Program: {program.name}</p>}
      </section>

      {/* Overview */}
      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/client/progress" className="rounded-2xl bg-white border border-line/70 shadow-card p-4">
          <CheckCircle2 size={18} className="text-sage-600" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-[13px] text-muted">Workouts completed</p>
        </Link>
        <Link to="/client/progress" className="rounded-2xl bg-white border border-line/70 shadow-card p-4">
          <TrendingUp size={18} className="text-sage-600" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{weights.length ? `${weights[weights.length - 1].weight}` : '—'}<span className="text-sm font-normal text-muted"> kg</span></p>
          <p className="text-[13px] text-muted">Latest weight</p>
        </Link>
      </section>

      {appts[0] && (
        <Card className="mt-3 flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-appt-bg text-appt"><CalendarClock size={19} /></span>
          <div className="flex-1"><p className="font-medium">{appts[0].title}</p><p className="text-sm text-muted">{relDay(appts[0].date)}{appts[0].time ? ` · ${fmtClock(appts[0].time)}` : ''} with {trainer.name.split(' ')[0]}</p></div>
        </Card>
      )}

      <Link to="/client/messages" className="mt-3 mb-4 flex items-center gap-3 rounded-2xl bg-white border border-line/70 shadow-card p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-50 text-sage-600"><MessageCircle size={19} /></span>
        <span className="flex-1"><span className="block font-medium">Message {trainer.name.split(' ')[0]}</span><span className="text-sm text-muted">{unread ? `${unread} new message${unread > 1 ? 's' : ''}` : 'Questions? Just ask.'}</span></span>
        <ChevronRight size={18} className="text-muted" />
      </Link>
    </div>
  )
}
