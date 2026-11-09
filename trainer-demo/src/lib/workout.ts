import type { Exercise, ExerciseItem, Workout, WorkoutBlock } from '../types'
import { uid } from './id'

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Tiny markdown-ish → HTML converter used for seed data and templates.
 * "# " = heading, "## " = subheading, "- " = bullet, "1. " = numbered, **bold**.
 */
export function mdToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const inline = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of md.trim().split('\n')) {
    const line = raw.trimEnd()
    if (/^##\s/.test(line)) { close(); out.push(`<h3>${inline(line.slice(3))}</h3>`); continue }
    if (/^#\s/.test(line)) { close(); out.push(`<h2>${inline(line.slice(2))}</h2>`); continue }
    const b = line.match(/^[-•]\s+(.*)/)
    const n = line.match(/^\d+\.\s+(.*)/)
    if (b || n) {
      const want = b ? 'ul' : 'ol'
      if (list !== want) { close(); out.push(`<${want}>`); list = want }
      out.push(`<li><p>${inline((b || n)![1])}</p></li>`)
      continue
    }
    close()
    if (line.trim() === '') continue
    out.push(`<p>${inline(line)}</p>`)
  }
  close()
  return out.join('')
}

export function htmlToPlain(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}

export function isHtmlEmpty(html: string): boolean {
  return htmlToPlain(html).trim().length === 0
}

/** Line-by-line view of rich text, keeping a hint of what kind of line it was. */
export function htmlToLines(html: string): { text: string; heading: boolean }[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const lines: { text: string; heading: boolean }[] = []
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') { walk(child); continue }
      if (tag === 'li') {
        const t = child.textContent?.trim()
        if (t) lines.push({ text: t, heading: false })
        continue
      }
      const text = child.textContent ?? ''
      for (const part of text.split('\n')) {
        const t = part.trim()
        if (t) lines.push({ text: t, heading: /^h[1-6]$/.test(tag) })
      }
    }
  }
  walk(div)
  return lines
}

/* ───────────────────── Structured blocks */

export function exerciseItem(ex: Partial<ExerciseItem> & { name: string }): ExerciseItem {
  return { id: uid('it-'), ...ex }
}

export function allItems(blocks: WorkoutBlock[]): ExerciseItem[] {
  const items: ExerciseItem[] = []
  for (const b of blocks) {
    if (b.type === 'exercise') items.push(b)
    if (b.type === 'group') items.push(...b.items)
  }
  return items
}

export function countExercises(w: Workout): number {
  return w.mode === 'build' ? allItems(w.blocks).length : 0
}

/** One-line description of a workout for cards and lists. */
export function workoutSummary(w: Workout): string {
  if (w.mode === 'build') {
    const items = allItems(w.blocks)
    if (!items.length) return 'No exercises yet'
    const names = items.slice(0, 3).map((i) => i.name).join(', ')
    return items.length > 3 ? `${names} +${items.length - 3} more` : names
  }
  const plain = htmlToLines(w.html).map((l) => l.text)
  return plain.slice(0, 3).join(' · ') || 'Empty workout'
}

export function targetLine(i: ExerciseItem): string {
  const parts: string[] = []
  if (i.sets && i.reps) parts.push(`${i.sets} × ${i.reps}`)
  else if (i.sets) parts.push(`${i.sets} sets`)
  else if (i.reps) parts.push(i.reps)
  if (i.weight) parts.push(`@ ${i.weight}`)
  if (i.rest) parts.push(`rest ${i.rest}`)
  if (i.tempo) parts.push(`tempo ${i.tempo}`)
  return parts.join('  ·  ')
}

/** Fresh ids everywhere — used whenever a workout is copied. */
export function cloneBlocks(blocks: WorkoutBlock[]): WorkoutBlock[] {
  return blocks.map((b) => {
    if (b.type === 'group') return { ...b, id: uid('b-'), items: b.items.map((i) => ({ ...i, id: uid('it-') })) }
    return { ...b, id: uid('b-') } as WorkoutBlock
  })
}

/** Number of sets to show the client for an item (defaults to 3 when unspecified but reps exist). */
export function setCount(i: ExerciseItem, rounds?: string): number {
  const n = parseInt(i.sets ?? rounds ?? '', 10)
  if (Number.isFinite(n) && n > 0) return Math.min(n, 10)
  return 1
}

/* ───────────────────── Optional text → structured conversion
 * Only ever run when the trainer explicitly asks for it, with a preview first.
 * The original text is kept on the workout untouched.
 */

const SET_REP = /(\d+)\s*[x×]\s*([\d\-–]+(?:\s*(?:reps?|steps?|sec|s|secs|seconds|min|m|each(?: side| leg)?|\/side|per side))*)/i
const ONLY_REPS = /[x×]\s*(\d+\s*(?:reps?|steps?|sec|s|seconds|min|each(?: side| leg)?)?)\s*$/i

