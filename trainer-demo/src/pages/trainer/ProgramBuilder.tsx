import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import {
  BookmarkPlus, Check, CopyPlus, Copy, Eraser, FilePlus2, GripVertical, Info, MoreHorizontal, Moon, PenLine, Plus, Save, Search,
  Send, StickyNote, Trash2, Repeat2, Replace,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useClient, useLibraryWorkouts, useWorkoutMap } from '../../store/hooks'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Field'
import { Menu, Badge } from '../../components/ui/misc'
import { Modal } from '../../components/ui/Modal'
import { RichEditor } from '../../components/RichEditor'
import { AssignProgramModal } from '../../components/AssignDialogs'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import { cloneWeek, copyWorkout, emptyWeek } from '../../lib/programs'
import { addDays, DAY_NAMES, DAY_SHORT, fmtDM } from '../../lib/date'
import { isHtmlEmpty, workoutSummary } from '../../lib/workout'
import { uid } from '../../lib/id'
import { cn } from '../../lib/cn'
import type { Program, ProgramDay, Workout } from '../../types'

const blank = (): Program => {
  const now = new Date().toISOString()
  return { id: uid('p-'), name: '', description: '', goal: '', daysPerWeek: 3, weeks: Array.from({ length: 4 }, emptyWeek), status: 'active', createdAt: now, updatedAt: now }
}

