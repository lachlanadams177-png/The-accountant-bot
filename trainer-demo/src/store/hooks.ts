import { useMemo } from 'react'
import { useStore } from './useStore'
import { EXERCISES } from '../data/exercises'
import type { Exercise, ID } from '../types'

/** Built-in library plus the trainer's own exercises. */
export function useExercises(): Exercise[] {
  const custom = useStore((s) => s.customExercises)
  return useMemo(() => [...custom, ...EXERCISES], [custom])
}

export function useClient(id: ID | undefined) {
  return useStore((s) => s.clients.find((c) => c.id === id))
}

export function useClientMap() {
  const clients = useStore((s) => s.clients)
  return useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
}

export function useWorkoutMap() {
  const workouts = useStore((s) => s.workouts)
  return useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts])
}

export function useActiveClients() {
  const clients = useStore((s) => s.clients)
  return useMemo(() => clients.filter((c) => c.status === 'active').sort((a, b) => a.name.localeCompare(b.name)), [clients])
}

/** Library workouts = the trainer's reusable templates (not client copies). */
export function useLibraryWorkouts() {
  const workouts = useStore((s) => s.workouts)
  return useMemo(() => workouts.filter((w) => !w.clientId).sort((a, b) => a.name.localeCompare(b.name)), [workouts])
}

export function useTemplatePrograms() {
  const programs = useStore((s) => s.programs)
  return useMemo(() => programs.filter((p) => !p.clientId), [programs])
}
