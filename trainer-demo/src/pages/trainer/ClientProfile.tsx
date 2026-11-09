import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive, ArchiveRestore, CalendarPlus, CheckCircle2, ClipboardList, Lock, Mail, MessageCircle, Pencil, Phone, Plus,
  Smartphone, Target, Trash2, Zap, ClipboardCheck, Ruler, Gauge,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/ui'
import { useLibraryWorkouts, useWorkoutMap } from '../../store/hooks'
import { Avatar, Badge, Card, CardHeader, EmptyState, ProgressBar, Tabs, stateLabel, stateTone } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Field'
import { ClientFormModal } from '../../components/ClientForm'
import { AssignProgramModal, SessionModal } from '../../components/AssignDialogs'
import { TrendChart, WeeklyBars } from '../../components/Charts'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import {
  activeProgram, exerciseHistory, nextSession, personalBests, sessionState, sortByDate, trackedExercises,
  weekStats, weeklyHistory, weightSeries, workoutSessions,
} from '../../lib/stats'
import { addDays, DAY_SHORT, diffDays, fmtDay, fmtShort, relDay, startOfWeek, today } from '../../lib/date'
import { cn } from '../../lib/cn'
import type { Client } from '../../types'

type Tab = 'overview' | 'program' | 'progress' | 'notes'

