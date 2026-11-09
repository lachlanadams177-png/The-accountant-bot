import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Check, ClipboardList, Copy, Eye, FileText, LayoutList, MoreHorizontal, PenLine, RotateCcw, Save, Send, Trash2, Wand2, BookmarkPlus, Info,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useClient, useExercises, useLibraryWorkouts } from '../../store/hooks'
import { Button } from '../../components/ui/Button'
import { Menu, Segmented, Badge } from '../../components/ui/misc'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Field'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import { RichEditor } from '../../components/RichEditor'
import { StructuredBuilder } from '../../components/StructuredBuilder'
import { WorkoutView } from '../../components/WorkoutView'
import { AssignWorkoutModal } from '../../components/AssignDialogs'
import { uid } from '../../lib/id'
import { blocksToHtml, cloneBlocks, isHtmlEmpty, parseTextToBlocks, type ParsedLine } from '../../lib/workout'
import { activeProgram } from '../../lib/stats'
import { DAY_NAMES, timeAgo } from '../../lib/date'
import { cn } from '../../lib/cn'
import type { Workout, WorkoutMode } from '../../types'

type Body = Pick<Workout, 'name' | 'mode' | 'html' | 'blocks'>
const bodyOf = (w: Workout): Body => ({ name: w.name, mode: w.mode, html: w.html, blocks: w.blocks })
const same = (a: Body, b: Body) => JSON.stringify(a) === JSON.stringify(b)
const draftKey = (id: string) => `fernly-draft:${id}`

