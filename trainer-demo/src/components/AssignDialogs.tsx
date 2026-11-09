import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck2, CheckCircle2, Copy, MoveRight, Pencil, Trash2, Undo2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Field'
import { toast } from './ui/toast'
import { confirm } from './ui/confirm'
import { Avatar, Badge, stateLabel, stateTone } from './ui/misc'
import { WorkoutView } from './WorkoutView'
import { useStore } from '../store/useStore'
import { useActiveClients, useClientMap, useLibraryWorkouts, useTemplatePrograms } from '../store/hooks'
import { addDays, fmtClock, fmtDay, fmtLong, startOfWeek, today } from '../lib/date'
import { sessionState, activeProgram } from '../lib/stats'
import { cn } from '../lib/cn'
import type { ID, ISODate } from '../types'

/* ───────────── Assign a single workout */

export function AssignWorkoutModal({ open, onClose, workoutId, beforeAssign }: { open: boolean; onClose: () => void; workoutId?: ID; beforeAssign?: () => ID | undefined }) {
  const clients = useActiveClients()
  const scheduleWorkout = useStore((s) => s.scheduleWorkout)
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(today())
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setDate(today()) } }, [open])

  const go = () => {
    if (!clientId) return setErr('Choose a client.')
    const id = beforeAssign ? beforeAssign() : workoutId
    if (!id) return
    const s = scheduleWorkout({ workoutId: id, clientId, date })
    if (!s) return toast.error('Could not assign that workout.')
    toast.success(`Assigned to ${clients.find((c) => c.id === clientId)?.name.split(' ')[0]} for ${fmtDay(date)}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Assign to a client" description="The client gets their own copy, so you can tweak it for them later without changing this workout." size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Assign</Button></>}>
      <div className="grid gap-4">
        <Select label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setErr('') }}>
          <option value="">Choose a client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        {err && <p role="alert" className="text-sm text-miss">{err}</p>}
      </div>
    </Modal>
  )
}

/* ───────────── Assign a program to one or more clients */

export function AssignProgramModal({ open, onClose, programId, clientId }: { open: boolean; onClose: () => void; programId?: ID; clientId?: ID }) {
  const clients = useActiveClients()
  const templates = useTemplatePrograms().filter((p) => p.status === 'active')
  const programs = useStore((s) => s.programs)
  const assignProgram = useStore((s) => s.assignProgram)
  const navigate = useNavigate()
  const [pid, setPid] = useState('')
  const [picked, setPicked] = useState<ID[]>([])
  const thisMon = startOfWeek(today())
  const [start, setStart] = useState<ISODate>(thisMon)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setPid(programId ?? '')
    setPicked(clientId ? [clientId] : [])
    setStart(thisMon)
    setErr('')
  }, [open, programId, clientId, thisMon])

  const replacing = picked.map((id) => activeProgram(programs, id)).filter(Boolean)
  const tpl = templates.find((p) => p.id === pid)

  const go = () => {
    if (!pid) return setErr('Choose a program.')
    if (!picked.length) return setErr('Choose at least one client.')
    const monday = startOfWeek(start)
    const created = assignProgram(pid, picked, monday)
    const names = picked.map((id) => clients.find((c) => c.id === id)?.name.split(' ')[0]).join(', ')
    toast.success(`${tpl?.name} assigned to ${names}`)
    onClose()
    if (created.length === 1) navigate(`/clients/${created[0].clientId}?tab=program`)
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign program" size="md"
      description="Each client gets their own copy. Changing a client’s copy never changes the master program."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={go}>Assign program</Button></>}>
      <div className="grid gap-4">
        {!programId && (
          <Select label="Program" value={pid} onChange={(e) => { setPid(e.target.value); setErr('') }}>
            <option value="">Choose a program…</option>
            {templates.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.weeks.length} weeks</option>)}
          </Select>
        )}
        {!clientId && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Clients</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
              {clients.map((c) => {
                const on = picked.includes(c.id)
                return (
                  <label key={c.id} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition-colors', on ? 'border-brand-300 bg-brand-50' : 'border-line hover:border-line-strong')}>
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} onChange={() => { setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id])); setErr('') }} />
                    <Avatar name={c.name} color={c.color} size={26} />
                    <span className="text-sm truncate">{c.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Starts</p>
          <div className="flex flex-wrap gap-2">
            {[thisMon, addDays(thisMon, 7)].map((d, i) => (
              <button key={d} onClick={() => setStart(d)} className={cn('rounded-xl border px-3 h-10 text-sm', start === d ? 'border-brand-400 bg-brand-50 text-brand-800 font-medium' : 'border-line hover:border-line-strong')}>
                {i === 0 ? 'This week' : 'Next week'} <span className="text-muted">· Mon {fmtDay(d).split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
            <input type="date" aria-label="Custom start date" value={start} onChange={(e) => e.target.value && setStart(startOfWeek(e.target.value))} className="h-10 rounded-xl border border-line px-3 text-sm" />
          </div>
          <p className="mt-1.5 text-xs text-muted">Programs start on a Monday. Days already gone this week are skipped.</p>
        </div>
        {replacing.length > 0 && (
          <p className="rounded-xl bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
            {replacing.length === 1 ? `This replaces “${replacing[0]!.name}”` : `This replaces ${replacing.length} current programs`} — completed history is kept, upcoming sessions from the old program are removed.
          </p>
        )}
        {err && <p role="alert" className="text-sm text-miss">{err}</p>}
      </div>
    </Modal>
  )
}

/* ───────────── Session details (calendar, dashboard, profile) */

export function SessionModal({ sessionId, onClose }: { sessionId: ID | null; onClose: () => void }) {
  const s = useStore((st) => st.sessions.find((x) => x.id === sessionId))
  const workout = useStore((st) => st.workouts.find((w) => w.id === s?.workoutId))
  const completion = useStore((st) => st.completions.find((c) => c.sessionId === sessionId))
  const clients = useClientMap()
  const library = useLibraryWorkouts()
  const { moveSession, duplicateSession, deleteSession, completeSession, undoCompletion, changeSessionWorkout } = useStore()
  const navigate = useNavigate()
  const [moveTo, setMoveTo] = useState('')
  const [dupTo, setDupTo] = useState('')
  const [swap, setSwap] = useState('')

  useEffect(() => {
    if (s) { setMoveTo(s.date); setDupTo(addDays(s.date, 7)); setSwap('') }
  }, [s?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = s ? clients.get(s.clientId) : undefined
  const state = s ? sessionState(s) : 'upcoming'
  const title = s?.kind === 'appointment' ? s.title ?? 'PT session' : workout?.name ?? 'Workout'
  const others = useMemo(() => library.filter((w) => w.id !== workout?.sourceId), [library, workout])

  if (!s || !client) return <Modal open={false} onClose={onClose} />

  const remove = async () => {
    if (await confirm({ title: 'Remove this session?', message: `${title} on ${fmtLong(s.date)} will be removed from ${client.name.split(' ')[0]}’s calendar.${completion ? ' Their logged results for it will be removed too.' : ''}`, confirmLabel: 'Remove', danger: true })) {
      deleteSession(s.id)
      toast.success('Session removed')
      onClose()
    }
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2.5"><Avatar name={client.name} color={client.color} size={30} /> {title}</span>}
      description={<>{client.name} · {fmtLong(s.date)}{s.time ? ` · ${fmtClock(s.time)}` : ''} <Badge tone={stateTone[state]} className="ml-1">{stateLabel[state]}</Badge></>}>
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          {s.kind === 'workout' && workout ? (
            <div className="rounded-2xl border border-line p-4 max-h-[46vh] overflow-y-auto"><WorkoutView workout={workout} /></div>
          ) : (
            <p className="text-sm text-muted">In-person appointment. Nothing for the client to log.</p>
          )}
          {completion && (
            <div className="mt-4 rounded-2xl bg-done-bg/60 p-4 text-sm">
              <p className="font-medium text-done flex items-center gap-1.5"><CheckCircle2 size={16} /> Completed {completion.by === 'trainer' ? '(marked by you)' : 'by client'}</p>
              {completion.notes && <p className="mt-1 text-ink-soft">“{completion.notes}”</p>}
              {completion.results.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-ink-soft">
                  {completion.results.slice(0, 6).map((r) => (
                    <li key={r.itemId}><span className="text-ink">{r.name}</span> — {r.sets.filter((x) => x.done).map((x) => `${x.reps ?? '–'}${x.weight ? '×' + x.weight + 'kg' : ''}`).join(', ') || 'not logged'}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="space-y-4">
          {s.kind === 'workout' && (
            <div className="grid gap-2">
              {s.status === 'completed' ? (
                <Button icon={Undo2} onClick={() => { undoCompletion(s.id); toast.info('Marked as not done') }}>Mark as not done</Button>
              ) : (
                <Button variant="primary" icon={CheckCircle2} onClick={() => { completeSession({ sessionId: s.id, by: 'trainer' }); toast.success('Marked complete') }}>Mark complete</Button>
              )}
              {workout && <Button icon={Pencil} onClick={() => { onClose(); navigate(`/workouts/${workout.id}`) }}>Edit {client.name.split(' ')[0]}’s workout</Button>}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Reschedule</p>
            <div className="flex gap-2">
              <input type="date" aria-label="New date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-10 flex-1 min-w-0 rounded-xl border border-line px-3 text-sm" />
              <Button icon={MoveRight} disabled={!moveTo || moveTo === s.date} onClick={() => { moveSession(s.id, moveTo); toast.success(`Moved to ${fmtDay(moveTo)}`) }}>Move</Button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Duplicate to</p>
            <div className="flex gap-2">
              <input type="date" aria-label="Duplicate to date" value={dupTo} onChange={(e) => setDupTo(e.target.value)} className="h-10 flex-1 min-w-0 rounded-xl border border-line px-3 text-sm" />
              <Button icon={Copy} disabled={!dupTo} onClick={() => { duplicateSession(s.id, dupTo); toast.success(`Copied to ${fmtDay(dupTo)}`) }}>Copy</Button>
            </div>
          </div>
          {s.kind === 'workout' && s.status !== 'completed' && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Swap for another workout</p>
              <div className="flex gap-2">
                <select aria-label="Choose workout" value={swap} onChange={(e) => setSwap(e.target.value)} className="h-10 flex-1 min-w-0 rounded-xl border border-line px-2 text-sm bg-white">
                  <option value="">Choose…</option>
                  {others.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <Button icon={CalendarCheck2} disabled={!swap} onClick={() => { changeSessionWorkout(s.id, swap); toast.success('Workout swapped'); setSwap('') }}>Swap</Button>
              </div>
            </div>
          )}
          <Button variant="ghost" icon={Trash2} className="text-miss hover:text-miss w-full" onClick={remove}>Remove session</Button>
        </div>
      </div>
    </Modal>
  )
}
