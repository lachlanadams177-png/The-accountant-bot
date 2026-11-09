import type {
  Client,
  Conversation,
  DemoData,
  ID,
  ISODate,
  Message,
  Program,
  ProgressEntry,
  ScheduledSession,
  WorkoutCompletion,
} from '../types'
import { addDays, startOfWeek, stamp, today } from './date'

export type SessionState = 'completed' | 'missed' | 'today' | 'upcoming' | 'appointment'

export function sessionState(s: ScheduledSession, t: ISODate = today()): SessionState {
  if (s.kind === 'appointment') return 'appointment'
  if (s.status === 'completed') return 'completed'
  if (s.date < t) return 'missed'
  if (s.date === t) return 'today'
  return 'upcoming'
}

export function activeProgram(programs: Program[], clientId: ID): Program | undefined {
  return programs.find((p) => p.clientId === clientId && p.status === 'active')
}

export function workoutSessions(sessions: ScheduledSession[], clientId?: ID) {
  return sessions.filter((s) => s.kind === 'workout' && (!clientId || s.clientId === clientId))
}

export function weekStats(sessions: ScheduledSession[], clientId?: ID, monday: ISODate = startOfWeek(today())) {
  const sunday = addDays(monday, 6)
  const inWeek = workoutSessions(sessions, clientId).filter((s) => s.date >= monday && s.date <= sunday)
  const completed = inWeek.filter((s) => s.status === 'completed').length
  return { scheduled: inWeek.length, completed, pct: inWeek.length ? Math.round((completed / inWeek.length) * 100) : null }
}

