import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, CircleAlert, Circle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useWorkoutMap } from '../../store/hooks'
import { EmptyState } from '../../components/ui/misc'
import { sessionState, sortByDate } from '../../lib/stats'
import { addDays, relDay, today } from '../../lib/date'
import { cn } from '../../lib/cn'
import type { ScheduledSession } from '../../types'

export function ClientWorkouts() {
  const clientId = useStore((s) => s.demoClientId)
  const sessions = useStore((s) => s.sessions)
  const workouts = useWorkoutMap()
  const t = today()
  const mine = sessions.filter((s) => s.clientId === clientId && s.kind === 'workout')
  const upcoming = sortByDate(mine.filter((s) => s.date >= t && s.status !== 'completed' && s.date <= addDays(t, 21)))
  const missed = sortByDate(mine.filter((s) => s.date < t && s.date >= addDays(t, -14) && s.status !== 'completed'), -1)
  const done = sortByDate(mine.filter((s) => s.status === 'completed'), -1).slice(0, 20)

  const Row = ({ s }: { s: ScheduledSession }) => {
    const st = sessionState(s)
    const Icon = st === 'completed' ? CheckCircle2 : st === 'missed' ? CircleAlert : Circle
    return (
      <li>
        <Link to={`/client/workout/${s.id}`} className="flex items-center gap-3 rounded-2xl bg-white border border-line/70 px-4 py-3.5 shadow-card active:bg-stone-50">
          <Icon size={20} className={cn(st === 'completed' ? 'text-done' : st === 'missed' ? 'text-miss' : st === 'today' ? 'text-sage-600' : 'text-line-strong')} />
          <span className="flex-1 min-w-0"><span className="block font-medium truncate">{workouts.get(s.workoutId!)?.name ?? 'Workout'}</span><span className="text-sm text-muted">{relDay(s.date)}</span></span>
          <ChevronRight size={18} className="text-muted" />
        </Link>
      </li>
    )
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-[26px] font-semibold tracking-tight">Workouts</h1>
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Coming up</h2>
        {upcoming.length ? <ul className="space-y-2">{upcoming.map((s) => <Row key={s.id} s={s} />)}</ul> : <EmptyState title="No workouts scheduled yet" text="Your trainer will add some soon." className="py-6" />}
      </section>
      {missed.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Missed — you can still do these</h2>
          <ul className="space-y-2">{missed.map((s) => <Row key={s.id} s={s} />)}</ul>
        </section>
      )}
      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Completed</h2>
        {done.length ? <ul className="space-y-2">{done.map((s) => <Row key={s.id} s={s} />)}</ul> : <p className="text-sm text-muted">Nothing completed yet — your first one is coming!</p>}
      </section>
    </div>
  )
}
