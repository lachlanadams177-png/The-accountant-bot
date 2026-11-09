import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, Dumbbell, CalendarRange, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useExercises, useLibraryWorkouts, useTemplatePrograms } from '../store/hooks'
import { cn } from '../lib/cn'

type Result = { id: string; label: string; sub: string; to: string; icon: typeof User }

/** One box to find a client, workout, program or exercise. Ctrl/⌘+K focuses it. */
export function GlobalSearch({ className }: { className?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const clients = useStore((s) => s.clients)
  const workouts = useLibraryWorkouts()
  const programs = useTemplatePrograms()
  const exercises = useExercises()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true) }
    }
    const onClick = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [])

  const results = useMemo<Result[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const has = (s?: string) => !!s && s.toLowerCase().includes(t)
    return [
      ...clients.filter((c) => has(c.name)).slice(0, 4).map((c) => ({ id: c.id, label: c.name, sub: c.status === 'archived' ? 'Client · archived' : 'Client', to: `/clients/${c.id}`, icon: User })),
      ...workouts.filter((w) => has(w.name)).slice(0, 4).map((w) => ({ id: w.id, label: w.name, sub: 'Workout', to: `/workouts/${w.id}`, icon: FileText })),
      ...programs.filter((p) => has(p.name)).slice(0, 3).map((p) => ({ id: p.id, label: p.name, sub: 'Program', to: `/programs/${p.id}`, icon: CalendarRange })),
      ...exercises.filter((e) => has(e.name)).slice(0, 4).map((e) => ({ id: e.id, label: e.name, sub: `Exercise · ${e.category}`, to: `/exercises?open=${e.id}`, icon: Dumbbell })),
    ]
  }, [q, clients, workouts, programs, exercises])

  const go = (r: Result) => { navigate(r.to); setQ(''); setOpen(false); ref.current?.blur() }
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && results[active]) go(results[active])
          if (e.key === 'Escape') { setOpen(false); ref.current?.blur() }
        }}
        placeholder="Search clients, workouts, exercises…"
        aria-label="Search"
        className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-14 text-sm placeholder:text-muted focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-100"
      />
      <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-line bg-stone-50 px-1.5 py-0.5 text-[11px] text-muted">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-line bg-white p-1.5 shadow-pop animate-pop">
          {results.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nothing found for “{q}”.</p>}
          {results.map((r, i) => (
            <button key={r.sub + r.id} onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active && 'bg-stone-100')}>
              <r.icon size={16} className="text-muted" />
              <span className="flex-1 truncate text-sm">{r.label}</span>
              <span className="text-xs text-muted">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