export function lastCompletion(completions: WorkoutCompletion[], clientId: ID): WorkoutCompletion | undefined {
  return completions
    .filter((c) => c.clientId === clientId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
}

export function nextSession(sessions: ScheduledSession[], clientId: ID, t = today()) {
  return workoutSessions(sessions, clientId)
    .filter((s) => s.status !== 'completed' && s.date >= t)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

export function sortByDate<T extends { date: ISODate }>(xs: T[], dir: 1 | -1 = 1) {
  return [...xs].sort((a, b) => dir * a.date.localeCompare(b.date))
}

/* ───────── attention */

export interface AttentionItem {
  client: Client
  reason: 'missed' | 'inactive' | 'checkin' | 'message'
  label: string
  detail?: string
  refId?: ID
  sortKey: string
}

export function attentionList(d: Pick<DemoData, 'clients' | 'sessions' | 'completions' | 'progress' | 'messages' | 'programs'>): AttentionItem[] {
  const t = today()
  const weekAgo = addDays(t, -7)
  const out: AttentionItem[] = []
  for (const c of d.clients.filter((x) => x.status === 'active')) {
    const ws = workoutSessions(d.sessions, c.id)
    const missed = ws.filter((s) => s.status !== 'completed' && s.date < t && s.date >= weekAgo)
    if (missed.length) {
      out.push({ client: c, reason: 'missed', label: `Missed ${missed.length} workout${missed.length > 1 ? 's' : ''} this past week`, sortKey: '2' + missed[0].date })
    } else {
      const last = lastCompletion(d.completions, c.id)
      const hasPlan = !!activeProgram(d.programs, c.id) || ws.some((s) => s.date >= t)
      const joinedBeforeWeek = c.createdAt.slice(0, 10) < weekAgo
      if (joinedBeforeWeek && (!last || last.date < weekAgo)) {
        out.push({ client: c, reason: 'inactive', label: last ? `No workouts since ${last.date.split('-').reverse().slice(0, 2).join('/')}` : 'No workouts completed yet', detail: hasPlan ? undefined : 'No program assigned', sortKey: '3' })
      }
    }
    const checkIn = d.progress.find((p) => p.clientId === c.id && p.checkIn && !p.reviewed)
    if (checkIn) out.push({ client: c, reason: 'checkin', label: 'Submitted a check-in', detail: checkIn.note, refId: checkIn.id, sortKey: '1' + checkIn.date })
    const unread = d.messages.filter((m) => m.clientId === c.id && m.from === 'client' && !m.read)
    if (unread.length) out.push({ client: c, reason: 'message', label: `Sent ${unread.length === 1 ? 'a message' : unread.length + ' messages'}`, detail: unread[unread.length - 1].text, sortKey: '0' + unread[0].sentAt })
  }
  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

/* ───────── activity feed */

export interface ActivityItem {
  id: string
  at: string
  clientId: ID
  kind: 'completed' | 'checkin' | 'message' | 'joined' | 'weight'
  text: string
  link: string
}

export function activityFeed(d: Pick<DemoData, 'clients' | 'completions' | 'progress' | 'messages'>, limit = 10): ActivityItem[] {
  const name = new Map(d.clients.map((c) => [c.id, c.name.split(' ')[0]]))
  const items: ActivityItem[] = []
  for (const c of d.completions) {
    items.push({ id: c.id, at: c.completedAt, clientId: c.clientId, kind: 'completed', text: `${name.get(c.clientId)} completed ${c.workoutName}`, link: `/clients/${c.clientId}?tab=progress` })
  }
  for (const p of d.progress.filter((x) => x.checkIn)) {
    items.push({ id: p.id, at: stamp(p.date, 18), clientId: p.clientId, kind: 'checkin', text: `${name.get(p.clientId)} submitted a check-in`, link: `/clients/${p.clientId}?tab=progress` })
  }
  for (const m of d.messages.filter((x) => x.from === 'client')) {
    items.push({ id: m.id, at: m.sentAt, clientId: m.clientId, kind: 'message', text: `${name.get(m.clientId)} sent a message`, link: `/messages/${m.clientId}` })
  }
  for (const c of d.clients) {
    items.push({ id: c.id, at: c.createdAt, clientId: c.id, kind: 'joined', text: `${c.name.split(' ')[0]} joined as a client`, link: `/clients/${c.id}` })
  }
  const nowIso = new Date().toISOString()
  return items
    .filter((i) => i.at <= nowIso && name.has(i.clientId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}

/* ───────── messages */

export function conversations(messages: Message[], clients: Client[]): Conversation[] {
  return clients
    .map((c) => {
      const ms = messages.filter((m) => m.clientId === c.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
      return {
        clientId: c.id,
        messages: ms,
        last: ms[ms.length - 1],
        unreadForTrainer: ms.filter((m) => m.from === 'client' && !m.read).length,
        unreadForClient: ms.filter((m) => m.from === 'trainer' && !m.read).length,
      }
    })
}

/* ───────── progress */

export function weightSeries(progress: ProgressEntry[], clientId: ID) {
  return sortByDate(progress.filter((p) => p.clientId === clientId && p.weight != null)).map((p) => ({ date: p.date, weight: p.weight! }))
}

/** Heaviest weight logged per exercise, from real completion records. */
export function personalBests(completions: WorkoutCompletion[], clientId: ID) {
  const best = new Map<string, { name: string; weight: number; reps?: string; date: ISODate; exerciseKey: string }>()
  for (const c of completions.filter((x) => x.clientId === clientId)) {
    for (const r of c.results) {
      for (const s of r.sets) {
        const w = parseFloat(s.weight ?? '')
        if (!s.done || !Number.isFinite(w) || w <= 0) continue
        const key = r.exerciseId ?? r.name.toLowerCase()
        const cur = best.get(key)
        if (!cur || w > cur.weight) best.set(key, { name: r.name, weight: w, reps: s.reps, date: c.date, exerciseKey: key })
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Top-set weight per session for one exercise. */
export function exerciseHistory(completions: WorkoutCompletion[], clientId: ID, key: string) {
  const rows: { date: ISODate; top: number; sets: string }[] = []
  for (const c of sortByDate(completions.filter((x) => x.clientId === clientId))) {
    const r = c.results.find((x) => (x.exerciseId ?? x.name.toLowerCase()) === key)
    if (!r) continue
    const done = r.sets.filter((s) => s.done)
    const weights = done.map((s) => parseFloat(s.weight ?? '')).filter(Number.isFinite)
    if (!weights.length) continue
    rows.push({
      date: c.date,
      top: Math.max(...weights),
      sets: done.map((s) => `${s.reps ?? '–'}${s.weight ? ' × ' + s.weight + ' kg' : ''}`).join(', '),
    })
  }
  return rows
}

export function trackedExercises(completions: WorkoutCompletion[], clientId: ID) {
  const seen = new Map<string, string>()
  for (const c of completions.filter((x) => x.clientId === clientId))
    for (const r of c.results)
      if (r.sets.some((s) => parseFloat(s.weight ?? '') > 0)) seen.set(r.exerciseId ?? r.name.toLowerCase(), r.name)
  return [...seen.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** Completed vs scheduled per week for the last n weeks (current week last). */
export function weeklyHistory(sessions: ScheduledSession[], clientId: ID | undefined, n = 8) {
  const monday = startOfWeek(today())
  return Array.from({ length: n }, (_, i) => {
    const m = addDays(monday, -7 * (n - 1 - i))
    const s = weekStats(sessions, clientId, m)
    return { week: m, ...s }
  })
}