export function WorkoutEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const stored = useStore((s) => s.workouts.find((w) => w.id === id))
  const { saveWorkout, duplicateWorkout, deleteWorkout, programs, sessions, saveProgram } = useStore()
  const library = useLibraryWorkouts()
  const exercises = useExercises()

  // Build the starting workout once: existing, from a template, or blank.
  const initial = useMemo<Workout | null>(() => {
    if (id) return stored ?? null
    const now = new Date().toISOString()
    const tpl = params.get('template') ? library.find((w) => w.id === params.get('template')) : undefined
    const ex = params.get('exercise') ? exercises.find((e) => e.id === params.get('exercise')) : undefined
    const mode = (params.get('mode') as WorkoutMode) || (ex ? 'build' : 'write')
    return {
      id: uid('w-'),
      name: tpl ? `${tpl.name}` : '',
      mode: tpl?.mode ?? mode,
      html: tpl?.html ?? '',
      blocks: tpl ? cloneBlocks(tpl.blocks) : ex ? [{ type: 'exercise', id: uid('it-'), name: ex.name, exerciseId: ex.id }] : [],
      clientId: params.get('client') ?? undefined,
      createdAt: now,
      updatedAt: now,
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [w, setW] = useState<Workout | null>(initial)
  const [saved, setSaved] = useState<Body | null>(id && initial ? bodyOf(initial) : null)
  const [draftOffer, setDraftOffer] = useState<{ body: Body; at: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [programOpen, setProgramOpen] = useState(false)
  const [convert, setConvert] = useState<ParsedLine[] | null>(null)
  const [tplName, setTplName] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setW(initial); setSaved(id && initial ? bodyOf(initial) : null) }, [initial, id])

  // offer to restore an autosaved draft that differs from what's saved
  useEffect(() => {
    if (!initial) return
    try {
      const raw = localStorage.getItem(draftKey(id ?? 'new'))
      if (!raw) return
      const d = JSON.parse(raw) as { body: Body; at: string; id: string }
      if (!id && d.id && d.body && (d.body.name || !isHtmlEmpty(d.body.html) || d.body.blocks.length)) setDraftOffer(d)
      else if (id && !same(d.body, bodyOf(initial))) setDraftOffer(d)
    } catch { /* ignore broken drafts */ }
  }, [initial, id])

  const client = useClient(w?.clientId)
  const body = w ? bodyOf(w) : null
  const isEmpty = !body || (!body.name.trim() && isHtmlEmpty(body.html) && body.blocks.length === 0)
  const dirty = !!body && (saved ? !same(body, saved) : !isEmpty)

  // autosave a local draft while typing; flushed immediately when leaving
  const writeDraft = useCallback(() => {
    if (w && dirty) localStorage.setItem(draftKey(id ?? 'new'), JSON.stringify({ body: bodyOf(w), at: new Date().toISOString(), id: w.id }))
  }, [w, dirty, id])
  const writeDraftRef = useRef(writeDraft)
  writeDraftRef.current = writeDraft
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(writeDraft, 400)
    return () => clearTimeout(t)
  }, [writeDraft, dirty])
  useEffect(() => () => writeDraftRef.current(), [])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { writeDraftRef.current(); e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  const patch = (p: Partial<Workout>) => setW((x) => (x ? { ...x, ...p } : x))

  const save = useCallback((opts: { quiet?: boolean } = {}): Workout | undefined => {
    if (!w) return
    const name = w.name.trim() || 'Untitled workout'
    const result = saveWorkout({ ...w, name })
    setW(result)
    setSaved(bodyOf(result))
    localStorage.removeItem(draftKey(id ?? 'new'))
    setDraftOffer(null)

    // came from the program builder? drop it into that day
    const pid = params.get('program')
    if (pid && !id) {
      const p = useStore.getState().programs.find((x) => x.id === pid)
      const week = Number(params.get('week'))
      const day = Number(params.get('day'))
      if (p && p.weeks[week]) {
        const weeks = p.weeks.map((wk, wi) => (wi === week ? { ...wk, days: wk.days.map((d, di) => (di === day ? { ...d, workoutId: result.id } : d)) } : wk))
        saveProgram({ ...p, weeks })
        if (!opts.quiet) toast.success(`Saved and added to ${p.name}, week ${week + 1} ${DAY_NAMES[day]}`)
        setTimeout(() => navigate(`/programs/${pid}`, { replace: true }), 0)
        return result
      }
    }
    if (!opts.quiet) toast.success('Workout saved')
    if (!id) setTimeout(() => navigate(`/workouts/${result.id}`, { replace: true }), 0)
    return result
  }, [w, id, params, saveWorkout, saveProgram, navigate])

  // Ctrl/⌘+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  if (!w) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold">Workout not found</p>
        <Link to="/workouts" className="mt-2 inline-block text-sage-700 underline">Back to workouts</Link>
      </div>
    )
  }

  const usedIn = programs.filter((p) => p.weeks.some((wk) => wk.days.some((d) => d.workoutId === w.id)))
  const upcomingUses = sessions.filter((s) => s.workoutId === w.id && s.status !== 'completed').length

  const switchMode = (m: WorkoutMode) => {
    if (m === w.mode) return
    patch({ mode: m })
  }

  const startFrom = async (tplId: string) => {
    const tpl = library.find((x) => x.id === tplId)
    if (!tpl) return
    const hasContent = w.mode === 'write' ? !isHtmlEmpty(w.html) : w.blocks.length > 0
    if (hasContent && !(await confirm({ title: 'Replace what you’ve written?', message: `This swaps the current ${w.mode === 'write' ? 'text' : 'exercises'} for “${tpl.name}”. You can undo with Ctrl/⌘+Z in Quick Write, or reopen the draft.`, confirmLabel: 'Replace' }))) return
    if (w.mode === 'write') patch({ html: tpl.mode === 'write' ? tpl.html : blocksToHtml(tpl.blocks), name: w.name || tpl.name })
    else patch({ blocks: tpl.mode === 'build' ? cloneBlocks(tpl.blocks) : w.blocks, name: w.name || tpl.name })
    toast.info(`Started from “${tpl.name}”`)
  }

  const onDelete = async () => {
    const parts = []
    if (usedIn.length) parts.push(`It’s used in ${usedIn.length} program${usedIn.length > 1 ? 's' : ''} — those days will become rest days.`)
    if (upcomingUses) parts.push(`${upcomingUses} upcoming session${upcomingUses > 1 ? 's' : ''} will be removed from the calendar.`)
    const ok = await confirm({ title: `Delete “${w.name || 'this workout'}”?`, message: [...parts, 'Completed history is kept. This can’t be undone.'].join(' '), confirmLabel: 'Delete workout', danger: true })
    if (!ok) return
    localStorage.removeItem(draftKey(id ?? 'new'))
    setSaved(bodyOf(w)) // not dirty any more
    deleteWorkout(w.id)
    toast.success('Workout deleted')
    setTimeout(() => navigate('/workouts'), 0)
  }

  const onDuplicate = () => {
    const base = dirty || !id ? save({ quiet: true }) : w
    if (!base) return
    const copy = duplicateWorkout(base.id)
    if (copy) { toast.success('Duplicated — you’re now editing the copy'); setTimeout(() => navigate(`/workouts/${copy.id}`), 0) }
  }

  const saveAsTemplate = (name: string) => {
    const now = new Date().toISOString()
    const tpl = saveWorkout({ ...w, id: uid('w-'), name: name.trim() || w.name || 'Untitled workout', clientId: undefined, sourceId: undefined, blocks: cloneBlocks(w.blocks), createdAt: now, updatedAt: now })
    setTplName(null)
    toast.success(`Saved “${tpl.name}” to your workout library`, { label: 'Open', onClick: () => navigate(`/workouts/${tpl.id}`) })
  }

  const back = client ? { to: `/clients/${client.id}?tab=program`, label: client.name } : params.get('program') ? { to: `/programs/${params.get('program')}`, label: 'Program' } : { to: '/workouts', label: 'Workouts' }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Link to={back.to} className="text-sm text-muted hover:text-ink">← {back.label}</Link>
        <span className="flex-1" />
        <span className="text-[13px] text-muted min-w-[110px] text-right" aria-live="polite">
          {dirty ? 'Unsaved changes · draft kept' : saved ? <span className="inline-flex items-center gap-1 text-done"><Check size={14} /> Saved</span> : ''}
        </span>
        <Button icon={Eye} onClick={() => setPreview(true)}>Preview</Button>
        <Button variant="primary" icon={Save} onClick={() => save()}>Save workout</Button>
      </div>

      {client && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-plan-bg px-4 py-2.5 text-sm text-plan">
          <Info size={16} className="shrink-0" /> This is {client.name}’s personal copy. Changes only affect {client.name.split(' ')[0]} — your library and other clients stay the same.
        </div>
      )}
      {draftOffer && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warn/30 bg-warn-bg px-4 py-3 text-sm">
          <RotateCcw size={16} className="text-warn" />
          <span className="flex-1 text-ink-soft">You have unsaved changes from {timeAgo(draftOffer.at)}.</span>
          <Button size="sm" variant="secondary" onClick={() => { patch(draftOffer.body); setDraftOffer(null); toast.info('Draft restored') }}>Restore draft</Button>
          <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(draftKey(id ?? 'new')); setDraftOffer(null) }}>Discard</Button>
        </div>
      )}

      <input
        ref={nameRef}
        value={w.name}
        onChange={(e) => patch({ name: e.target.value })}
        placeholder="Workout name"
        aria-label="Workout name"
        autoFocus={!id && !w.name}
        className="w-full bg-transparent text-[28px] sm:text-[32px] font-semibold tracking-tight placeholder:text-muted/60 focus:outline-none"
      />

      <div className="mt-3 mb-5 flex flex-wrap items-center gap-2">
        <Segmented value={w.mode} onChange={switchMode} options={[{ value: 'write', label: 'Quick Write', icon: PenLine }, { value: 'build', label: 'Structured Builder', icon: LayoutList }]} />
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={Send} onClick={() => setAssignOpen(true)}>Assign to client</Button>
        <Button size="sm" variant="ghost" icon={ClipboardList} onClick={() => setProgramOpen(true)}>Add to program</Button>
        <Menu
          trigger={(p) => <Button {...p} size="sm" variant="ghost" icon={MoreHorizontal} aria-label="More actions">More</Button>}
          items={[
            { label: 'Save as template', icon: BookmarkPlus, onClick: () => setTplName(client ? w.name : `${w.name || 'Untitled workout'} (copy)`) },
            { label: 'Duplicate workout', icon: Copy, onClick: onDuplicate },
            ...(id ? ['divider' as const, { label: 'Delete workout', icon: Trash2, onClick: onDelete, danger: true }] : []),
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {w.mode === 'write' ? (
            <>
              <RichEditor value={w.html} onChange={(html) => patch({ html })} autoFocus={!!id || !!w.name} minHeight={420}
                placeholder={'Just type your workout here…\n\nWarm Up\n5 min bike\nBodyweight squats x 15\n\nMain Workout\nSquats — 4 x 10\nRomanian Deadlifts — 3 x 12'} />
              {w.blocks.length > 0 && <p className="mt-3 text-[13px] text-muted">This workout also has {w.blocks.length} structured item{w.blocks.length > 1 ? 's' : ''} in the Builder. The client sees whichever mode is selected when you save.</p>}
            </>
          ) : (
            <>
              {w.blocks.length === 0 && !isHtmlEmpty(w.html) && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm">
                  <Wand2 size={17} className="text-sage-600" />
                  <span className="flex-1 text-ink-soft">You’ve written this one in Quick Write. Want to turn it into an exercise list?</span>
                  <Button size="sm" variant="primary" onClick={() => setConvert(parseTextToBlocks(w.html, exercises))}>Convert text</Button>
                </div>
              )}
              <StructuredBuilder blocks={w.blocks} onChange={(blocks) => patch({ blocks })} />
              {!isHtmlEmpty(w.html) && w.blocks.length > 0 && <p className="mt-4 text-[13px] text-muted">Your Quick Write text is kept as it was — switch back any time.</p>}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <SidePanel title="Start from a template">
            <select aria-label="Choose template" value="" onChange={(e) => startFrom(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm">
              <option value="">Choose a workout…</option>
              {library.filter((x) => x.id !== w.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </SidePanel>
          {w.mode === 'write' ? (
            <>
              <SidePanel title="Turn into exercises" text="Optional. Builds a structured list from your text so clients can tick off sets. You’ll see a preview first and your text is never changed.">
                <Button size="sm" icon={Wand2} disabled={isHtmlEmpty(w.html)} onClick={() => setConvert(parseTextToBlocks(w.html, exercises))}>Preview conversion</Button>
              </SidePanel>
              <SidePanel title="Shortcuts">
                <ul className="space-y-1 text-[13px] text-ink-soft">
                  <li><Kbd>Ctrl/⌘ B</Kbd> bold · <Kbd>Ctrl/⌘ I</Kbd> italic</li>
                  <li><Kbd>-</Kbd> + space starts a bullet list</li>
                  <li><Kbd>1.</Kbd> + space starts a numbered list</li>
                  <li><Kbd>##</Kbd> + space makes a heading</li>
                  <li><Kbd>Ctrl/⌘ Z</Kbd> undo · <Kbd>Ctrl/⌘ S</Kbd> save</li>
                </ul>
              </SidePanel>
            </>
          ) : (
            <SidePanel title="Tips" text="Only the exercise name is needed. Leave sets, reps and weights blank if you’d rather explain in a note. Drag the handle to reorder." >
              {w.blocks.length === 0 && !isHtmlEmpty(w.html) ? null : isHtmlEmpty(w.html) && w.blocks.length > 0 && (
                <Button size="sm" icon={FileText} onClick={() => { patch({ html: blocksToHtml(w.blocks), mode: 'write' }); toast.info('Copied into Quick Write as text') }}>Copy into Quick Write</Button>
              )}
            </SidePanel>
          )}
          {(usedIn.length > 0) && (
            <SidePanel title="Used in">
              <ul className="space-y-1 text-sm">{usedIn.map((p) => <li key={p.id}><Link className="text-sage-700 hover:underline" to={`/programs/${p.id}`}>{p.name}</Link>{p.clientId && <Badge className="ml-1.5">client copy</Badge>}</li>)}</ul>
            </SidePanel>
          )}
        </aside>
      </div>

      {/* Preview */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Client preview" description="This is how the workout appears on your client’s phone." size="md">
        <div className="mx-auto max-w-[380px] rounded-[28px] border-[6px] border-ink/90 bg-canvas p-4 shadow-lift">
          <p className="text-xs text-muted">Today’s workout</p>
          <h3 className="text-xl font-semibold tracking-tight">{w.name || 'Untitled workout'}</h3>
          <div className="mt-3 rounded-2xl bg-white p-4 border border-line max-h-[55vh] overflow-y-auto"><WorkoutView workout={w} /></div>
          <div className="mt-3 h-12 rounded-xl bg-sage-600 text-white flex items-center justify-center font-semibold">Start workout</div>
        </div>
      </Modal>

      {/* Convert */}
      <Modal open={!!convert} onClose={() => setConvert(null)} size="lg" title="Turn text into exercises" description="Here’s what we found. Nothing changes until you confirm, and your original text is kept."
        footer={<><Button variant="ghost" onClick={() => setConvert(null)}>Cancel</Button><Button variant="primary" onClick={() => { patch({ blocks: convert!.map((c) => c.block), mode: 'build' }); setConvert(null); toast.success('Converted — check it over, then save') }}>Use this list</Button></>}>
        {convert && (
          <ul className="divide-y divide-line/70 rounded-xl border border-line">
            {convert.map((c, i) => (
              <li key={i} className="flex items-start gap-3 px-3.5 py-2 text-sm">
                <span className={cn('mt-0.5 w-20 shrink-0 text-xs font-medium', c.block.type === 'exercise' ? 'text-sage-700' : c.block.type === 'section' ? 'text-plan' : 'text-muted')}>
                  {c.block.type === 'exercise' ? 'Exercise' : c.block.type === 'section' ? 'Heading' : 'Note'}
                </span>
                <span className="flex-1 min-w-0">
                  {c.block.type === 'exercise' ? (
                    <><span className="font-medium">{c.block.name}</span>{(c.block.sets || c.block.reps) && <span className="text-ink-soft"> — {[c.block.sets && `${c.block.sets} sets`, c.block.reps && `${c.block.reps}`, c.block.weight, c.block.rest && `rest ${c.block.rest}`].filter(Boolean).join(' · ')}</span>}
                      {c.matched && <span className="block text-xs text-muted">Linked to library: {c.matched}</span>}</>
                  ) : <span className={c.block.type === 'section' ? 'font-semibold' : 'text-ink-soft'}>{c.source}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Save as template */}
      <Modal open={tplName !== null} onClose={() => setTplName(null)} size="sm" title="Save as template" description="Adds a copy to your workout library to reuse any time."
        footer={<><Button variant="ghost" onClick={() => setTplName(null)}>Cancel</Button><Button variant="primary" onClick={() => saveAsTemplate(tplName ?? '')}>Save template</Button></>}>
        <form onSubmit={(e) => { e.preventDefault(); saveAsTemplate(tplName ?? '') }}><Input label="Template name" value={tplName ?? ''} onChange={(e) => setTplName(e.target.value)} /></form>
      </Modal>

      <AssignWorkoutModal open={assignOpen} onClose={() => setAssignOpen(false)} beforeAssign={() => (dirty || !id ? save({ quiet: true })?.id : w.id)} />
      <AddToProgramModal open={programOpen} onClose={() => setProgramOpen(false)} workout={w} beforeAdd={() => (dirty || !id ? save({ quiet: true }) : w)} />

      {/* Leaving with unsaved changes */}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} size="sm" title="Save before leaving?"
        footer={<>
          <Button variant="ghost" onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button onClick={() => { writeDraft(); blocker.proceed?.() }}>Leave — keep draft</Button>
          <Button variant="primary" onClick={() => { const r = w; if (r) { saveWorkout({ ...r, name: r.name.trim() || 'Untitled workout' }); localStorage.removeItem(draftKey(id ?? 'new')); toast.success('Workout saved') } blocker.proceed?.() }}>Save & leave</Button>
        </>}>
        <p className="text-sm text-ink-soft">You have unsaved changes. If you leave without saving, your draft is kept on this device and you can restore it next time you open this workout.</p>
      </Modal>
    </div>
  )
}

function SidePanel({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-white/70 p-4">
      <p className="text-sm font-semibold">{title}</p>
      {text && <p className="mt-1 text-[13px] text-muted leading-relaxed">{text}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="rounded border border-line bg-stone-50 px-1 py-px text-[11px] font-sans">{children}</kbd>

/* ───────────── Add to program */

function AddToProgramModal({ open, onClose, workout, beforeAdd }: { open: boolean; onClose: () => void; workout: Workout; beforeAdd: () => Workout | undefined }) {
  const programs = useStore((s) => s.programs)
  const saveProgram = useStore((s) => s.saveProgram)
  const navigate = useNavigate()
  const options = workout.clientId
    ? [activeProgram(programs, workout.clientId)].filter(Boolean) as typeof programs
    : programs.filter((p) => !p.clientId && p.status === 'active')
  const [pid, setPid] = useState('')
  const [week, setWeek] = useState('all')
  const [day, setDay] = useState('0')
  useEffect(() => { if (open) { setPid(options[0]?.id ?? ''); setWeek('all'); setDay('0') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = options.find((x) => x.id === pid)

  const go = () => {
    if (!p) return
    const savedW = beforeAdd()
    if (!savedW) return
    const di = Number(day)
    const weeks = p.weeks.map((wk, wi) => (week === 'all' || Number(week) === wi ? { ...wk, days: wk.days.map((d, i) => (i === di ? { ...d, workoutId: savedW.id } : d)) } : wk))
    saveProgram({ ...p, weeks })
    toast.success(`Added to ${p.name} — ${DAY_NAMES[di]}${week === 'all' ? 's, every week' : `, week ${Number(week) + 1}`}`, { label: 'Open program', onClick: () => navigate(`/programs/${p.id}`) })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to a program" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!p} onClick={go}>Add</Button></>}>
      {options.length === 0 ? <p className="text-sm text-muted">{workout.clientId ? 'This client has no active program.' : 'You have no programs yet.'}</p> : (
        <div className="grid gap-4">
          <Select label="Program" value={pid} onChange={(e) => setPid(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Week" value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="all">Every week</option>
              {p?.weeks.map((_, i) => <option key={i} value={i}>Week {i + 1}</option>)}
            </Select>
            <Select label="Day" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </div>
          <p className="text-xs text-muted">If that day already has a workout, it will be replaced.</p>
        </div>
      )}
    </Modal>
  )
}