export function ProgramBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const stored = useStore((s) => s.programs.find((p) => p.id === id))
  const { saveProgram, saveProgramAsTemplate, saveWorkout } = useStore()
  const workouts = useWorkoutMap()
  const library = useLibraryWorkouts()
  const initial = useMemo(() => (id ? stored : blank()), [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [p, setP] = useState<Program | undefined>(initial)
  const [savedJson, setSavedJson] = useState(id && initial ? JSON.stringify(initial) : '')
  const [picker, setPicker] = useState<{ week: number; day: number } | null>(null)
  const [noteFor, setNoteFor] = useState<{ week: number; day: number } | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const client = useClient(p?.clientId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))

  useEffect(() => { setP(initial); setSavedJson(id && initial ? JSON.stringify(initial) : '') }, [initial, id])

  const dirty = !!p && JSON.stringify(p) !== savedJson && (!!id || !!p.name || p.weeks.some((w) => w.days.some((d) => d.workoutId)))
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname && !nextLocation.search.includes('program='))

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!p) return <div className="py-16 text-center"><p className="font-semibold">Program not found</p><Link to="/programs" className="text-brand-700 underline">Back to programs</Link></div>

  const isClientCopy = !!p.clientId
  const set = (patch: Partial<Program>) => setP((x) => (x ? { ...x, ...patch } : x))
  const setDay = (wi: number, di: number, patch: Partial<ProgramDay>) =>
    set({ weeks: p.weeks.map((w, i) => (i === wi ? { ...w, days: w.days.map((d, j) => (j === di ? { ...d, ...patch } : d)) } : w)) })

  const save = (quiet = false) => {
    const name = p.name.trim() || 'Untitled program'
    const result = saveProgram({ ...p, name })
    setP(result)
    setSavedJson(JSON.stringify(result))
    if (!quiet) toast.success(isClientCopy ? `Saved — ${client?.name.split(' ')[0]}’s calendar is updated` : 'Program saved')
    if (!id) setTimeout(() => navigate(`/programs/${result.id}`, { replace: true }), 0)
    return result
  }

  const setDuration = async (n: number) => {
    n = Math.max(1, Math.min(52, n || 1))
    if (n === p.weeks.length) return
    if (n > p.weeks.length) {
      const last = p.weeks[p.weeks.length - 1]
      const extra = Array.from({ length: n - p.weeks.length }, () => (last ? cloneWeek(last) : emptyWeek()))
      set({ weeks: [...p.weeks, ...extra] })
    } else {
      const removed = p.weeks.slice(n)
      if (removed.some((w) => w.days.some((d) => d.workoutId)) && !(await confirm({ title: `Remove the last ${p.weeks.length - n} week${p.weeks.length - n > 1 ? 's' : ''}?`, message: 'Workouts planned in those weeks will be taken off this program.', confirmLabel: 'Remove weeks', danger: true }))) return
      set({ weeks: p.weeks.slice(0, n) })
    }
  }

  const copyWeekOneToAll = async () => {
    if (p.weeks.length < 2) return
    if (!(await confirm({ title: 'Copy Week 1 to every week?', message: `Weeks 2–${p.weeks.length} will be replaced with Week 1’s plan.`, confirmLabel: 'Copy to all weeks' }))) return
    set({ weeks: [p.weeks[0], ...p.weeks.slice(1).map(() => cloneWeek(p.weeks[0]))] })
    toast.success('Week 1 copied to all weeks')
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const [fw, fd] = String(e.active.id).split('-').map(Number)
    const [tw, td] = String(e.over.id).split('-').map(Number)
    if (fw === tw && fd === td) return
    const weeks = p.weeks.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d })) }))
    const a = weeks[fw].days[fd]
    weeks[fw].days[fd] = weeks[tw].days[td]
    weeks[tw].days[td] = a
    set({ weeks })
  }

  /** Picking an existing workout: client programs get their own copy. */
  const placeWorkout = (wi: number, di: number, w: Workout) => {
    let wid = w.id
    if (isClientCopy && w.clientId !== p.clientId) {
      const c = saveWorkout(copyWorkout(w, { clientId: p.clientId, sourceId: w.clientId ? w.sourceId : w.id }))
      wid = c.id
    }
    setDay(wi, di, { workoutId: wid })
    setPicker(null)
  }

  const createNewFromDay = (wi: number, di: number) => {
    const saved = save(true)
    setPicker(null)
    navigate(`/workouts/new?program=${saved.id}&week=${wi}&day=${di}${saved.clientId ? `&client=${saved.clientId}` : ''}`)
  }

  const planned = p.weeks[0]?.days.filter((d) => d.workoutId).length ?? 0

  return (
    <div className="pb-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to={client ? `/clients/${client.id}?tab=program` : '/programs'} className="text-sm text-muted hover:text-ink">← {client ? client.name : 'Programs'}</Link>
        <span className="flex-1" />
        <span className="text-[13px] text-muted" aria-live="polite">{dirty ? 'Unsaved changes' : savedJson ? <span className="inline-flex items-center gap-1 text-done"><Check size={14} /> Saved</span> : ''}</span>
        {isClientCopy ? (
          <Button icon={BookmarkPlus} onClick={() => { const t = saveProgramAsTemplate(save(true).id, `${p.name} (template)`); if (t) toast.success('Saved a copy to your program library', { label: 'Open', onClick: () => navigate(`/programs/${t.id}`) }) }}>Save as template</Button>
        ) : (
          <Button icon={Send} onClick={() => { save(true); setAssignOpen(true) }}>Assign to clients</Button>
        )}
        <Button variant="primary" icon={Save} onClick={() => save()}>Save program</Button>
      </div>

      {isClientCopy ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-plan-bg px-4 py-3 text-sm text-plan">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>You’re editing <strong>{client?.name}</strong>’s personal copy, starting {fmtDM(p.startDate!)}. The master program and other clients aren’t affected. Saving updates their upcoming sessions (completed and manually moved sessions are kept).</span>
        </div>
      ) : id && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-ink-soft">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>You’re editing the master template. Clients already on this program keep their own copies — changes here apply to future assignments.</span>
        </div>
      )}

      {/* Details */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Program name" aria-label="Program name" autoFocus={!id}
            className="w-full bg-transparent text-[28px] sm:text-[32px] font-semibold tracking-tight placeholder:text-muted/60 focus:outline-none" />
          <Textarea aria-label="Description" placeholder="What’s this program about? (optional)" value={p.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="min-h-[64px]" />
        </div>
        <div className="grid grid-cols-3 gap-3 content-start">
          <Input label="Weeks" type="number" min={1} max={52} value={p.weeks.length} onChange={(e) => setDuration(parseInt(e.target.value, 10))} />
          <Input label="Days / week" type="number" min={1} max={7} value={p.daysPerWeek} onChange={(e) => set({ daysPerWeek: Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 1)) })} />
          <Input label="Goal" optional placeholder="e.g. Strength" value={p.goal ?? ''} onChange={(e) => set({ goal: e.target.value })} />
          <p className="col-span-3 text-xs text-muted">{planned} of {p.daysPerWeek} training days planned in week 1.</p>
        </div>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight mr-auto">Weekly schedule</h2>
        <span className="hidden md:inline text-[13px] text-muted mr-2">Drag workouts between days</span>
        <Button size="sm" icon={Repeat2} disabled={p.weeks.length < 2} onClick={copyWeekOneToAll}>Copy Week 1 to all weeks</Button>
        <Button size="sm" icon={Plus} onClick={() => set({ weeks: [...p.weeks, emptyWeek()] })}>Add week</Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="space-y-4">
          {p.weeks.map((week, wi) => (
            <div key={week.id} className="rounded-2xl border border-line/70 bg-white shadow-card p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-semibold">Week {wi + 1}</h3>
                {p.startDate && <span className="text-xs text-muted">from {fmtDM(addDays(p.startDate, wi * 7))}</span>}
                <input value={week.note ?? ''} onChange={(e) => set({ weeks: p.weeks.map((w, i) => (i === wi ? { ...w, note: e.target.value } : w)) })} placeholder="Add a note for this week…" aria-label={`Week ${wi + 1} note`}
                  className="ml-2 flex-1 min-w-0 bg-transparent text-sm text-ink-soft placeholder:text-muted/70 focus:outline-none h-8" />
                <Menu
                  trigger={(t) => <button {...t} aria-label={`Week ${wi + 1} actions`} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-black/5"><MoreHorizontal size={18} /></button>}
                  items={[
                    { label: 'Duplicate week', icon: CopyPlus, onClick: () => { set({ weeks: [...p.weeks.slice(0, wi + 1), cloneWeek(week), ...p.weeks.slice(wi + 1)] }); toast.success(`Week ${wi + 1} duplicated`) } },
                    { label: 'Make every day rest', icon: Eraser, onClick: () => set({ weeks: p.weeks.map((w, i) => (i === wi ? emptyWeek() : w)) }) },
                    ...(p.weeks.length > 1 ? ['divider' as const, { label: 'Remove week', icon: Trash2, danger: true, onClick: async () => { if (!week.days.some((d) => d.workoutId) || (await confirm({ title: `Remove week ${wi + 1}?`, confirmLabel: 'Remove', danger: true }))) set({ weeks: p.weeks.filter((_, i) => i !== wi) }) } }] : []),
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {week.days.map((d, di) => (
                  <DayCell key={di} id={`${wi}-${di}`} label={DAY_SHORT[di]} weekLabel={`week ${wi + 1}`} day={d} workout={d.workoutId ? workouts.get(d.workoutId) : undefined}
                    onAdd={() => setPicker({ week: wi, day: di })}
                    onOpen={() => { if (!d.workoutId) return; if (dirty) save(true); navigate(`/workouts/${d.workoutId}`) }}
                    onReplace={() => setPicker({ week: wi, day: di })}
                    onRest={() => setDay(wi, di, { workoutId: null })}
                    onNote={() => setNoteFor({ week: wi, day: di })}
                    onDuplicateNext={di < 6 ? () => { setDay(wi, di + 1, { ...d }); toast.success(`Copied to ${DAY_NAMES[di + 1]}`) } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      <WorkoutPicker
        open={!!picker}
        where={picker ? `Week ${picker.week + 1}, ${DAY_NAMES[picker.day]}` : ''}
        onClose={() => setPicker(null)}
        library={isClientCopy ? [...library, ...[...workouts.values()].filter((w) => w.clientId === p.clientId)] : library}
        clientName={client?.name.split(' ')[0]}
        onPick={(w) => picker && placeWorkout(picker.week, picker.day, w)}
        onCreateFull={() => picker && createNewFromDay(picker.week, picker.day)}
        onCreateQuick={(name, html) => {
          if (!picker) return
          const now = new Date().toISOString()
          const w = saveWorkout({ id: uid('w-'), name: name.trim() || `${DAY_NAMES[picker.day]} workout`, mode: 'write', html, blocks: [], clientId: p.clientId, createdAt: now, updatedAt: now })
          setDay(picker.week, picker.day, { workoutId: w.id })
          setPicker(null)
          toast.success(`“${w.name}” created${p.clientId ? '' : ' and saved to your library'}`)
        }}
      />

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} size="sm" title={noteFor ? `Note for ${DAY_NAMES[noteFor.day]}, week ${noteFor.week + 1}` : ''}
        footer={<Button variant="primary" onClick={() => setNoteFor(null)}>Done</Button>}>
        {noteFor && <Textarea aria-label="Day note" autoFocus placeholder="e.g. Optional — swap for a walk if sore" value={p.weeks[noteFor.week].days[noteFor.day].note ?? ''} onChange={(e) => setDay(noteFor.week, noteFor.day, { note: e.target.value })} />}
      </Modal>

      <AssignProgramModal open={assignOpen} programId={p.id} onClose={() => setAssignOpen(false)} />

      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} size="sm" title="Save changes to this program?"
        footer={<>
          <Button variant="ghost" onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button onClick={() => blocker.proceed?.()}>Discard changes</Button>
          <Button variant="primary" onClick={() => { saveProgram({ ...p, name: p.name.trim() || 'Untitled program' }); toast.success('Program saved'); blocker.proceed?.() }}>Save & leave</Button>
        </>}>
        <p className="text-sm text-ink-soft">You’ve made changes that haven’t been saved yet.</p>
      </Modal>
    </div>
  )
}

function DayCell({ id, label, weekLabel, day, workout, onAdd, onOpen, onReplace, onRest, onNote, onDuplicateNext }: {
  id: string; label: string; weekLabel?: string; day: ProgramDay; workout?: Workout
  onAdd: () => void; onOpen: () => void; onReplace: () => void; onRest: () => void; onNote: () => void; onDuplicateNext?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const drag = useDraggable({ id, disabled: !workout })
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined
  return (
    <div ref={setNodeRef} className={cn('relative min-h-[104px] rounded-xl border p-2 transition-colors', isOver ? 'border-brand-400 bg-brand-50' : workout ? 'border-line bg-white' : 'border-dashed border-line bg-neutral-50/50')}>
      <p className="px-1 text-xs font-medium text-muted">{label}</p>
      {workout ? (
        <div ref={drag.setNodeRef} style={style} className={cn('mt-1 rounded-lg bg-brand-50 border border-brand-100 p-2', drag.isDragging && 'z-30 shadow-pop relative opacity-95')}>
          <div className="flex items-start gap-1">
            <button aria-label={`Drag ${workout.name}`} className="mt-0.5 -ml-0.5 cursor-grab touch-none text-brand-400 hover:text-brand-700" {...drag.listeners} {...drag.attributes}><GripVertical size={14} /></button>
            <button onClick={onOpen} className="flex-1 min-w-0 text-left text-[13px] font-medium leading-snug text-brand-800 hover:underline">{workout.name}</button>
            <Menu
              trigger={(t) => <button {...t} aria-label="Day actions" className="-mr-1 -mt-0.5 h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-md text-brand-600 hover:bg-brand-100"><MoreHorizontal size={15} /></button>}
              items={[
                { label: 'Open & edit workout', icon: PenLine, onClick: onOpen },
                { label: 'Replace workout', icon: Replace, onClick: onReplace },
                ...(onDuplicateNext ? [{ label: 'Duplicate to next day', icon: Copy, onClick: onDuplicateNext }] : []),
                { label: day.note ? 'Edit note' : 'Add note', icon: StickyNote, onClick: onNote },
                'divider',
                { label: 'Make rest day', icon: Moon, onClick: onRest, danger: true },
              ]}
            />
          </div>
        </div>
      ) : (
        <button onClick={onAdd} aria-label={`Add a workout on ${label}${weekLabel ? ', ' + weekLabel : ''}`} className="mt-1 flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-muted hover:bg-white hover:text-brand-700 transition-colors">
          <span className="text-[13px]">Rest</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium"><Plus size={13} /> Add</span>
        </button>
      )}
      {day.note && <button onClick={onNote} className="mt-1 block w-full truncate px-1 text-left text-[11px] text-ink-soft hover:underline" title={day.note}><StickyNote size={11} className="inline -mt-0.5 mr-1" />{day.note}</button>}
      {!workout && !day.note && <button onClick={onNote} className="sr-only focus:not-sr-only text-xs">Add note</button>}
    </div>
  )
}

function WorkoutPicker({ open, onClose, where, library, onPick, onCreateFull, onCreateQuick, clientName }: {
  open: boolean; onClose: () => void; where: string; library: Workout[]; clientName?: string
  onPick: (w: Workout) => void; onCreateFull: () => void; onCreateQuick: (name: string, html: string) => void
}) {
  const [tab, setTab] = useState<'choose' | 'write'>('choose')
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [html, setHtml] = useState('')
  useEffect(() => { if (open) { setTab('choose'); setQ(''); setName(''); setHtml('') } }, [open])
  const rows = library.filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Add a workout — ${where}`}
      description={clientName ? `Library workouts are copied for ${clientName}, so you can tweak them just for them.` : undefined}
      footer={tab === 'write' ? <><Button variant="ghost" onClick={() => setTab('choose')}>Back</Button><Button variant="primary" disabled={isHtmlEmpty(html)} onClick={() => onCreateQuick(name, html)}>Create & add</Button></> : undefined}>
      {tab === 'choose' ? (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <button onClick={() => setTab('write')} className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-left hover:border-brand-300">
              <PenLine size={18} className="text-brand-600" /><span><span className="block text-sm font-semibold">Write a new workout here</span><span className="text-xs text-muted">Quick Write, without leaving</span></span>
            </button>
            <button onClick={onCreateFull} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left hover:border-line-strong">
              <FilePlus2 size={18} className="text-ink-soft" /><span><span className="block text-sm font-semibold">Open the full editor</span><span className="text-xs text-muted">Saves this program first</span></span>
            </button>
          </div>
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or choose an existing workout…" aria-label="Search workouts" className="h-10 w-full rounded-xl border border-line pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
          </div>
          <ul className="max-h-[42vh] overflow-y-auto divide-y divide-line/70 rounded-xl border border-line">
            {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No workouts match.</li>}
            {rows.map((w) => (
              <li key={w.id}>
                <button onClick={() => onPick(w)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50">
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">{w.name}{w.clientId && <Badge tone="blue">{clientName}’s</Badge>}</span>
                    <span className="block truncate text-xs text-muted">{workoutSummary(w)}</span>
                  </span>
                  <span className="text-xs text-muted">{w.mode === 'write' ? 'Quick Write' : 'Structured'}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="grid gap-3">
          <Input label="Workout name" placeholder="e.g. Lower Body" value={name} onChange={(e) => setName(e.target.value)} />
          <RichEditor value={html} onChange={setHtml} minHeight={220} compact />
        </div>
      )}
    </Modal>
  )
}
