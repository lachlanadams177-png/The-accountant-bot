import { Repeat, Layers } from 'lucide-react'
import type { ExerciseItem, Workout } from '../types'
import { RichView } from './RichEditor'
import { targetLine } from '../lib/workout'
import { EmptyState } from './ui/misc'

export function ItemLine({ item }: { item: ExerciseItem }) {
  const t = targetLine(item)
  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{item.name}</span>
        {t && <span className="text-sm text-ink-soft tabular-nums">{t}</span>}
      </div>
      {item.notes && <p className="mt-0.5 text-sm text-muted">{item.notes}</p>}
    </div>
  )
}

/** Read-only rendering of either kind of workout, as the client will see it. */
export function WorkoutView({ workout }: { workout: Workout }) {
  if (workout.mode === 'write') {
    return workout.html ? <RichView html={workout.html} /> : <EmptyState title="Nothing written yet" />
  }
  if (!workout.blocks.length) return <EmptyState title="No exercises yet" />
  return (
    <div className="space-y-1">
      {workout.blocks.map((b) => {
        if (b.type === 'section') return <h3 key={b.id} className="pt-3 text-[13px] font-semibold uppercase tracking-wider text-brand-700">{b.title}</h3>
        if (b.type === 'text') return <p key={b.id} className="rounded-xl bg-brand-50/70 px-3.5 py-2.5 text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{b.text}</p>
        if (b.type === 'exercise') return <div key={b.id} className="border-b border-line/70 last:border-0"><ItemLine item={b} /></div>
        return (
          <div key={b.id} className="my-2 rounded-xl border border-line px-3.5 py-1.5">
            <div className="flex items-center gap-2 pt-1.5 text-[13px] font-semibold text-ink-soft">
              {b.kind === 'superset' ? <Layers size={14} /> : <Repeat size={14} />}
              {b.kind === 'superset' ? 'Superset' : 'Circuit'}
              {b.rounds && <span className="font-normal text-muted">· {b.rounds} rounds</span>}
              {b.rest && <span className="font-normal text-muted">· rest {b.rest} between rounds</span>}
            </div>
            <div className="divide-y divide-line/70">{b.items.map((i) => <ItemLine key={i.id} item={i} />)}</div>
          </div>
        )
      })}
    </div>
  )
}
