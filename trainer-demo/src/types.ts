/**
 * Core data model. Everything is plain serialisable data so it can live in
 * localStorage today and move to a real backend later without reshaping.
 *
 * Key separations:
 *  - Workout definitions (Workout) are separate from when they happen (ScheduledSession).
 *  - Master templates (isTemplate / no clientId) are separate from client copies
 *    (clientId set). Assigning always copies, so editing a client's version never
 *    touches the master.
 *  - Free-text workouts keep their original HTML untouched in `html`.
 */

export type ID = string
/** Local calendar date, always 'YYYY-MM-DD'. */
export type ISODate = string

export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Client {
  id: ID
  name: string
  email?: string
  phone?: string
  goal?: string
  experience?: ExperienceLevel
  /** General info (visible to trainer only). Dated private notes live in TrainerNote. */
  notes?: string
  status: 'active' | 'archived'
  color: string
  createdAt: string
}

export type ExerciseCategory =
  | 'Strength'
  | 'Cardio'
  | 'Bodyweight'
  | 'Mobility'
  | 'Functional'
  | 'Pilates & Core'

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Exercise {
  id: ID
  name: string
  category: ExerciseCategory
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  difficulty: Difficulty
  description: string
  instructions: string[]
  safety?: string
  mediaUrl?: string
  custom?: boolean
}

/** A single exercise line inside a structured workout. Every target is optional free text. */
export interface ExerciseItem {
  id: ID
  exerciseId?: ID
  name: string
  sets?: string
  reps?: string
  weight?: string
  rest?: string
  tempo?: string
  notes?: string
}

export type WorkoutBlock =
  | { id: ID; type: 'section'; title: string }
  | { id: ID; type: 'text'; text: string }
  | ({ type: 'exercise' } & ExerciseItem)
  | { id: ID; type: 'group'; kind: 'superset' | 'circuit'; rounds?: string; rest?: string; items: ExerciseItem[] }

export type WorkoutMode = 'write' | 'build'

export interface Workout {
  id: ID
  name: string
  /** Which editor/view is the "real" one. Both bodies are kept so switching never loses work. */
  mode: WorkoutMode
  /** Quick Write content, stored exactly as written. */
  html: string
  /** Structured builder content. */
  blocks: WorkoutBlock[]
  /** Set when this is a client's personal copy. Undefined = trainer's library (template). */
  clientId?: ID
  /** Where a copy came from, for reference only. */
  sourceId?: ID
  createdAt: string
  updatedAt: string
}

export interface ProgramDay {
  /** null = rest day */
  workoutId: ID | null
  note?: string
}

export interface ProgramWeek {
  id: ID
  /** Always 7 entries, Monday first. */
  days: ProgramDay[]
  note?: string
}

export interface Program {
  id: ID
  name: string
  description?: string
  goal?: string
  daysPerWeek: number
  weeks: ProgramWeek[]
  /** Set when this is a client's assigned copy. */
  clientId?: ID
  /** The master template this copy was made from. */
  sourceId?: ID
  /** Monday the client copy starts on. */
  startDate?: ISODate
  /** Client copies: 'active' | 'ended'. Templates: 'active' | 'archived'. */
  status: 'active' | 'archived' | 'ended'
  createdAt: string
  updatedAt: string
}

export interface ScheduledSession {
  id: ID
  clientId: ID
  date: ISODate
  kind: 'workout' | 'appointment'
  workoutId?: ID
  /** Appointments (and optional label override). */
  title?: string
  time?: string
  programId?: ID
  /** 'week-day' slot inside the program it came from. */
  slot?: string
  /** True once the trainer has moved it manually; program re-syncs leave it alone. */
  moved?: boolean
  status: 'scheduled' | 'completed'
  completionId?: ID
}

export interface SetResult {
  reps?: string
  weight?: string
  done: boolean
}

export interface ExerciseResult {
  itemId: ID
  exerciseId?: ID
  name: string
  sets: SetResult[]
  notes?: string
}

export interface WorkoutCompletion {
  id: ID
  clientId: ID
  sessionId?: ID
  workoutId?: ID
  workoutName: string
  date: ISODate
  completedAt: string
  notes?: string
  /** 1–5 how it felt, optional */
  feeling?: number
  results: ExerciseResult[]
  by: 'client' | 'trainer'
}

export interface Measurements {
  waist?: number
  hips?: number
  chest?: number
  arm?: number
  thigh?: number
}

export interface ProgressEntry {
  id: ID
  clientId: ID
  date: ISODate
  weight?: number
  measurements?: Measurements
  note?: string
  /** Submitted by the client as a check-in */
  checkIn?: boolean
  reviewed?: boolean
}

export interface TrainerNote {
  id: ID
  clientId: ID
  date: ISODate
  text: string
  updatedAt: string
}

export interface Message {
  id: ID
  clientId: ID
  from: 'trainer' | 'client'
  text: string
  sentAt: string
  read: boolean
}

/** Derived view of a client's message thread. */
export interface Conversation {
  clientId: ID
  messages: Message[]
  last?: Message
  unreadForTrainer: number
  unreadForClient: number
}

export interface TrainerProfile {
  name: string
  business: string
}

export interface DemoData {
  version: number
  seededOn: ISODate
  trainer: TrainerProfile
  clients: Client[]
  workouts: Workout[]
  programs: Program[]
  sessions: ScheduledSession[]
  completions: WorkoutCompletion[]
  progress: ProgressEntry[]
  notes: TrainerNote[]
  messages: Message[]
  customExercises: Exercise[]
  favouriteExerciseIds: ID[]
}
