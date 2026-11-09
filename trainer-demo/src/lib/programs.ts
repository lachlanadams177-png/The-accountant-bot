import type { ID, ISODate, Program, ProgramWeek, ScheduledSession, Workout } from '../types'
import { addDays, today } from './date'
import { uid } from './id'
import { cloneBlocks } from './workout'

export const emptyWeek = (): ProgramWeek => ({
  id: uid('wk-'),
  days: Array.from({ length: 7 }, () => ({ workoutId: null })),
})

export const cloneWeek = (w: ProgramWeek): ProgramWeek => ({
  id: uid('wk-'),
  note: w.note,
  days: w.days.map((d) => ({ ...d })),
})

export function programWorkoutIds(p: Program): ID[] {
  const ids = new Set<ID>()
  p.weeks.forEach((w) => w.days.forEach((d) => d.workoutId && ids.add(d.workoutId)))
  return [...ids]
}

export function sessionsPerWeek(p: Program): number {
  if (!p.weeks.length) return 0
  const counts = p.weeks.map((w) => w.days.filter((d) => d.workoutId).length)
  return Math.max(...counts)
}

export function copyWorkout(w: Workout, patch: Partial<Workout> = {}): Workout {
  const now = new Date().toISOString()
  return {
    ...w,
    id: uid('w-'),
    blocks: cloneBlocks(w.blocks),
    sourceId: w.clientId ? w.sourceId : w.id,
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

/**
 * Make a client's personal copy of a program, including personal copies of every
 * workout it uses. Nothing in the returned data references the master's workouts,
 * so editing it can never change the template or anyone else's version.
 */
export function makeClientCopy(
  template: Program,
  workouts: Workout[],
  clientId: ID,
  startDate: ISODate,
): { program: Program; workouts: Workout[] } {
  const now = new Date().toISOString()
  const map = new Map<ID, ID>()
  const newWorkouts: Workout[] = []
  for (const wid of programWorkoutIds(template)) {
    const src = workouts.find((w) => w.id === wid)
    if (!src) continue
    const copy = copyWorkout(src, { clientId, sourceId: src.clientId ? src.sourceId : src.id })
    map.set(wid, copy.id)
    newWorkouts.push(copy)
  }
  const program: Program = {
    ...template,
    id: uid('p-'),
    clientId,
    sourceId: template.clientId ? template.sourceId : template.id,
    startDate,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    weeks: template.weeks.map((w) => ({
      id: uid('wk-'),
      note: w.note,
      days: w.days.map((d) => ({ note: d.note, workoutId: d.workoutId ? map.get(d.workoutId) ?? null : null })),
    })),
  }
  return { program, workouts: newWorkouts }
}

export function slotDate(p: Program, week: number, day: number): ISODate {
  return addDays(p.startDate!, week * 7 + day)
}

export function generateSessions(p: Program, fromDate: ISODate = today()): ScheduledSession[] {
  if (!p.clientId || !p.startDate) return []
  const out: ScheduledSession[] = []
  p.weeks.forEach((w, wi) =>
    w.days.forEach((d, di) => {
      if (!d.workoutId) return
      const date = slotDate(p, wi, di)
      if (date < fromDate) return
      out.push({
        id: uid('s-'),
        clientId: p.clientId!,
        date,
        kind: 'workout',
        workoutId: d.workoutId,
        programId: p.id,
        slot: `${wi}-${di}`,
        status: 'scheduled',
      })
    }),
  )
  return out
}

/**
 * After a client's program is edited, bring their calendar in line from today onward.
 * Completed sessions, past sessions and anything the trainer moved by hand are kept.
 */
export function resyncProgramSessions(p: Program, sessions: ScheduledSession[]): ScheduledSession[] {
  const t = today()
  const keep = sessions.filter(
    (s) => s.programId !== p.id || s.status === 'completed' || s.moved || s.date < t,
  )
  if (p.status !== 'active') return keep
  const taken = new Set(keep.filter((s) => s.programId === p.id).map((s) => s.slot))
  const fresh = generateSessions(p, t).filter((s) => !taken.has(s.slot))
  return [...keep, ...fresh]
}

/** Remove all upcoming, not-yet-done sessions belonging to a program. */
export function dropFutureSessions(programId: ID, sessions: ScheduledSession[]): ScheduledSession[] {
  const t = today()
  return sessions.filter((s) => !(s.programId === programId && s.status !== 'completed' && s.date >= t))
}
