import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Circle, Plus, Zap, Library } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/ui'
import { useActiveClients, useClientMap, useLibraryWorkouts, useWorkoutMap } from '../../store/hooks'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { PageHeader, Segmented } from '../../components/ui/misc'
import { Modal } from '../../components/ui/Modal'
import { SessionModal } from '../../components/AssignDialogs'
import { toast } from '../../components/ui/toast'
import { sessionState, type SessionState } from '../../lib/stats'
import { addDays, DAY_SHORT, fmtClock, fmtDay, fmtDM, fmtLong, fmtMonth, fromISO, startOfWeek, toISO, today, weekDates } from '../../lib/date'
import { cn } from '../../lib/cn'
import type { ISODate, ScheduledSession } from '../../types'

const stateStyle: Record<SessionState, string> = {
  completed: 'bg-done-bg border-done/25 text-done',
  missed: 'bg-miss-bg border-miss/25 text-miss',
  today: 'bg-sage-50 border-sage-300 text-sage-800',
  upcoming: 'bg-plan-bg border-plan/20 text-plan',
  appointment: 'bg-appt-bg border-appt/25 text-appt',
}
const StateIcon = ({ s }: { s: SessionState }) => {
  const I = s === 'completed' ? CheckCircle2 : s === 'missed' ? CircleAlert : s === 'appointment' ? CalendarClock : Circle
  return <I size={13} className="shrink-0" />
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const clientFilter = params.get('client') ?? ''
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState<ISODate>(today())
  const [openId, setOpenId] = useState<string | null>(null)
  const [addFor, setAddFor] = useState<ISODate | null>(null)
  const sessions = useStore((s) => s.sessions)
  const moveSession = useStore((s) => s.moveSession)
  const clients = useActiveClients()
  const clientMap = useClientMap()
  const workouts = useWorkoutMap()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }))
  const t = today()

  const activeIds = useMemo(() => new Set(clients.map((c) => c.id)), [clients])
  const visible = useMemo(() => sessions.filter((s) => activeIds.has(s.clientId) && (!clientFilter || s.clientId === clientFilter)), [sessions, activeIds, clientFilter])
  const byDate = useMemo(() => {
    const m = new Map<ISODate, ScheduledSession[]>()
    for (const s of visible) m.set(s.date, [...(m.get(s.date) ?? []), s])
    for (const list of m.values()) list.sort((a, b) => (a.time ?? 'zz').localeCompare(b.time ?? 'zz') || a.clientId.localeCompare(b.clientId))
    return m
  }, [visible])

  const monday = startOfWeek(anchor)
  const days = weekDates(monday)
  const monthStart = toISO(new Date(fromISO(anchor).getFullYear(), fromISO(anchor).getMonth(), 1))
  const gridStart = startOfWeek(monthStart)
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const month = fromISO(anchor).getMonth()

  const step = (dir: 1 | -1) => {
    if (view === 'week') setAnchor(addDays(anchor, 7 * dir))
    else { const d = fromISO(anchor); setAnchor(toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1))) }
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const s = sessions.find((x) => x.id === e.active.id)
    const date = String(e.over.id)
    if (!s || s.date === date) return
    moveSession(s.id, date)
    toast.success(`Moved to ${fmtDay(date)}`, { label: 'Undo', onClick: () => moveSession(s.id, s.date) })
  }

  const label = (s: ScheduledSession) => (s.kind === 'appointment' ? s.title ?? 'PT session' : workouts.get(s.workoutId!)?.name ?? 'Workout')

  return (
    <div>
      <PageHeader title="Calendar"
        subtitle={view === 'week' ? `${fmtDM(days[0])} – ${fmtDM(days[6])} ${fromISO(days[6]).getFullYear()}` : fmtMonth(anchor)}
        actions={<Button variant="primary" icon={Plus} onClick={() => setAddFor(t)}>Add session</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button aria-label="Previous" onClick={() => step(-1)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-white hover:border-line-strong"><ChevronLeft size={18} /></button>
          <button onClick={() => setAnchor(t)} className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:border-line-strong">Today</button>
          <button aria-label="Next" onClick={() => step(1)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-white hover:border-line-strong"><ChevronRight size={18} /></button>
        </div>
        <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        <select aria-label="Filter by client" value={clientFilter} onChange={(e) => setParams(e.target.value ? { client: e.target.value } : {})} className="h-9 rounded-lg border border-line bg-white px-2.5 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="ml-auto hidden md:flex items-center gap-3 text-xs text-ink-soft">
          {(['upcoming', 'completed', 'missed', 'appointment'] as SessionState[]).map((s) => (
            <span key={s} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5', stateStyle[s])}><StateIcon s={s} />{s === 'upcoming' ? 'Scheduled' : s === 'appointment' ? 'Appointment' : s[0].toUpperCase() + s.slice(1)}</span>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {view === 'week' ? (
          <div className="grid gap-2 lg:grid-cols-7">
            {days.map((d, i) => {
              const list = byDate.get(d) ?? []
              const restForClient = clientFilter && !list.some((s) => s.kind === 'workout')
              return (
                <DayDrop key={d} id={d} className={cn('rounded-2xl border bg-white p-2 lg:min-h-[420px] flex flex-col', d === t ? 'border-sage-300 ring-2 ring-sage-100' : 'border-line/70')}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-sm"><span className="font-semibold">{DAY_SHORT[i]}</span> <span className={cn('text-muted', d === t && 'text-sage-700 font-medium')}>{fromISO(d).getDate()}</span></span>
                    <button aria-label={`Add session on ${fmtLong(d)}`} onClick={() => setAddFor(d)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted hover:bg-stone-100 hover:text-ink"><Plus size={16} /></button>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    {list.map((s) => (
                      <SessionCard key={s.id} s={s} onOpen={() => setOpenId(s.id)} title={label(s)} clientName={clientFilter ? undefined : clientMap.get(s.clientId)?.name} />
                    ))}
                    {list.length === 0 && <p className="px-1 py-2 text-[13px] text-muted/80">{restForClient ? 'Rest day' : '—'}</p>}
                    {restForClient && list.length > 0 && <p className="px-1 text-[12px] text-muted">Rest day</p>}
                  </div>
                </DayDrop>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-line/70 bg-white overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">{DAY_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {monthDays.map((d) => {
                const list = byDate.get(d) ?? []
                const inMonth = fromISO(d).getMonth() === month
                return (
                  <DayDrop key={d} id={d} className={cn('min-h-[96px] sm:min-h-[118px] border-b border-r border-line/60 p-1', !inMonth && 'bg-stone-50/70')}>
                    <button onClick={() => { setAnchor(d); setView('week') }} className={cn('mb-1 h-6 min-w-6 rounded-full px-1.5 text-xs', d === t ? 'bg-sage-600 text-white font-semibold' : inMonth ? 'text-ink-soft hover:bg-stone-100' : 'text-muted/60')}>{fromISO(d).getDate()}</button>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((s) => <SessionCard key={s.id} s={s} compact onOpen={() => setOpenId(s.id)} title={clientFilter ? label(s) : clientMap.get(s.clientId)?.name.split(' ')[0] ?? ''} />)}
                      {list.length > 3 && <button onClick={() => { setAnchor(d); setView('week') }} className="px-1 text-[11px] text-muted hover:text-ink">+{list.length - 3} more</button>}
                    </div>
                  </DayDrop>
                )
              })}
            </div>
          </div>
        )}
      </DndContext>
      <p className="mt-3 text-xs text-muted">Tip: drag a session to another day to reschedule it. Click it to open, mark complete, duplicate or swap.</p>

      <SessionModal sessionId={openId} onClose={() => setOpenId(null)} />
      <AddSessionModal date={addFor} onClose={() => setAddFor(null)} defaultClient={clientFilter} />
    </div>
  )
}

function DayDrop({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={cn(className, isOver && 'bg-sage-50/80 border-sage-300')}>{children}</div>
}

function SessionCard({ s, onOpen, title, clientName, compact }: { s: ScheduledSession; onOpen: () => void; title: string; clientName?: string; compact?: boolean }) {
  const st = sessionState(s)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: s.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <button ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onOpen}
      className={cn('block w-full rounded-lg border text-left transition-shadow touch-manipulation', stateStyle[st], compact ? 'px-1.5 py-0.5' : 'px-2.5 py-2', isDragging ? 'relative z-30 shadow-pop cursor-grabbing' : 'hover:shadow-card cursor-grab')}
      aria-label={`${title}${clientName ? ' for ' + clientName : ''}, ${st}. Drag to move.`}>
      <span className={cn('flex items-center gap-1.5', compact ? 'text-[11px]' : 'text-[13px] font-medium')}>
        <StateIcon s={st} /><span className="truncate">{title}</span>
      </span>
      {!compact && (clientName || s.time) && <span className="mt-0.5 block truncate text-xs opacity-80 pl-[19px]">{[s.time && fmtClock(s.time), clientName].filter(Boolean).join(' · ')}</span>}
    </button>
  )
}