export function matchExercise(name: string, library: Exercise[]): Exercise | undefined {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!n) return undefined
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const singular = (s: string) => s.replace(/s\b/g, '')
  let hit = library.find((e) => norm(e.name) === n)
  if (hit) return hit
  hit = library.find((e) => singular(norm(e.name)) === singular(n))
  if (hit) return hit
  // "Squats" → "Barbell Back Squat" style: every word of the typed name appears in the library name
  const words = singular(n).split(' ').filter((w) => w.length > 2)
  if (!words.length) return undefined
  const candidates = library.filter((e) => {
    const en = singular(norm(e.name))
    return words.every((w) => en.includes(w))
  })
  candidates.sort((a, b) => a.name.length - b.name.length)
  return candidates[0]
}

export interface ParsedLine {
  block: WorkoutBlock
  source: string
  matched?: string
}

export function parseTextToBlocks(html: string, library: Exercise[]): ParsedLine[] {
  const lines = htmlToLines(html)
  const out: ParsedLine[] = []
  for (let idx = 0; idx < lines.length; idx++) {
    const { text, heading } = lines[idx]
    const next = lines[idx + 1]
    const looksLikeSection =
      heading ||
      (/^[A-Za-z][A-Za-z /&—–-]{1,30}:?$/.test(text) && text.split(' ').length <= 4 && !!next && (SET_REP.test(next.text) || ONLY_REPS.test(next.text) || /^\d/.test(next.text)))
    if (looksLikeSection && !SET_REP.test(text)) {
      out.push({ block: { id: uid('b-'), type: 'section', title: text.replace(/:$/, '') }, source: text })
      continue
    }
    const sr = text.match(SET_REP)
    const only = !sr ? text.match(ONLY_REPS) : null
    const timed = !sr && !only ? text.match(/^(\d+\s*(?:min|mins|minutes|sec|seconds|km|m))\s+(.+)$/i) : null
    if (sr || only || timed) {
      let name: string
      const item: Partial<ExerciseItem> = {}
      if (sr) {
        name = text.slice(0, sr.index).replace(/[—–:\-]+\s*$/, '').trim()
        item.sets = sr[1]
        item.reps = sr[2].trim()
        const tail = text.slice((sr.index ?? 0) + sr[0].length)
        const kg = (name + ' ' + tail).match(/@?\s*(\d+(?:\.\d+)?\s*kg)/i)
        if (kg) item.weight = kg[1].replace(/\s+/g, '')
        const rest = tail.match(/rest\s*([\d.]+\s*(?:s|sec|secs|seconds|min|mins|m)?)/i)
        if (rest) item.rest = rest[1].trim()
      } else if (only) {
        name = text.slice(0, only.index).replace(/[—–:\-]+\s*$/, '').trim()
        item.reps = only[1].trim()
      } else {
        name = timed![2].trim()
        item.reps = timed![1].trim()
      }
      if (!name) name = text
      name = name.charAt(0).toUpperCase() + name.slice(1)
      const ex = matchExercise(name, library)
      out.push({
        block: { type: 'exercise', ...exerciseItem({ ...item, name, exerciseId: ex?.id }) },
        source: text,
        matched: ex?.name,
      })
      continue
    }
    out.push({ block: { id: uid('b-'), type: 'text', text }, source: text })
  }
  return out
}

/** Render structured blocks back to readable rich text (used when switching Builder → Quick Write on an empty note). */
export function blocksToHtml(blocks: WorkoutBlock[]): string {
  const line = (i: ExerciseItem) => {
    const t = targetLine(i)
    return `<li><p>${escapeHtml(i.name)}${t ? ' — ' + escapeHtml(t) : ''}${i.notes ? ' (' + escapeHtml(i.notes) + ')' : ''}</p></li>`
  }
  const out: string[] = []
  let open = false
  const close = () => { if (open) out.push('</ul>'); open = false }
  for (const b of blocks) {
    if (b.type === 'exercise') { if (!open) { out.push('<ul>'); open = true } out.push(line(b)); continue }
    close()
    if (b.type === 'section') out.push(`<h2>${escapeHtml(b.title)}</h2>`)
    if (b.type === 'text') out.push(`<p>${escapeHtml(b.text)}</p>`)
    if (b.type === 'group') {
      out.push(`<p><strong>${b.kind === 'superset' ? 'Superset' : 'Circuit'}${b.rounds ? ' — ' + escapeHtml(b.rounds) + ' rounds' : ''}</strong></p><ul>`)
      b.items.forEach((i) => out.push(line(i)))
      out.push('</ul>')
    }
  }
  close()
  return out.join('')
}
