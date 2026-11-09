import { useMemo, useRef, useState } from 'react'
import { Plus, Search, Star } from 'lucide-react'
import { useExercises } from '../store/hooks'
import { useStore } from '../store/useStore'
import { cn } from '../lib/cn'
import type { Exercise } from '../types'

export function searchExercises(list: Exercise[], q: string, favs: string[] = []): Exercise[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  const words = t.split(/\s+/)
  const scored = list
    .map((e) => {
      const name = e.name.toLowerCase()
      const hay = `${name} ${e.primaryMuscle} ${e.equipment} ${e.category}`.toLowerCase()
      if (!words.every((w) => hay.includes(w))) return null
      let score = 0
      if (name === t) score += 100
      if (name.startsWith(t)) score += 40
      if (words.every((w) => name.includes(w))) score += 20
      if (favs.includes(e.id)) score += 10
      if (e.custom) score += 5
      return { e, score: score - name.length * 0.1 }
    })
    .filter(Boolean) as { e: Exercise; score: number }[]
  return scored.sort((a, b) => b.score - a.score).map((s) => s.e)
}

/**
 * Type → pick → it's in the workout. Enter adds the highlighted result,
 * or a plain custom line if nothing in the library matches.
 */
export function ExerciseSearch({ onPick, placeholder = 'Search exercises to add — e.g. “squat”', compact, autoFocus }: { onPick: (e: { name: string; exerciseId?: string }) => void; placeholder?: string; compact?: boolean; autoFocus?: boolean }) {
  const all = useExercises()
  const favs = useStore((s) => s.favouriteExerciseIds)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchExercises(all, q, favs).slice(0, 8), [all, q, favs])
  const options = q.trim() ? [...results.map((e) => ({ name: e.name, exerciseId: e.id, ex: e })), { name: q.trim(), exerciseId: undefined, ex: undefined }] : []

  const pick = (i: number) => {
    const o = options[i]
    if (!o) return
    onPick({ name: o.name, exerciseId: o.exerciseId })
    setQ('')
    setActive(0)
    input.current?.focus()
  }

  return (
    <div className="relative">
      <Search size={compact ? 15 : 17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        ref={input}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); pick(active) }
          if (e.key === 'Escape') setQ('')
        }}
        placeholder={placeholder}
        aria-label="Search exercises"
        className={cn('w-full rounded-xl border border-line bg-white text-sm placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100', compact ? 'h-9 pl-8 pr-3' : 'h-12 pl-10 pr-3 text-[15px] shadow-card')}
      />
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-pop animate-pop">
          {options.map((o, i) => (
            <li key={(o.exerciseId ?? 'custom') + i} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active && 'bg-brand-50')}
              >
                {o.ex ? (
                  <>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">{o.name}{favs.includes(o.ex.id) && <Star size={12} className="fill-ink text-ink" />}{o.ex.custom && <span className="text-[11px] font-normal text-brand-700">Custom</span>}</span>
                      <span className="block text-xs text-muted">{o.ex.primaryMuscle} · {o.ex.equipment}</span>
                    </span>
                    <span className="text-xs text-muted">{o.ex.category}</span>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-ink-soft"><Plus size={15} /> Add “{o.name}” as a written line</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
