import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, History, Layers, Repeat, PartyPopper, Info } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { RichView } from '../../components/RichEditor'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'
import { allItems, setCount, targetLine } from '../../lib/workout'
import { fmtLong, relDay } from '../../lib/date'
import { cn } from '../../lib/cn'
import type { ExerciseItem, ExerciseResult, SetResult, WorkoutCompletion } from '../../types'

type Log = Record<string, { sets: SetResult[]; notes?: string }>
const FEELINGS = ['Very easy', 'Easy', 'Good', 'Hard', 'Very hard']

export function WorkoutPlayer() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const session = useStore((s) => s.sessions.find((x) => x.id === sessionId))
  const workout = useStore((s) => s.workouts.find((w) => w.id === session?.workoutId))
  const completion = useStore((s) => s.completions.find((c) => c.sessionId === sessionId))
  const history = useStore((s) => s.completions)
  const clientId = useStore((s) => s.demoClientId)
  const trainer = useStore((s) => s.trainer)
  const completeSession = useStore((s) => s.completeSession)
  const logKey = `fernly-log:${sessionId}`

  const groupRounds = useMemo(() => {
    const m = new Map<string, string | undefined>()
    workout?.blocks.forEach((b) => b.type === 'group' && b.items.forEach((i) => m.set(i.id, b.rounds)))
    return m
  }, [workout])

  const [log, setLog] = useState<Log>({})
  const [finishing, setFinishing] = useState(false)
  const [notes, setNotes] = useState('')
  const [feeling, setFeeling] = useState<number | undefined>()
  const [done, setDone] = useState<WorkoutCompletion | null>(null)

  // start from saved progress, or targets
  useEffect(() => {
    if (!workout) return
    let saved: Log = {}
    try { saved = JSON.parse(localStorage.getItem(logKey) || '{}') } catch { /* ignore */ }
    const init: Log = {}
    for (const it of allItems(workout.blocks)) {
      const n = setCount(it, groupRounds.get(it.id))
      const reps = it.reps?.match(/^\d+$/) ? it.reps : ''
      const weight = it.weight?.match(/^[\d.]+/)?.[0] ?? ''
      init[it.id] = saved[it.id] ?? { sets: Array.from({ length: n }, () => ({ reps, weight, done: false })) }
    }
    setLog(init)
  }, [workout, logKey, groupRounds])

  useEffect(() => {
    if (Object.keys(log).length && !completion) localStorage.setItem(logKey, JSON.stringify(log))
  }, [log, logKey, completion])

  if (!session || !workout || session.clientId !== clientId) {
    return <div className="p-6"><EmptyState title="Workout not found" action={<Link className="text-sage-700 underline" to="/client">Back home</Link>} /></div>
  }

  const items = allItems(workout.blocks)
  const totalSets = Object.values(log).reduce((a, l) => a + l.sets.length, 0)
  const doneSets = Object.values(log).reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0)

  const lastFor = (it: ExerciseItem) => {
    const key = it.exerciseId ?? it.name.toLowerCase()
    const prev = history
      .filter((c) => c.clientId === clientId && c.sessionId !== sessionId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .find((c) => c.results.some((r) => (r.exerciseId ?? r.name.toLowerCase()) === key && r.sets.some((s) => s.done)))
    const r = prev?.results.find((x) => (x.exerciseId ?? x.name.toLowerCase()) === key)
    if (!prev || !r) return null
    return { date: prev.date, text: r.sets.filter((s) => s.done).map((s) => `${s.reps ?? '–'}${s.weight ? ' × ' + s.weight + 'kg' : ''}`).join(', ') }
  }

  const setSet = (itemId: string, i: number, patch: Partial<SetResult>) =>
    setLog((l) => ({ ...l, [itemId]: { ...l[itemId], sets: l[itemId].sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) } }))
  const addSet = (itemId: string) =>
    setLog((l) => { const last = l[itemId].sets[l[itemId].sets.length - 1]; return { ...l, [itemId]: { ...l[itemId], sets: [...l[itemId].sets, { reps: last?.reps, weight: last?.weight, done: false }] } } })

  const finish = () => {
    const results: ExerciseResult[] = workout.mode === 'build'
      ? items.map((it) => ({ itemId: it.id, exerciseId: it.exerciseId, name: it.name, sets: (log[it.id]?.sets ?? []).map((s) => ({ ...s, reps: s.reps || undefined, weight: s.weight || undefined })), notes: log[it.id]?.notes }))
      : []
    const c = completeSession({ sessionId: session.id, by: 'client', results, notes, feeling })
    localStorage.removeItem(logKey)
    setFinishing(false)
    if (c) setDone(c)
  }

  /* ───────── completion screen */
  if (done) {
    const logged = done.results.reduce((a, r) => a + r.sets.filter((s) => s.done).length, 0)
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center animate-rise">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sage-600 text-white shadow-lift"><PartyPopper size={36} /></div>
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">Workout complete!</h1>
        <p className="mt-2 text-ink-soft">{workout.name} is done. {trainer.name.split(' ')[0]} can see it straight away.</p>
        {logged > 0 && <p className="mt-1 text-sm text-muted">{logged} sets logged</p>}
        <Button variant="primary" size="lg" className="mt-8 w-full max-w-xs h-14 text-[17px]" onClick={() => navigate('/client')}>Back to home</Button>
        <Link to="/client/progress" className="mt-3 text-sm text-sage-700">See my progress</Link>
      </div>
    )
  }

  return (
    <div>
      <header className="sticky top-11 sm:top-0 z-20 flex items-center gap-2 bg-canvas/90 backdrop-blur px-3 py-3 border-b border-line/60">
        <button onClick={() => navigate(-1)} aria-label="Back" className="h-11 w-11 inline-flex items-center justify-center rounded-xl hover:bg-black/5"><ArrowLeft size={22} /></button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{relDay(session.date)}</p>
          <h1 className="truncate text-[17px] font-semibold">{workout.name}</h1>
        </div>
        {workout.mode === 'build' && !completion && totalSets > 0 && <span className="rounded-full bg-white border border-line px-2.5 py-1 text-xs font-medium tabular-nums">{doneSets}/{totalSets} sets</span>}
      </header>

      {completion && (
        <div className="mx-4 mt-4 rounded-2xl bg-done-bg px-4 py-3 text-done">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Completed {fmtLong(completion.date)}</p>
          {completion.notes && <p className="mt-1 text-sm text-ink-soft">Your notes: “{completion.notes}”</p>}
        </div>
      )}

      <div className="px-4 pt-4 pb-6 space-y-3">
        {workout.mode === 'write' ? (
          <div className="rounded-2xl bg-white border border-line/70 shadow-card p-5">
            <RichView html={workout.html} className="text-[16px]" />
          </div>
        ) : (
          workout.blocks.map((b) => {
            if (b.type === 'section') return <h2 key={b.id} className="px-1 pt-3 text-[13px] font-semibold uppercase tracking-wider text-sage-700">{b.title}</h2>
            if (b.type === 'text') return <p key={b.id} className="flex gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-[15px] text-ink-soft leading-relaxed"><Info size={17} className="mt-0.5 shrink-0 text-sage-600" />{b.text}</p>
            if (b.type === 'exercise') return <ExerciseCard key={b.id} item={b} log={log[b.id]} last={lastFor(b)} completed={completion} onSet={(i, p) => setSet(b.id, i, p)} onAdd={() => addSet(b.id)} />
            return (
              <div key={b.id} className="rounded-2xl border-2 border-dashed border-line p-2 space-y-2">
                <p className="flex items-center gap-2 px-2 pt-1 text-sm font-semibold text-ink-soft">{b.kind === 'superset' ? <Layers size={16} /> : <Repeat size={16} />}{b.kind === 'superset' ? 'Superset' : 'Circuit'}{b.rounds && <span className="font-normal text-muted">· {b.rounds} rounds{b.rest ? `, rest ${b.rest}` : ''}</span>}</p>
                <p className="px-2 text-xs text-muted">Do one set of each, back to back, then repeat.</p>
                {b.items.map((it) => <ExerciseCard key={it.id} item={it} log={log[it.id]} last={lastFor(it)} completed={completion} onSet={(i, p) => setSet(it.id, i, p)} onAdd={() => addSet(it.id)} roundLabel />)}
              </div>
            )
          })
        )}
      </div>

      {!completion && (
        <div className="sticky bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur p-4 pb-safe">
          <button onClick={() => setFinishing(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sage-600 text-[17px] font-semibold text-white shadow-lift active:scale-[0.98] transition-transform">
            <Check size={20} /> {workout.mode === 'build' ? 'Finish workout' : 'Mark as complete'}
          </button>
        </div>
      )}

      <Modal open={finishing} onClose={() => setFinishing(false)} title="Finish workout?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setFinishing(false)}>Not yet</Button><Button variant="primary" size="lg" onClick={finish}>Complete workout</Button></>}>
        {workout.mode === 'build' && doneSets < totalSets && <p className="mb-3 text-sm text-ink-soft">You’ve ticked {doneSets} of {totalSets} sets. That’s fine — finish whenever you’re ready.</p>}
        <p className="mb-2 text-sm font-medium text-ink-soft">How did it feel? <span className="font-normal text-muted">(optional)</span></p>
        <div className="grid grid-cols-5 gap-1.5">
          {FEELINGS.map((f, i) => (
            <button key={f} onClick={() => setFeeling(feeling === i + 1 ? undefined : i + 1)} aria-pressed={feeling === i + 1} className={cn('rounded-xl border px-1 py-2.5 text-xs font-medium', feeling === i + 1 ? 'border-sage-400 bg-sage-50 text-sage-800' : 'border-line text-ink-soft')}>{f}</button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-ink-soft" htmlFor="cnotes">Notes for {trainer.name.split(' ')[0]} <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="cnotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything feel sore, easy or tricky?" className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-[15px] focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-100" />
      </Modal>
    </div>
  )
}

function ExerciseCard({ item, log, last, completed, onSet, onAdd, roundLabel }: {
  item: ExerciseItem; log?: { sets: SetResult[] }; last: { date: string; text: string } | null; completed?: WorkoutCompletion
  onSet: (i: number, p: Partial<SetResult>) => void; onAdd: () => void; roundLabel?: boolean
}) {
  const t = targetLine(item)
  const result = completed?.results.find((r) => r.itemId === item.id)
  const sets = completed ? result?.sets ?? [] : log?.sets ?? []
  const allDone = sets.length > 0 && sets.every((s) => s.done)
  return (
    <div className={cn('rounded-2xl border bg-white p-4 shadow-card transition-colors', allDone ? 'border-sage-200' : 'border-line/70')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug">{item.name}</h3>
          {t && <p className="mt-0.5 text-[15px] text-ink-soft tabular-nums">{t}</p>}
        </div>
        {allDone && <CheckCircle2 size={22} className="text-sage-600 shrink-0" />}
      </div>
      {item.notes && <p className="mt-1.5 text-sm text-muted">{item.notes}</p>}
      {last && !completed && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-plan"><History size={14} /> Last time ({relDay(last.date)}): {last.text}</p>}
      {sets.length > 0 && (
        <div className="mt-3">
          <div className="grid grid-cols-[44px_1fr_1fr_52px] gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
            <span>{roundLabel ? 'Round' : 'Set'}</span><span>Reps</span><span>kg</span><span className="text-center">Done</span>
          </div>
          <div className="space-y-1.5">
            {sets.map((s, i) => (
              <div key={i} className={cn('grid grid-cols-[44px_1fr_1fr_52px] items-center gap-2 rounded-xl px-1 py-1', s.done && 'bg-sage-50')}>
                <span className="text-center text-sm font-semibold text-muted">{i + 1}</span>
                <input inputMode="numeric" aria-label={`Set ${i + 1} reps`} value={s.reps ?? ''} disabled={!!completed} onChange={(e) => onSet(i, { reps: e.target.value })} placeholder={item.reps ?? '–'} className="h-11 w-full rounded-lg border border-line bg-white px-2 text-center text-[16px] tabular-nums disabled:bg-transparent disabled:border-transparent" />
                <input inputMode="decimal" aria-label={`Set ${i + 1} weight in kg`} value={s.weight ?? ''} disabled={!!completed} onChange={(e) => onSet(i, { weight: e.target.value })} placeholder="–" className="h-11 w-full rounded-lg border border-line bg-white px-2 text-center text-[16px] tabular-nums disabled:bg-transparent disabled:border-transparent" />
                <button aria-label={`Mark set ${i + 1} ${s.done ? 'not done' : 'done'}`} aria-pressed={s.done} disabled={!!completed} onClick={() => onSet(i, { done: !s.done })}
                  className={cn('mx-auto flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all active:scale-95', s.done ? 'border-sage-600 bg-sage-600 text-white' : 'border-line-strong text-transparent')}>
                  <Check size={20} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
          {!completed && <button onClick={onAdd} className="mt-2 h-9 px-2 text-sm font-medium text-sage-700">+ Add a set</button>}
        </div>
      )}
    </div>
  )
}