export function ClientProfile() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const setClientStatus = useStore((s) => s.setClientStatus)
  const setMode = useStore((s) => s.setMode)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  if (!client) return <EmptyState title="Client not found" text="They may have been removed when the demo was reset." action={<Link to="/clients" className="text-sage-700 underline">Back to clients</Link>} />

  const archive = async () => {
    if (await confirm({ title: `Archive ${client.name}?`, message: 'Upcoming sessions will be removed. History stays and you can restore them any time.', confirmLabel: 'Archive', danger: true })) {
      setClientStatus(client.id, 'archived')
      toast.success(`${client.name} archived`)
    }
  }

  return (
    <div>
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">← Clients</Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={client.name} color={client.color} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-tight">{client.name}</h1>
            {client.status === 'archived' && <Badge>Archived</Badge>}
            {client.experience && <Badge tone="sage">{client.experience}</Badge>}
          </div>
          <p className="text-[15px] text-ink-soft">{client.goal ?? 'No goal set yet'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={MessageCircle} onClick={() => navigate(`/messages/${client.id}`)}>Message</Button>
          <Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
          {client.status === 'active' ? (
            <>
              <Button icon={Smartphone} onClick={() => { setMode('client', client.id); navigate('/client') }} title="See the app as this client">View as client</Button>
              <Button variant="ghost" icon={Archive} onClick={archive}>Archive</Button>
            </>
          ) : (
            <Button variant="soft" icon={ArchiveRestore} onClick={() => { setClientStatus(client.id, 'active'); toast.success('Client restored') }}>Restore</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} tabs={[
        { value: 'overview', label: 'Overview' },
        { value: 'program', label: 'Program' },
        { value: 'progress', label: 'Progress' },
        { value: 'notes', label: 'Notes' },
      ]} />
      <div className="pt-6 animate-fade-in" key={tab}>
        {tab === 'overview' && <Overview client={client} onEdit={() => setEditing(true)} />}
        {tab === 'program' && <ProgramTab client={client} />}
        {tab === 'progress' && <ProgressTab client={client} />}
        {tab === 'notes' && <NotesTab client={client} />}
      </div>
      <ClientFormModal open={editing} client={client} onClose={() => setEditing(false)} />
    </div>
  )
}

/* ───────────── Overview */

function Overview({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const { programs, sessions, completions } = useStore()
  const workouts = useWorkoutMap()
  const program = activeProgram(programs, client.id)
  const next = nextSession(sessions, client.id)
  const week = weekStats(sessions, client.id)
  const history = weeklyHistory(sessions, client.id, 6)
  const recent = sortByDate(completions.filter((c) => c.clientId === client.id), -1).slice(0, 5)
  const [, setParams] = useSearchParams()
  const [openSession, setOpenSession] = useState<string | null>(null)
  const totalScheduled = history.reduce((a, h) => a + h.scheduled, 0)
  const totalDone = history.reduce((a, h) => a + h.completed, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Details" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>Edit</Button>} />
          <dl className="px-5 pb-5 space-y-3 text-sm">
            <Row icon={Target} label="Goal" value={client.goal} />
            <Row icon={Gauge} label="Experience" value={client.experience} />
            <Row icon={Mail} label="Email" value={client.email} />
            <Row icon={Phone} label="Phone" value={client.phone} />
            {client.notes && <div className="rounded-xl bg-stone-50 px-3.5 py-3 text-ink-soft leading-relaxed"><span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Lock size={12} /> Trainer only</span>{client.notes}</div>}
            <p className="text-xs text-muted">Client since {fmtShort(client.createdAt.slice(0, 10))}</p>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Workout completion" subtitle="Last 6 weeks" />
          <div className="px-5 pb-5">
            <div className="flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums">{totalScheduled ? Math.round((totalDone / totalScheduled) * 100) : 0}%</span><span className="text-sm text-muted">{totalDone} of {totalScheduled} workouts</span></div>
            <p className="mt-1 text-sm text-ink-soft">This week: {week.completed} of {week.scheduled} done</p>
            <ProgressBar value={week.pct} className="mt-2" />
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Program" icon={ClipboardList} action={<Button size="sm" variant="ghost" onClick={() => setParams({ tab: 'program' })}>Open</Button>} />
          <div className="px-5 pb-5">
            {program ? (
              <>
                <p className="font-medium">{program.name}</p>
                <p className="text-sm text-muted">Week {Math.min(program.weeks.length, Math.floor(diffDays(today(), program.startDate!) / 7) + 1)} of {program.weeks.length} · started {fmtDay(program.startDate!)}</p>
              </>
            ) : <p className="text-sm text-muted">No program assigned yet.</p>}
            <div className="mt-4 rounded-xl border border-line px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Up next</p>
              {next ? (
                <button onClick={() => setOpenSession(next.id)} className="mt-1 flex w-full items-center justify-between text-left">
                  <span className="font-medium">{workouts.get(next.workoutId!)?.name}</span>
                  <span className="text-sm text-ink-soft">{relDay(next.date)}</span>
                </button>
              ) : <p className="mt-1 text-sm text-muted">Nothing scheduled.</p>}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No completed workouts yet.</p> : (
            <ul className="px-5 pb-4 space-y-2.5">
              {recent.map((c) => (
                <li key={c.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 text-done shrink-0" />
                  <span className="flex-1 min-w-0"><span className="font-medium">{c.workoutName}</span>{c.notes && <span className="text-muted"> — “{c.notes}”</span>}</span>
                  <span className="text-xs text-muted shrink-0">{relDay(c.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 pb-5"><WeeklyBars data={history} height={140} /></div>
        </Card>
      </div>
      <SessionModal sessionId={openSession} onClose={() => setOpenSession(null)} />
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 text-muted shrink-0" />
      <dt className="w-24 text-muted shrink-0">{label}</dt>
      <dd className={cn('flex-1 min-w-0 break-words', !value && 'text-muted')}>{value ?? '—'}</dd>
    </div>
  )
}

/* ───────────── Program */

function ProgramTab({ client }: { client: Client }) {
  const { programs, sessions, scheduleWorkout } = useStore()
  const workouts = useWorkoutMap()
  const library = useLibraryWorkouts()
  const openQuick = useUi((s) => s.openQuickSession)
  const navigate = useNavigate()
  const program = activeProgram(programs, client.id)
  const [assignOpen, setAssignOpen] = useState(false)
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [addWid, setAddWid] = useState('')
  const [addDate, setAddDate] = useState(today())
  const t = today()
  const currentWeek = program ? Math.floor(diffDays(t, program.startDate!) / 7) : -1
  const [viewWeek, setViewWeek] = useState(Math.max(0, Math.min(currentWeek, (program?.weeks.length ?? 1) - 1)))

  const upcoming = sortByDate(sessions.filter((s) => s.clientId === client.id && s.date >= addDays(t, -7) && s.date <= addDays(t, 21)))
  const past = programs.filter((p) => p.clientId === client.id && p.status === 'ended')

  const addOne = () => {
    if (!addWid) return
    scheduleWorkout({ workoutId: addWid, clientId: client.id, date: addDate })
    toast.success(`Added for ${fmtDay(addDate)}`)
    setAddWid('')
  }

  return (
    <div className="space-y-6">
      <Card>
        {program ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Current program</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{program.name}</h2>
                <p className="text-sm text-muted">{program.weeks.length} weeks · started {fmtDay(program.startDate!)}{program.sourceId ? ' · personal copy' : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" icon={Pencil} onClick={() => navigate(`/programs/${program.id}`)}>Customise for {client.name.split(' ')[0]}</Button>
                <Button onClick={() => setAssignOpen(true)}>Change program</Button>
              </div>
            </div>
            <div className="px-5 pt-4 pb-5">
              <div className="mb-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {program.weeks.map((_, i) => (
                  <button key={i} onClick={() => setViewWeek(i)} className={cn('shrink-0 rounded-lg px-3 h-8 text-[13px] font-medium', i === viewWeek ? 'bg-ink text-white' : 'text-ink-soft hover:bg-stone-100', i === currentWeek && i !== viewWeek && 'ring-1 ring-sage-300')}>
                    Week {i + 1}{i === currentWeek ? ' · now' : ''}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {program.weeks[viewWeek]?.days.map((d, di) => {
                  const date = addDays(program.startDate!, viewWeek * 7 + di)
                  const s = sessions.find((x) => x.programId === program.id && x.slot === `${viewWeek}-${di}`)
                  const st = s ? sessionState(s) : null
                  return (
                    <button key={di} disabled={!s} onClick={() => s && setOpenSession(s.id)} className={cn('rounded-xl border p-3 text-left min-h-[88px] transition-colors', d.workoutId ? 'border-line bg-white hover:border-line-strong' : 'border-dashed border-line bg-stone-50/60', date === t && 'ring-2 ring-sage-300')}>
                      <p className="text-xs text-muted">{DAY_SHORT[di]} {fmtDay(date).split(' ').slice(1).join(' ')}</p>
                      {d.workoutId ? (
                        <>
                          <p className="mt-1 text-sm font-medium leading-snug">{workouts.get(d.workoutId)?.name}</p>
                          {st && <Badge tone={stateTone[st]} className="mt-1.5">{s?.moved ? 'Moved' : stateLabel[st]}</Badge>}
                        </>
                      ) : <p className="mt-1 text-sm text-muted">Rest</p>}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={ClipboardList} title={`${client.name.split(' ')[0]} doesn’t have a program yet`} text="Assign one of your programs — they get their own copy you can customise." action={<Button variant="primary" onClick={() => setAssignOpen(true)}>Assign a program</Button>} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Schedule" subtitle="Last week to three weeks ahead" action={<Link to={`/calendar?client=${client.id}`} className="text-sm text-sage-700 hover:underline">Open calendar</Link>} />
          {upcoming.length === 0 ? <EmptyState title="No workouts scheduled yet" text="Add a one-off session or assign a program." className="py-6" /> : (
            <ul className="px-2 pb-2">
              {upcoming.map((s) => {
                const st = sessionState(s)
                return (
                  <li key={s.id}>
                    <button onClick={() => setOpenSession(s.id)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50', s.date === t && 'bg-sage-50/60')}>
                      <span className="w-24 text-[13px] text-muted">{relDay(s.date)}</span>
                      <span className="flex-1 truncate text-sm font-medium">{s.kind === 'appointment' ? s.title : workouts.get(s.workoutId!)?.name}</span>
                      {!s.programId && s.kind === 'workout' && <Badge>One-off</Badge>}
                      <Badge tone={stateTone[st]}>{stateLabel[st]}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold">Add a one-off session</h3>
            <p className="mt-1 text-sm text-muted">Write something new, or pick a workout from your library.</p>
            <Button className="mt-4 w-full" variant="soft" icon={Zap} onClick={() => openQuick({ clientId: client.id })}>Write a quick session</Button>
            <div className="mt-4 grid gap-2">
              <select aria-label="Workout" value={addWid} onChange={(e) => setAddWid(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
                <option value="">Choose from library…</option>
                {library.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="date" aria-label="Date" value={addDate} onChange={(e) => setAddDate(e.target.value || today())} className="h-10 flex-1 rounded-xl border border-line px-3 text-sm" />
                <Button icon={CalendarPlus} disabled={!addWid} onClick={addOne}>Add</Button>
              </div>
            </div>
          </Card>
          {past.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold">Previous programs</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {past.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.name}</span><span className="text-muted">{p.startDate && fmtShort(p.startDate)}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <AssignProgramModal open={assignOpen} clientId={client.id} onClose={() => setAssignOpen(false)} />
      <SessionModal sessionId={openSession} onClose={() => setOpenSession(null)} />
    </div>
  )
}

/* ───────────── Progress */

function ProgressTab({ client }: { client: Client }) {
  const { sessions, completions, progress, addProgress, deleteProgress, reviewCheckIn } = useStore()
  const weights = weightSeries(progress, client.id)
  const history = weeklyHistory(sessions, client.id, 8)
  const tracked = useMemo(() => trackedExercises(completions, client.id), [completions, client.id])
  const [exKey, setExKey] = useState(tracked[0]?.key ?? '')
  const exHist = exKey ? exerciseHistory(completions, client.id, exKey) : []
  const pbs = personalBests(completions, client.id).slice(0, 6)
  const done = completions.filter((c) => c.clientId === client.id)
  const t = today()
  const missed = workoutSessions(sessions, client.id).filter((s) => s.status !== 'completed' && s.date < t && s.date >= addDays(t, -30))
  const entries = sortByDate(progress.filter((p) => p.clientId === client.id), -1)
  const measured = entries.filter((e) => e.measurements && Object.keys(e.measurements).length)
  const thisWeek = weekStats(sessions, client.id, startOfWeek(t))
  const [w, setW] = useState('')
  const [wDate, setWDate] = useState(t)

  const addWeight = () => {
    const n = parseFloat(w)
    if (!Number.isFinite(n) || n <= 0) return toast.error('Enter a weight in kg, e.g. 72.5')
    addProgress({ clientId: client.id, date: wDate, weight: n })
    setW('')
    toast.success('Weight saved')
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Workouts completed" value={done.length} />
        <Stat label="This week" value={thisWeek.pct != null ? `${thisWeek.pct}%` : '—'} sub={`${thisWeek.completed} of ${thisWeek.scheduled}`} />
        <Stat label="Missed (30 days)" value={missed.length} warn={missed.length > 0} />
        <Stat label="Latest weight" value={weights.length ? `${weights[weights.length - 1].weight} kg` : '—'} sub={weights.length > 1 ? `${(weights[weights.length - 1].weight - weights[0].weight > 0 ? '+' : '')}${(weights[weights.length - 1].weight - weights[0].weight).toFixed(1)} kg since ${fmtDay(weights[0].date)}` : undefined} />
      </div>

      {entries.filter((e) => e.checkIn).slice(0, 2).map((e) => (
        <Card key={e.id} className={cn('p-5 flex flex-wrap items-start gap-4', !e.reviewed && 'border-appt/30 bg-appt-bg/40')}>
          <ClipboardCheck className="text-appt shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Check-in · {fmtDay(e.date)} {!e.reviewed && <Badge tone="purple" className="ml-1">New</Badge>}</p>
            {e.weight && <p className="text-sm text-ink-soft">Weight {e.weight} kg</p>}
            {e.note && <p className="mt-1 text-sm text-ink-soft">“{e.note}”</p>}
          </div>
          {!e.reviewed && <Button size="sm" onClick={() => { reviewCheckIn(e.id); toast.success('Marked as reviewed') }}>Mark reviewed</Button>}
        </Card>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workouts per week" subtitle="Completed, last 8 weeks" />
          <div className="px-3 pb-4"><WeeklyBars data={history} /></div>
        </Card>
        <Card>
          <CardHeader title="Body weight" subtitle={weights.length ? `${weights.length} entries` : undefined} />
          <div className="px-3">{weights.length > 1 ? <TrendChart data={weights} dataKey="weight" unit=" kg" height={180} /> : <p className="px-2 pb-4 text-sm text-muted">Add two or more entries to see a trend.</p>}</div>
          <div className="flex gap-2 px-5 pb-5 pt-2">
            <Input aria-label="Weight in kg" placeholder="Weight (kg)" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addWeight()} />
            <input type="date" aria-label="Date" value={wDate} onChange={(e) => setWDate(e.target.value || t)} className="h-10 rounded-xl border border-line px-3 text-sm" />
            <Button icon={Plus} onClick={addWeight}>Add</Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Exercise progress" subtitle="Heaviest set each session, from logged results" />
        {tracked.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No weights logged yet. Results appear here once {client.name.split(' ')[0]} logs a structured workout.</p> : (
          <div className="grid gap-6 px-5 pb-5 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <select aria-label="Exercise" value={exKey} onChange={(e) => setExKey(e.target.value)} className="mb-3 h-10 w-full max-w-xs rounded-xl border border-line bg-white px-3 text-sm">
                {tracked.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
              </select>
              {exHist.length > 1 ? <TrendChart data={exHist.map((h) => ({ date: h.date, top: h.top, sets: h.sets }))} dataKey="top" unit=" kg" height={200} /> : <p className="text-sm text-muted">Only one session logged so far.</p>}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Personal bests</p>
              <ul className="divide-y divide-line/70 text-sm">
                {pbs.map((p) => <li key={p.exerciseKey} className="flex justify-between py-2"><span>{p.name}</span><span className="font-medium tabular-nums">{p.weight} kg{p.reps ? ` × ${p.reps}` : ''}</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Completed workouts" />
          {done.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">None yet.</p> : (
            <ul className="px-5 pb-4 max-h-80 overflow-y-auto divide-y divide-line/70">
              {sortByDate(done, -1).map((c) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <div className="flex justify-between gap-2"><span className="font-medium">{c.workoutName}</span><span className="text-muted">{fmtDay(c.date)}</span></div>
                  {c.notes && <p className="text-muted">“{c.notes}”</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Measurements & entries" icon={Ruler} />
          {entries.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No entries yet.</p> : (
            <div className="px-5 pb-4 max-h-80 overflow-y-auto">
              {measured.length > 0 && (
                <table className="mb-3 w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Date</th>{Object.keys(measured[0].measurements!).map((k) => <th key={k} className="py-1 font-medium capitalize">{k} (cm)</th>)}</tr></thead>
                  <tbody>{measured.map((m) => <tr key={m.id} className="border-t border-line/70"><td className="py-1.5">{fmtShort(m.date)}</td>{Object.values(m.measurements!).map((v, i) => <td key={i} className="tabular-nums">{v}</td>)}</tr>)}</tbody>
                </table>
              )}
              <ul className="divide-y divide-line/70 text-sm">
                {entries.filter((e) => e.weight).map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-1.5">
                    <span>{fmtShort(e.date)}</span>
                    <span className="flex items-center gap-2"><span className="tabular-nums">{e.weight} kg</span>
                      <button aria-label="Delete entry" onClick={async () => { if (await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', danger: true })) deleteProgress(e.id) }} className="p-1 text-muted hover:text-miss"><Trash2 size={14} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', warn && 'text-miss')}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  )
}

/* ───────────── Notes (private) */

function NotesTab({ client }: { client: Client }) {
  const { notes, addNote, updateNote, deleteNote } = useStore()
  const mine = notes.filter((n) => n.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
  const [text, setText] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const add = () => {
    if (!text.trim()) return
    addNote(client.id, text.trim())
    setText('')
    toast.success('Note added')
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-sm text-ink-soft"><Lock size={15} /> Private notes. {client.name.split(' ')[0]} never sees these.</p>
      <Card className="p-4">
        <Textarea aria-label="New note" placeholder={`Write a note about ${client.name.split(' ')[0]}…`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add() }} />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted">Dated today · Ctrl/⌘ + Enter to save</span>
          <Button variant="primary" onClick={add} disabled={!text.trim()}>Add note</Button>
        </div>
      </Card>
      {mine.length === 0 ? <EmptyState title="No notes yet" text="Jot down injuries, preferences or how sessions are going." /> : (
        <ul className="space-y-3">
          {mine.map((n) => (
            <Card as="article" key={n.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{fmtDay(n.date)}</span>
                {editId !== n.id && (
                  <span className="flex gap-1">
                    <button aria-label="Edit note" onClick={() => { setEditId(n.id); setEditText(n.text) }} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-stone-100"><Pencil size={15} /></button>
                    <button aria-label="Delete note" onClick={async () => { if (await confirm({ title: 'Delete this note?', confirmLabel: 'Delete', danger: true })) { deleteNote(n.id); toast.success('Note deleted') } }} className="p-1.5 rounded-lg text-muted hover:text-miss hover:bg-stone-100"><Trash2 size={15} /></button>
                  </span>
                )}
              </div>
              {editId === n.id ? (
                <div className="mt-2">
                  <Textarea aria-label="Edit note" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" onClick={() => { updateNote(n.id, editText.trim() || n.text); setEditId(null); toast.success('Note saved') }}>Save</Button>
                  </div>
                </div>
              ) : <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft whitespace-pre-wrap">{n.text}</p>}
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}

