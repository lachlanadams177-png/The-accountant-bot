import { useMemo, useState } from 'react'
import { CheckCircle2, Trophy, Scale, Send } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Card } from '../../components/ui/misc'
import { TrendChart, WeeklyBars } from '../../components/Charts'
import { toast } from '../../components/ui/toast'
import { exerciseHistory, personalBests, sortByDate, trackedExercises, weeklyHistory, weightSeries } from '../../lib/stats'
import { fmtDay, relDay, today } from '../../lib/date'

export function ClientProgress() {
  const clientId = useStore((s) => s.demoClientId)
  const { sessions, completions, progress, addProgress, trainer } = useStore()
  const history = weeklyHistory(sessions, clientId, 6)
  const weights = weightSeries(progress, clientId)
  const pbs = personalBests(completions, clientId).slice(0, 5)
  const tracked = useMemo(() => trackedExercises(completions, clientId), [completions, clientId])
  const [exKey, setExKey] = useState(tracked[0]?.key ?? '')
  const exHist = exKey ? exerciseHistory(completions, clientId, exKey) : []
  const timeline = sortByDate(completions.filter((c) => c.clientId === clientId), -1).slice(0, 10)
  const [w, setW] = useState('')
  const [note, setNote] = useState('')

  const submit = () => {
    const n = parseFloat(w)
    if (!w.trim() && !note.trim()) return toast.error('Add your weight or a note first.')
    if (w.trim() && (!Number.isFinite(n) || n <= 0)) return toast.error('Enter your weight in kg, e.g. 68.4')
    addProgress({ clientId, date: today(), weight: w.trim() ? n : undefined, note: note.trim() || undefined, checkIn: true, reviewed: false })
    setW(''); setNote('')
    toast.success(`Check-in sent to ${trainer.name.split(' ')[0]}`)
  }

  return (
    <div className="px-5 pt-6 pb-4 space-y-5">
      <h1 className="text-[26px] font-bold tracking-tight">Progress</h1>

      <Card className="p-4">
        <div className="flex items-baseline justify-between"><h2 className="font-semibold">Workouts per week</h2><span className="text-sm text-muted">{history[history.length - 1].completed} this week</span></div>
        <WeeklyBars data={history} height={150} />
      </Card>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Scale size={17} className="text-brand-600" /> Check in</h2>
        <p className="text-sm text-muted">Log your weight and tell {trainer.name.split(' ')[0]} how you’re going.</p>
        <div className="mt-3 grid gap-2">
          <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="Weight in kg (optional)" aria-label="Weight in kg" className="h-12 rounded-xl border border-line px-3.5 text-[16px] focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="How’s your week been? (optional)" aria-label="Check-in note" className="rounded-xl border border-line px-3.5 py-2.5 text-[16px] focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          <button onClick={submit} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white"><Send size={17} /> Send check-in</button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-baseline justify-between"><h2 className="font-semibold">Body weight</h2>{weights.length > 0 && <span className="text-sm text-muted">{weights[weights.length - 1].weight} kg</span>}</div>
        {weights.length > 1 ? <TrendChart data={weights} dataKey="weight" unit=" kg" height={170} /> : <p className="mt-2 text-sm text-muted">Log your weight a couple of times to see a trend.</p>}
      </Card>

      {pbs.length > 0 && (
        <Card className="p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Trophy size={17} className="text-ink" /> Personal bests</h2>
          <ul className="mt-2 divide-y divide-line/70">
            {pbs.map((p) => <li key={p.exerciseKey} className="flex items-center justify-between py-2.5 text-[15px]"><span>{p.name}</span><span className="font-semibold tabular-nums">{p.weight} kg{p.reps ? ` × ${p.reps}` : ''}</span></li>)}
          </ul>
        </Card>
      )}

      {tracked.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold">Exercise history</h2>
          <select aria-label="Exercise" value={exKey} onChange={(e) => setExKey(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px]">
            {tracked.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
          {exHist.length > 1 && <div className="mt-2"><TrendChart data={exHist.map((h) => ({ date: h.date, top: h.top, sets: h.sets }))} dataKey="top" unit=" kg" height={160} /></div>}
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...exHist].reverse().slice(0, 4).map((h) => <li key={h.date} className="flex justify-between gap-3"><span className="text-muted shrink-0">{fmtDay(h.date)}</span><span className="text-right">{h.sets}</span></li>)}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold">Timeline</h2>
        {timeline.length === 0 ? <p className="mt-2 text-sm text-muted">Your completed workouts will show here.</p> : (
          <ol className="mt-3 space-y-3 border-l-2 border-brand-100 pl-4">
            {timeline.map((c) => (
              <li key={c.id} className="relative">
                <CheckCircle2 size={16} className="absolute -left-[25px] top-0.5 bg-white text-brand-600" />
                <p className="font-medium">{c.workoutName}</p>
                <p className="text-sm text-muted">{relDay(c.date)}{c.notes ? ` · “${c.notes}”` : ''}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
