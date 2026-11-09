import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, ExternalLink, ImagePlus, Pencil, Plus, Search, Star, Trash2, FilePlus2, ShieldAlert, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useExercises } from '../../store/hooks'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { Badge, Card, EmptyState, PageHeader } from '../../components/ui/misc'
import { Modal } from '../../components/ui/Modal'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import { EXERCISE_CATEGORIES } from '../../data/exercises'
import { searchExercises } from '../../components/ExerciseSearch'
import { cn } from '../../lib/cn'
import type { Difficulty, Exercise, ExerciseCategory } from '../../types'

export function ExercisesPage() {
  const all = useExercises()
  const favs = useStore((s) => s.favouriteExerciseIds)
  const toggleFavourite = useStore((s) => s.toggleFavourite)
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'' | ExerciseCategory>('')
  const [muscle, setMuscle] = useState('')
  const [equip, setEquip] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)
  const [onlyCustom, setOnlyCustom] = useState(false)
  const [formFor, setFormFor] = useState<Exercise | 'new' | null>(null)
  const openId = params.get('open')
  const open = all.find((e) => e.id === openId)

  const muscles = useMemo(() => [...new Set(all.map((e) => e.primaryMuscle))].sort(), [all])
  const equipment = useMemo(() => [...new Set(all.map((e) => e.equipment))].sort(), [all])

  const rows = useMemo(() => {
    let list = q.trim() ? searchExercises(all, q, favs) : [...all].sort((a, b) => a.name.localeCompare(b.name))
    if (cat) list = list.filter((e) => e.category === cat)
    if (muscle) list = list.filter((e) => e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle))
    if (equip) list = list.filter((e) => e.equipment === equip)
    if (onlyFav) list = list.filter((e) => favs.includes(e.id))
    if (onlyCustom) list = list.filter((e) => e.custom)
    return list
  }, [all, q, cat, muscle, equip, onlyFav, onlyCustom, favs])

  const filtersOn = !!(cat || muscle || equip || onlyFav || onlyCustom)
  const clear = () => { setCat(''); setMuscle(''); setEquip(''); setOnlyFav(false); setOnlyCustom(false) }

  return (
    <div>
      <PageHeader title="Exercises" subtitle={`${all.length} exercises · ${favs.length} favourites`} actions={<Button variant="primary" icon={Plus} onClick={() => setFormFor('new')}>Add custom exercise</Button>} />

      <div className="mb-3 relative max-w-xl">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search — try “hip thrust” or “kettlebell”" aria-label="Search exercises"
          className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-[15px] shadow-card focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-100" />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(['', ...EXERCISE_CATEGORIES] as const).map((c) => (
          <button key={c || 'all'} onClick={() => setCat(c)} className={cn('shrink-0 rounded-full px-3.5 h-8 text-sm font-medium transition-colors', cat === c ? 'bg-ink text-white' : 'bg-white border border-line text-ink-soft hover:border-line-strong')}>{c || 'All'}</button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select aria-label="Muscle group" value={muscle} onChange={(e) => setMuscle(e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2.5 text-sm"><option value="">Any muscle group</option>{muscles.map((m) => <option key={m}>{m}</option>)}</select>
        <select aria-label="Equipment" value={equip} onChange={(e) => setEquip(e.target.value)} className="h-9 rounded-lg border border-line bg-white px-2.5 text-sm"><option value="">Any equipment</option>{equipment.map((m) => <option key={m}>{m}</option>)}</select>
        <button onClick={() => setOnlyFav((v) => !v)} aria-pressed={onlyFav} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-sm', onlyFav ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-line bg-white text-ink-soft')}><Star size={14} className={onlyFav ? 'fill-amber-400 text-amber-400' : ''} /> Favourites</button>
        <button onClick={() => setOnlyCustom((v) => !v)} aria-pressed={onlyCustom} className={cn('rounded-lg border px-3 h-9 text-sm', onlyCustom ? 'border-sage-300 bg-sage-50 text-sage-800' : 'border-line bg-white text-ink-soft')}>My exercises</button>
        {filtersOn && <button onClick={clear} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><X size={14} /> Clear filters</button>}
        <span className="ml-auto text-sm text-muted">{rows.length} shown</span>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={Dumbbell} title="No exercises found" text="Try a different search, or add it as your own exercise." action={<Button icon={Plus} onClick={() => setFormFor('new')}>Add custom exercise</Button>} /></Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, 240).map((e) => (
            <Card key={e.id} className="relative flex items-start gap-3 p-3.5 hover:shadow-lift hover:border-line-strong transition-all">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-ink-soft text-sm font-semibold">{e.name.slice(0, 1)}</span>
              <button onClick={() => setParams({ open: e.id })} className="flex-1 min-w-0 text-left after:absolute after:inset-0">
                <span className="flex items-center gap-1.5 font-medium leading-snug">{e.name}{e.custom && <Badge tone="sage">Custom</Badge>}</span>
                <span className="block text-[13px] text-muted">{e.primaryMuscle} · {e.equipment}</span>
              </button>
              <button onClick={() => toggleFavourite(e.id)} aria-label={favs.includes(e.id) ? `Remove ${e.name} from favourites` : `Add ${e.name} to favourites`} aria-pressed={favs.includes(e.id)} className="relative z-10 p-1.5 rounded-lg hover:bg-stone-100">
                <Star size={17} className={favs.includes(e.id) ? 'fill-amber-400 text-amber-400' : 'text-muted'} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <ExerciseDetail exercise={open} onClose={() => setParams({})} onEdit={(e) => { setParams({}); setFormFor(e) }} />
      <ExerciseForm value={formFor} onClose={() => setFormFor(null)} />
    </div>
  )
}

