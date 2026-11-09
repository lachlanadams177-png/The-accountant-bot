import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Client,
  DemoData,
  Exercise,
  ExerciseResult,
  ID,
  ISODate,
  Message,
  Program,
  ProgressEntry,
  ScheduledSession,
  TrainerNote,
  TrainerProfile,
  Workout,
  WorkoutCompletion,
} from '../types'
import { createSeedData, DATA_VERSION } from '../data/seed'
import { uid } from '../lib/id'
import { today } from '../lib/date'
import { copyWorkout, dropFutureSessions, makeClientCopy, resyncProgramSessions } from '../lib/programs'

const PALETTE = ['#3f826d', '#3f6fa8', '#b26a3c', '#5b5f97', '#a6567e', '#7a5aa6', '#2f7d8a', '#8a7a2f']

export type Mode = 'trainer' | 'client'

interface UiState {
  mode: Mode
  demoClientId: ID
}

interface Actions {
  setMode: (mode: Mode, clientId?: ID) => void
  resetDemo: () => void
  updateTrainer: (p: Partial<TrainerProfile>) => void

  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'status' | 'color'>) => Client
  updateClient: (id: ID, patch: Partial<Client>) => void
  setClientStatus: (id: ID, status: Client['status']) => void

  saveWorkout: (w: Workout) => Workout
  createWorkout: (patch?: Partial<Workout>) => Workout
  duplicateWorkout: (id: ID, patch?: Partial<Workout>) => Workout | undefined
  deleteWorkout: (id: ID) => void
  /** Copy a workout into a client's personal workouts and schedule it. */
  scheduleWorkout: (args: { workoutId: ID; clientId: ID; date: ISODate; copy?: boolean }) => ScheduledSession | undefined

  saveProgram: (p: Program) => Program
  duplicateProgram: (id: ID) => Program | undefined
  setProgramStatus: (id: ID, status: Program['status']) => void
  assignProgram: (templateId: ID, clientIds: ID[], startDate: ISODate) => Program[]
  saveProgramAsTemplate: (id: ID, name?: string) => Program | undefined

  addAppointment: (a: { clientId: ID; date: ISODate; time?: string; title?: string }) => ScheduledSession
  moveSession: (id: ID, date: ISODate) => void
  duplicateSession: (id: ID, date?: ISODate) => ScheduledSession | undefined
  deleteSession: (id: ID) => void
  changeSessionWorkout: (id: ID, workoutId: ID) => void
  completeSession: (args: {
    sessionId: ID
    by: 'client' | 'trainer'
    results?: ExerciseResult[]
    notes?: string
    feeling?: number
  }) => WorkoutCompletion | undefined
  undoCompletion: (sessionId: ID) => void

  addProgress: (e: Omit<ProgressEntry, 'id'>) => void
  deleteProgress: (id: ID) => void
  reviewCheckIn: (id: ID) => void

  addNote: (clientId: ID, text: string) => void
  updateNote: (id: ID, text: string) => void
  deleteNote: (id: ID) => void

  sendMessage: (clientId: ID, from: Message['from'], text: string) => void
  markRead: (clientId: ID, reader: Message['from']) => void

  saveCustomExercise: (e: Omit<Exercise, 'id' | 'custom'> & { id?: ID }) => Exercise
  deleteCustomExercise: (id: ID) => void
  toggleFavourite: (id: ID) => void
}

export type Store = DemoData & UiState & Actions

const initialUi = (data: DemoData): UiState => ({
  mode: 'trainer',
  demoClientId: data.clients.find((c) => c.status === 'active')?.id ?? '',
})