function AddSessionModal({ date, onClose, defaultClient }: { date: ISODate | null; onClose: () => void; defaultClient?: string }) {
  const clients = useActiveClients()
  const library = useLibraryWorkouts()
  const openQuick = useUi((s) => s.openQuickSession)
  const { scheduleWorkout, addAppointment } = useStore()
  const [kind, setKind] = useState<'workout' | 'appointment'>('workout')
  const [clientId, setClientId] = useState('')
  const [d, setD] = useState<ISODate>(today())
  const [wid, setWid] = useState('')
  const [time, setTime] = useState('07:00')
  const [title, setTitle] = useState('PT session')
  const [err, setErr] = useState('')
  const [lastDate, setLastDate] = useState<ISODate | null>(null)
  if (date && date !== lastDate) { setLastDate(date); setD(date); setClientId(defaultClient ?? ''); setErr(''); setWid(''); setKind('workout') }
  if (!date && lastDate) setLastDate(null)

  const save = () => {
    if (!clientId) return setErr('Choose a client.')
    const name = clients.find((c) => c.id === clientId)?.name.split(' ')[0]
    if (kind === 'appointment') {
      addAppointment({ clientId, date: d, time, title })
      toast.success(`Appointment with ${name} added for ${fmtDay(d)}`)
    } else {
      if (!wid) return setErr('Choose a workout, or write a quick session instead.')
      scheduleWorkout({ workoutId: wid, clientId, date: d })
      toast.success(`Scheduled for ${name} on ${fmtDay(d)}`)
    }
    onClose()
  }

  return (
    <Modal open={!!date} onClose={onClose} size="md" title="Add to calendar"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{kind === 'workout' ? 'Schedule workout' : 'Add appointment'}</Button></>}>
      <div className="grid gap-4">
        <button onClick={() => { onClose(); openQuick({ date: d, clientId: clientId || undefined }) }} className="flex items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-left hover:border-sage-300">
          <Zap size={18} className="text-sage-600" />
          <span><span className="block text-sm font-semibold">Write a free-text session</span><span className="text-xs text-muted">Opens Quick Session for {fmtDay(d)}</span></span>
        </button>
        <Segmented value={kind} onChange={(v) => { setKind(v); setErr('') }} options={[{ value: 'workout', label: 'Library workout', icon: Library }, { value: 'appointment', label: 'PT appointment', icon: CalendarClock }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setErr('') }}>
            <option value="">Choose a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Date" type="date" value={d} onChange={(e) => setD(e.target.value || today())} />
          {kind === 'workout' ? (
            <div className="sm:col-span-2">
              <Select label="Workout" value={wid} onChange={(e) => { setWid(e.target.value); setErr('') }}>
                <option value="">Choose from your library…</option>
                {library.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </div>
          ) : (
            <>
              <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </>
          )}
        </div>
        {err && <p role="alert" className="text-sm text-miss">{err}</p>}
      </div>
    </Modal>
  )
}