function ExerciseDetail({ exercise: e, onClose, onEdit }: { exercise?: Exercise; onClose: () => void; onEdit: (e: Exercise) => void }) {
  const navigate = useNavigate()
  const favs = useStore((s) => s.favouriteExerciseIds)
  const toggleFavourite = useStore((s) => s.toggleFavourite)
  const deleteCustomExercise = useStore((s) => s.deleteCustomExercise)
  if (!e) return <Modal open={false} onClose={onClose} />
  const isImg = e.mediaUrl && /^data:image|\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(e.mediaUrl)
  return (
    <Modal open onClose={onClose} size="lg" title={e.name} description={<span className="flex flex-wrap gap-1.5 mt-1"><Badge tone="sage">{e.category}</Badge><Badge>{e.difficulty}</Badge><Badge>{e.equipment}</Badge>{e.custom && <Badge tone="blue">Your exercise</Badge>}</span>}
      footer={<>
        {e.custom && <Button variant="ghost" icon={Trash2} className="mr-auto text-miss" onClick={async () => { if (await confirm({ title: `Delete “${e.name}”?`, message: 'Workouts that already use it keep the exercise name.', confirmLabel: 'Delete', danger: true })) { deleteCustomExercise(e.id); onClose(); toast.success('Exercise deleted') } }}>Delete</Button>}
        {e.custom && <Button icon={Pencil} onClick={() => onEdit(e)}>Edit</Button>}
        <Button icon={Star} onClick={() => toggleFavourite(e.id)}>{favs.includes(e.id) ? 'Unfavourite' : 'Favourite'}</Button>
        <Button variant="primary" icon={FilePlus2} onClick={() => navigate(`/workouts/new?mode=build&exercise=${e.id}`)}>New workout with this</Button>
      </>}>
      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div>
          <p className="text-[15px] leading-relaxed text-ink-soft">{e.description}</p>
          {e.instructions.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-semibold">How to do it</h3>
              <ol className="space-y-2">
                {e.instructions.map((s, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-50 text-xs font-semibold text-sage-700">{i + 1}</span>{s}</li>)}
              </ol>
            </>
          )}
          {e.safety && <p className="mt-4 flex gap-2 rounded-xl bg-warn-bg px-3.5 py-2.5 text-sm text-warn"><ShieldAlert size={16} className="mt-0.5 shrink-0" /> {e.safety}</p>}
          <p className="mt-4 text-xs text-muted">General guidance only — adjust for each client.</p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-muted">Primary</p><p className="font-medium">{e.primaryMuscle}</p>
            {e.secondaryMuscles.length > 0 && <><p className="mt-2 text-xs text-muted">Also works</p><p>{e.secondaryMuscles.join(', ')}</p></>}
          </div>
          {e.mediaUrl ? (
            isImg ? <img src={e.mediaUrl} alt={`${e.name} demonstration`} className="w-full rounded-xl border border-line object-cover" /> :
              <a href={e.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-line p-3 text-sage-700 hover:bg-sage-50"><ExternalLink size={16} /> Watch demonstration</a>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
              <ImagePlus size={20} className="mb-1" />No demo media{e.custom ? ' — add a link via Edit' : ''}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

type F = { name: string; category: ExerciseCategory; primaryMuscle: string; secondary: string; equipment: string; difficulty: Difficulty; description: string; instructions: string; safety: string; mediaUrl: string }

function ExerciseForm({ value, onClose }: { value: Exercise | 'new' | null; onClose: () => void }) {
  const save = useStore((s) => s.saveCustomExercise)
  const [, setParams] = useSearchParams()
  const [f, setF] = useState<F | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!value) return setF(null)
    const e = value === 'new' ? undefined : value
    setErr('')
    setF({ name: e?.name ?? '', category: e?.category ?? 'Strength', primaryMuscle: e?.primaryMuscle ?? '', secondary: e?.secondaryMuscles.join(', ') ?? '', equipment: e?.equipment ?? '', difficulty: e?.difficulty ?? 'Beginner', description: e?.description ?? '', instructions: e?.instructions.join('\n') ?? '', safety: e?.safety ?? '', mediaUrl: e?.mediaUrl ?? '' })
  }, [value])
  if (!f) return <Modal open={false} onClose={onClose} />
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const upload = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image. For videos, paste a link instead.')
    if (file.size > 1.5 * 1024 * 1024) return toast.error('That image is over 1.5 MB — try a smaller one for the demo.')
    const r = new FileReader()
    r.onload = () => setF((x) => (x ? { ...x, mediaUrl: String(r.result) } : x))
    r.readAsDataURL(file)
  }

  const submit = () => {
    if (!f.name.trim()) return setErr('Give the exercise a name.')
    const ex = save({
      id: value !== 'new' ? value?.id : undefined,
      name: f.name.trim(), category: f.category, primaryMuscle: f.primaryMuscle.trim() || 'Full Body',
      secondaryMuscles: f.secondary.split(',').map((s) => s.trim()).filter(Boolean), equipment: f.equipment.trim() || 'None', difficulty: f.difficulty,
      description: f.description.trim(), instructions: f.instructions.split('\n').map((s) => s.trim()).filter(Boolean), safety: f.safety.trim() || undefined, mediaUrl: f.mediaUrl.trim() || undefined,
    })
    toast.success(value === 'new' ? `“${ex.name}” added to your exercises` : 'Exercise saved')
    onClose()
    setParams({ open: ex.id })
  }

  return (
    <Modal open onClose={onClose} size="lg" title={value === 'new' ? 'Add custom exercise' : 'Edit exercise'} description="Only the name is needed."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Save exercise</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Name" value={f.name} onChange={(e) => { set('name')(e); setErr('') }} placeholder="e.g. Banded Hip Hinge" />{err && <p role="alert" className="mt-1 text-sm text-miss">{err}</p>}</div>
        <Select label="Category" value={f.category} onChange={set('category')}>{EXERCISE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select label="Difficulty" value={f.difficulty} onChange={set('difficulty')}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></Select>
        <Input label="Primary muscle" optional value={f.primaryMuscle} onChange={set('primaryMuscle')} placeholder="e.g. Glutes" />
        <Input label="Equipment" optional value={f.equipment} onChange={set('equipment')} placeholder="e.g. Resistance band" />
        <div className="sm:col-span-2"><Input label="Other muscles" optional value={f.secondary} onChange={set('secondary')} placeholder="Separate with commas" /></div>
        <div className="sm:col-span-2"><Textarea label="Short description" optional value={f.description} onChange={set('description')} /></div>
        <div className="sm:col-span-2"><Textarea label="Steps" optional value={f.instructions} onChange={set('instructions')} placeholder={'One step per line'} /></div>
        <div className="sm:col-span-2"><Input label="Safety note" optional value={f.safety} onChange={set('safety')} /></div>
        <div className="sm:col-span-2">
          <Input label="Demo video or image link" optional value={f.mediaUrl.startsWith('data:') ? '(uploaded image)' : f.mediaUrl} onChange={set('mediaUrl')} placeholder="https://…" disabled={f.mediaUrl.startsWith('data:')} />
          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 h-9 text-sm hover:border-line-strong"><ImagePlus size={15} /> Upload image<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} /></label>
            {f.mediaUrl && <button className="text-sm text-muted hover:text-miss" onClick={() => setF({ ...f, mediaUrl: '' })}>Remove media</button>}
            <span className="text-xs text-muted">Stored in this browser only</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