const nowIso = () => new Date().toISOString()

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const seed = createSeedData()
      return {
        ...seed,
        ...initialUi(seed),

        setMode: (mode, clientId) => set((s) => ({ mode, demoClientId: clientId ?? s.demoClientId })),
        resetDemo: () => {
          const fresh = createSeedData()
          set({ ...fresh, ...initialUi(fresh) })
          // clear any saved workout drafts too
          Object.keys(localStorage)
            .filter((k) => k.startsWith('muscleup-draft:') || k.startsWith('muscleup-log:'))
            .forEach((k) => localStorage.removeItem(k))
        },
        updateTrainer: (p) => set((s) => ({ trainer: { ...s.trainer, ...p } })),

        /* clients */
        addClient: (c) => {
          const client: Client = {
            ...c,
            id: uid('c-'),
            status: 'active',
            color: PALETTE[get().clients.length % PALETTE.length],
            createdAt: nowIso(),
          }
          set((s) => ({ clients: [...s.clients, client] }))
          return client
        },
        updateClient: (id, patch) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
        setClientStatus: (id, status) =>
          set((s) => {
            let sessions = s.sessions
            let programs = s.programs
            if (status === 'archived') {
              // archiving pauses their plan: future, not-done sessions are removed
              const t = today()
              sessions = sessions.filter((x) => !(x.clientId === id && x.status !== 'completed' && x.date >= t))
              programs = programs.map((p) => (p.clientId === id && p.status === 'active' ? { ...p, status: 'ended' } : p))
            }
            return { clients: s.clients.map((c) => (c.id === id ? { ...c, status } : c)), sessions, programs }
          }),

        /* workouts */
        saveWorkout: (w) => {
          const saved = { ...w, updatedAt: nowIso() }
          set((s) => {
            const exists = s.workouts.some((x) => x.id === w.id)
            return { workouts: exists ? s.workouts.map((x) => (x.id === w.id ? saved : x)) : [...s.workouts, saved] }
          })
          return saved
        },
        createWorkout: (patch = {}) => {
          const w: Workout = { id: uid('w-'), name: 'Untitled workout', mode: 'write', html: '', blocks: [], createdAt: nowIso(), updatedAt: nowIso(), ...patch }
          set((s) => ({ workouts: [...s.workouts, w] }))
          return w
        },
        duplicateWorkout: (id, patch = {}) => {
          const src = get().workouts.find((w) => w.id === id)
          if (!src) return
          const copy = copyWorkout(src, { name: `${src.name} (copy)`, clientId: src.clientId, sourceId: undefined, ...patch })
          set((s) => ({ workouts: [...s.workouts, copy] }))
          return copy
        },
        deleteWorkout: (id) =>
          set((s) => ({
            workouts: s.workouts.filter((w) => w.id !== id),
            programs: s.programs.map((p) => ({
              ...p,
              weeks: p.weeks.map((wk) => ({ ...wk, days: wk.days.map((d) => (d.workoutId === id ? { ...d, workoutId: null } : d)) })),
            })),
            sessions: s.sessions.filter((x) => !(x.workoutId === id && x.status !== 'completed')),
          })),
        scheduleWorkout: ({ workoutId, clientId, date, copy = true }) => {
          const src = get().workouts.find((w) => w.id === workoutId)
          if (!src) return
          let wid = workoutId
          if (copy && src.clientId !== clientId) {
            const c = copyWorkout(src, { clientId, sourceId: src.clientId ? src.sourceId : src.id })
            set((s) => ({ workouts: [...s.workouts, c] }))
            wid = c.id
          }
          const session: ScheduledSession = { id: uid('s-'), clientId, date, kind: 'workout', workoutId: wid, status: 'scheduled' }
          set((s) => ({ sessions: [...s.sessions, session] }))
          return session
        },

        /* programs */
        saveProgram: (p) => {
          const saved = { ...p, updatedAt: nowIso() }
          set((s) => {
            const exists = s.programs.some((x) => x.id === p.id)
            const programs = exists ? s.programs.map((x) => (x.id === p.id ? saved : x)) : [...s.programs, saved]
            const sessions = saved.clientId ? resyncProgramSessions(saved, s.sessions) : s.sessions
            return { programs, sessions }
          })
          return saved
        },
        duplicateProgram: (id) => {
          const src = get().programs.find((p) => p.id === id)
          if (!src) return
          const copy: Program = {
            ...src,
            id: uid('p-'),
            name: `${src.name} (copy)`,
            clientId: undefined,
            sourceId: undefined,
            startDate: undefined,
            status: 'active',
            weeks: src.weeks.map((w) => ({ ...w, id: uid('wk-'), days: w.days.map((d) => ({ ...d })) })),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
          // A duplicate of a client's copy must not share their personal workouts
          if (src.clientId) return get().saveProgramAsTemplate(id, copy.name)
          set((s) => ({ programs: [...s.programs, copy] }))
          return copy
        },
        setProgramStatus: (id, status) =>
          set((s) => {
            const p = s.programs.find((x) => x.id === id)
            const sessions = p?.clientId && status !== 'active' ? dropFutureSessions(id, s.sessions) : s.sessions
            return { programs: s.programs.map((x) => (x.id === id ? { ...x, status } : x)), sessions }
          }),
        assignProgram: (templateId, clientIds, startDate) => {
          const s = get()
          const template = s.programs.find((p) => p.id === templateId)
          if (!template) return []
          let programs = [...s.programs]
          let sessions = [...s.sessions]
          const workouts = [...s.workouts]
          const created: Program[] = []
          for (const clientId of clientIds) {
            // end whatever they were on before
            for (const old of programs.filter((p) => p.clientId === clientId && p.status === 'active')) {
              sessions = dropFutureSessions(old.id, sessions)
              programs = programs.map((p) => (p.id === old.id ? { ...p, status: 'ended' as const } : p))
            }
            const copy = makeClientCopy(template, s.workouts, clientId, startDate)
            workouts.push(...copy.workouts)
            programs.push(copy.program)
            sessions = resyncProgramSessions(copy.program, sessions)
            created.push(copy.program)
          }
          set({ programs, sessions, workouts })
          return created
        },
        saveProgramAsTemplate: (id, name) => {
          const s = get()
          const src = s.programs.find((p) => p.id === id)
          if (!src) return
          // copy every workout back into the library so the new template is independent
          const map = new Map<ID, ID>()
          const newWorkouts: Workout[] = []
          src.weeks.forEach((w) =>
            w.days.forEach((d) => {
              if (!d.workoutId || map.has(d.workoutId)) return
              const wk = s.workouts.find((x) => x.id === d.workoutId)
              if (!wk) return
              const c = copyWorkout(wk, { clientId: undefined, sourceId: undefined })
              map.set(d.workoutId, c.id)
              newWorkouts.push(c)
            }),
          )
          const tpl: Program = {
            ...src,
            id: uid('p-'),
            name: name ?? `${src.name} (template)`,
            clientId: undefined,
            sourceId: undefined,
            startDate: undefined,
            status: 'active',
            weeks: src.weeks.map((w) => ({ id: uid('wk-'), note: w.note, days: w.days.map((d) => ({ note: d.note, workoutId: d.workoutId ? map.get(d.workoutId) ?? null : null })) })),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
          set((st) => ({ programs: [...st.programs, tpl], workouts: [...st.workouts, ...newWorkouts] }))
          return tpl
        },

        /* sessions */
        addAppointment: ({ clientId, date, time, title }) => {
          const a: ScheduledSession = { id: uid('s-'), clientId, date, time, title: title || 'PT session', kind: 'appointment', status: 'scheduled' }
          set((s) => ({ sessions: [...s.sessions, a] }))
          return a
        },
        moveSession: (id, date) =>
          set((s) => ({
            sessions: s.sessions.map((x) => (x.id === id ? { ...x, date, moved: x.programId ? true : x.moved } : x)),
            completions: s.completions.map((c) => (c.sessionId === id ? { ...c, date } : c)),
          })),
        duplicateSession: (id, date) => {
          const src = get().sessions.find((x) => x.id === id)
          if (!src) return
          const copy: ScheduledSession = {
            id: uid('s-'),
            clientId: src.clientId,
            date: date ?? src.date,
            kind: src.kind,
            workoutId: src.workoutId,
            title: src.title,
            time: src.time,
            status: 'scheduled',
          }
          set((s) => ({ sessions: [...s.sessions, copy] }))
          return copy
        },
        deleteSession: (id) =>
          set((s) => ({
            sessions: s.sessions.filter((x) => x.id !== id),
            completions: s.completions.filter((c) => c.sessionId !== id),
          })),
        changeSessionWorkout: (id, workoutId) => {
          const s = get()
          const session = s.sessions.find((x) => x.id === id)
          const src = s.workouts.find((w) => w.id === workoutId)
          if (!session || !src) return
          let wid = workoutId
          if (src.clientId !== session.clientId) {
            const c = copyWorkout(src, { clientId: session.clientId, sourceId: src.clientId ? src.sourceId : src.id })
            set((st) => ({ workouts: [...st.workouts, c] }))
            wid = c.id
          }
          set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? { ...x, workoutId: wid, moved: x.programId ? true : x.moved } : x)) }))
        },
        completeSession: ({ sessionId, by, results = [], notes, feeling }) => {
          const s = get()
          const session = s.sessions.find((x) => x.id === sessionId)
          if (!session) return
          const w = s.workouts.find((x) => x.id === session.workoutId)
          const completion: WorkoutCompletion = {
            id: uid('wc-'),
            clientId: session.clientId,
            sessionId,
            workoutId: session.workoutId,
            workoutName: w?.name ?? session.title ?? 'Session',
            date: session.date,
            completedAt: nowIso(),
            notes: notes?.trim() || undefined,
            feeling,
            results,
            by,
          }
          set((st) => ({
            completions: [...st.completions.filter((c) => c.sessionId !== sessionId), completion],
            sessions: st.sessions.map((x) => (x.id === sessionId ? { ...x, status: 'completed', completionId: completion.id } : x)),
          }))
          return completion
        },
        undoCompletion: (sessionId) =>
          set((s) => ({
            completions: s.completions.filter((c) => c.sessionId !== sessionId),
            sessions: s.sessions.map((x) => (x.id === sessionId ? { ...x, status: 'scheduled', completionId: undefined } : x)),
          })),

        /* progress */
        addProgress: (e) => set((s) => ({ progress: [...s.progress, { ...e, id: uid('pe-') }] })),
        deleteProgress: (id) => set((s) => ({ progress: s.progress.filter((p) => p.id !== id) })),
        reviewCheckIn: (id) => set((s) => ({ progress: s.progress.map((p) => (p.id === id ? { ...p, reviewed: true } : p)) })),

        /* notes */
        addNote: (clientId, text) => {
          const n: TrainerNote = { id: uid('n-'), clientId, date: today(), text, updatedAt: nowIso() }
          set((s) => ({ notes: [...s.notes, n] }))
        },
        updateNote: (id, text) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, text, updatedAt: nowIso() } : n)) })),
        deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

        /* messages */
        sendMessage: (clientId, from, text) => {
          const m: Message = { id: uid('m-'), clientId, from, text, sentAt: nowIso(), read: false }
          set((s) => ({ messages: [...s.messages, m] }))
        },
        markRead: (clientId, reader) =>
          set((s) => {
            const other = reader === 'trainer' ? 'client' : 'trainer'
            if (!s.messages.some((m) => m.clientId === clientId && m.from === other && !m.read)) return s
            return { messages: s.messages.map((m) => (m.clientId === clientId && m.from === other ? { ...m, read: true } : m)) }
          }),

        /* exercises */
        saveCustomExercise: (e) => {
          const ex: Exercise = { ...e, id: e.id ?? uid('ex-custom-'), custom: true }
          set((s) => {
            const exists = s.customExercises.some((x) => x.id === ex.id)
            return { customExercises: exists ? s.customExercises.map((x) => (x.id === ex.id ? ex : x)) : [...s.customExercises, ex] }
          })
          return ex
        },
        deleteCustomExercise: (id) =>
          set((s) => ({
            customExercises: s.customExercises.filter((x) => x.id !== id),
            favouriteExerciseIds: s.favouriteExerciseIds.filter((f) => f !== id),
          })),
        toggleFavourite: (id) =>
          set((s) => ({
            favouriteExerciseIds: s.favouriteExerciseIds.includes(id)
              ? s.favouriteExerciseIds.filter((f) => f !== id)
              : [...s.favouriteExerciseIds, id],
          })),
      }
    },
    {
      name: 'muscleup-demo',
      version: DATA_VERSION,
      migrate: (persisted, fromVersion) => {
        // v3 → v4: the trainer is Casey. Keep everything else the user has changed.
        if (fromVersion === 3 && persisted && typeof persisted === 'object') {
          const old = persisted as Store
          const trainer = old.trainer?.name === 'Sarah Mitchell' ? { name: 'Casey', business: 'Muscle Up Strength & Conditioning' } : old.trainer
          return { ...old, trainer } as Store
        }
        // Any older data shape re-seeds rather than trying to migrate old demo data.
        const fresh = createSeedData()
        return { ...fresh, ...initialUi(fresh) } as unknown as Store
      },
      partialize: (s) => {
        const { ...data } = s
        return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v !== 'function')) as unknown as Store
      },
    },
  ),
)

// Handy for poking at demo data from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { __muscleup: typeof useStore }).__muscleup = useStore
