import type {
  Client,
  DemoData,
  ExerciseItem,
  ExerciseResult,
  ID,
  Message,
  Program,
  ProgressEntry,
  ScheduledSession,
  TrainerNote,
  Workout,
  WorkoutBlock,
  WorkoutCompletion,
} from '../types'
import { addDays, startOfWeek, stamp, today } from '../lib/date'
import { uid } from '../lib/id'
import { makeClientCopy, generateSessions } from '../lib/programs'
import { mdToHtml, setCount } from '../lib/workout'
import { exerciseByName } from './exercises'

export const DATA_VERSION = 4

/* ───────────── helpers for writing seed workouts compactly */

const e = (name: string, sets?: string, reps?: string, weight?: string, rest?: string, more: Partial<ExerciseItem> = {}): WorkoutBlock => {
  const ex = exerciseByName(name)
  if (!ex && import.meta.env.DEV) console.warn('Seed exercise not found:', name)
  return { type: 'exercise', id: uid('it-'), exerciseId: ex?.id, name, sets, reps, weight, rest, ...more }
}
const item = (name: string, sets?: string, reps?: string, weight?: string, rest?: string, more: Partial<ExerciseItem> = {}): ExerciseItem =>
  e(name, sets, reps, weight, rest, more) as ExerciseItem
const sec = (title: string): WorkoutBlock => ({ id: uid('b-'), type: 'section', title })
const note = (text: string): WorkoutBlock => ({ id: uid('b-'), type: 'text', text })
const group = (kind: 'superset' | 'circuit', rounds: string, items: ExerciseItem[], rest?: string): WorkoutBlock => ({
  id: uid('b-'), type: 'group', kind, rounds, rest, items,
})

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ───────────── workout templates */

type WDef = { key: string; name: string } & ({ md: string } | { blocks: WorkoutBlock[] })

const WORKOUTS: WDef[] = [
  {
    key: 'fbA', name: 'Full Body A',
    blocks: [
      sec('Warm up'),
      e('Dynamic Warm-Up Flow', '1', '5 min'),
      sec('Main workout'),
      e('Goblet Squat', '3', '10', '12kg', '90s'),
      e('Dumbbell Bench Press', '3', '10', '10kg', '90s'),
      e('Seated Cable Row', '3', '12', '25kg', '60s'),
      e('Dumbbell Romanian Deadlift', '3', '10', '10kg', '60s'),
      note('Take your time between sets. Technique first — we will add weight when it feels easy.'),
      sec('Core'),
      e('Dead Bug', '2', '8 each side'),
      e('Plank', '2', '30 sec'),
    ],
  },
  {
    key: 'fbB', name: 'Full Body B',
    blocks: [
      sec('Warm up'),
      e('Stationary Bike', '1', '5 min'),
      e('Glute Bridge', '2', '15'),
      sec('Main workout'),
      e('Leg Press', '3', '12', '60kg', '90s'),
      e('Lat Pulldown', '3', '10', '30kg', '90s'),
      e('Seated Dumbbell Shoulder Press', '3', '10', '6kg', '60s'),
      e('Reverse Lunge', '2', '8 each leg', '', '60s'),
      sec('Finisher'),
      e("Farmer's Carry", '3', '30 m', '12kg'),
    ],
  },
  {
    key: 'fbC', name: 'Full Body C',
    md: `# Warm Up
5 min rower, easy
Inchworms x 6
Bodyweight squats x 15

# Main Workout
Trap Bar Deadlift — 4 x 8
Incline Dumbbell Press — 3 x 10
Single-Arm Dumbbell Row — 3 x 10 each side
Walking Lunges — 3 x 12 steps

# Finisher
Kettlebell swings x 15, rest 45 sec — 5 rounds

Notes:
Push the deadlifts today if they feel smooth. Finisher should feel hard but steady.`,
  },
  {
    key: 'lowerCardio', name: 'Lower Body & Cardio',
    md: `# Warm Up
5 min bike
Bodyweight squats x 15
Glute bridges x 20

# Main Workout
Squats — 4 x 10
Romanian Deadlifts — 3 x 12
Walking Lunges — 3 x 20 steps
Leg Press — 3 x 12

# Finisher
Bike intervals — 30 sec hard / 30 sec easy x 8

Notes:
**Focus on controlled movement and good technique.**`,
  },
  {
    key: 'upperCircuit', name: 'Upper Body Circuit',
    blocks: [
      sec('Warm up'),
      e('Arm Circles', '1', '30 sec each way'),
      e('Band Pull-Apart', '2', '15'),
      note('Move straight from one exercise to the next. Rest 90 seconds after each round.'),
      group('circuit', '4', [
        item('Incline Push-Up', '', '12'),
        item('TRX Row', '', '12'),
        item('Seated Dumbbell Shoulder Press', '', '10', '6kg'),
        item('Dumbbell Bicep Curl', '', '12', '6kg'),
        item('Tricep Rope Pushdown', '', '12', '15kg'),
      ], '90s'),
      sec('Cool down'),
      e('Doorway Chest Stretch', '1', '30 sec each side'),
    ],
  },
  {
    key: 'conditioning', name: 'Full Body Conditioning',
    md: `# Warm Up
Skipping or jumping jacks — 3 min
World's greatest stretch x 4 each side

# Circuit — 40 sec on / 20 sec off, 4 rounds
1. Kettlebell swings
2. Push-ups (knees are fine)
3. Goblet squats
4. Mountain climbers
5. Row machine

Rest 2 minutes between rounds.

# Cool Down
5 min easy walk
Hip flexor stretch — 30 sec each side

Notes:
Work at about 7/10 effort. Keep moving, but slow down if your form breaks down.`,
  },
  {
    key: 'longWalk', name: 'Long Walk',
    md: `# Long Walk — 45 to 60 minutes
Pick a route you enjoy. The beach path or a hilly loop is perfect.

- Pace: you can talk, but you're breathing a bit harder than normal
- Add a couple of hills if you can
- Take water if it's warm

Log how long you walked and how you felt in the notes when you finish.`,
  },
  {
    key: 'push', name: 'Push Day',
    blocks: [
      sec('Warm up'),
      e('Rowing Machine', '1', '5 min'),
      e('Band Pull-Apart', '2', '20'),
      sec('Main workout'),
      e('Barbell Bench Press', '4', '8', '70kg', '2 min'),
      e('Incline Dumbbell Press', '3', '10', '26kg', '90s'),
      e('Seated Dumbbell Shoulder Press', '3', '10', '22kg', '90s'),
      group('superset', '3', [
        item('Lateral Raise', '', '15', '10kg'),
        item('Tricep Rope Pushdown', '', '12', '25kg'),
      ], '60s'),
      e('Cable Fly', '2', '15', '12.5kg', '60s'),
      note('Last set of each exercise: aim to be 1–2 reps from failure.'),
    ],
  },
  {
    key: 'pull', name: 'Pull Day',
    blocks: [
      sec('Warm up'),
      e('Ski Erg', '1', '4 min'),
      e('Face Pull', '2', '15', '15kg'),
      sec('Main workout'),
      e('Pull-Up', '4', '6–8', 'Bodyweight', '2 min'),
      e('Barbell Bent-Over Row', '4', '8', '65kg', '2 min'),
      e('Close-Grip Lat Pulldown', '3', '10', '55kg', '90s'),
      group('superset', '3', [
        item('Incline Dumbbell Curl', '', '10', '12kg'),
        item('Hammer Curl', '', '12', '14kg'),
      ], '60s'),
      e('Rear Delt Fly', '3', '15', '8kg', '45s'),
    ],
  },
  {
    key: 'legs', name: 'Leg Day',
    blocks: [
      sec('Warm up'),
      e('Stationary Bike', '1', '5 min'),
      e('Leg Swings', '1', '10 each leg'),
      sec('Main workout'),
      e('Barbell Back Squat', '4', '8', '90kg', '2–3 min', { tempo: '3-1-1' }),
      e('Romanian Deadlift', '3', '10', '80kg', '2 min'),
      e('Leg Press', '3', '12', '160kg', '90s'),
      e('Leg Extension', '3', '15', '45kg', '60s'),
      e('Standing Calf Raise', '4', '12', '60kg', '45s'),
    ],
  },
  {
    key: 'glutes', name: 'Glutes & Hamstrings',
    blocks: [
      sec('Warm up'),
      e('Lateral Band Walk', '2', '12 each way'),
      e('Glute Bridge', '2', '15'),
      sec('Main workout'),
      e('Barbell Hip Thrust', '4', '10', '80kg', '2 min'),
      e('Bulgarian Split Squat', '3', '10 each leg', '16kg', '90s'),
      group('superset', '3', [
        item('Lying Leg Curl', '', '12', '35kg'),
        item('Back Extension', '', '15'),
      ], '60s'),
      e('Cable Glute Kickback', '2', '15 each leg', '10kg'),
    ],
  },
  {
    key: 'gentle1', name: 'Gentle Full Body',
    md: `# Warm Up
5 min walk on the treadmill
Arm circles and leg swings — 1 min

# Main Workout
Box squats to a bench — 3 x 10
Wall push-ups or incline push-ups — 3 x 8
Seated row (light) — 3 x 12
Glute bridges — 3 x 12
Bird dogs — 2 x 6 each side

# Cool Down
Child's pose — 1 min
Hamstring stretch — 30 sec each side

Notes:
This is about getting back into the habit. **Leave the gym feeling like you could have done more.**`,
  },
  {
    key: 'walkMob', name: 'Walk & Mobility',
    md: `# Walk — 30 minutes
Easy pace, flat route.

# Mobility — 10 minutes
- Cat-cow x 10
- 90/90 hip switches x 8
- Thread the needle x 6 each side
- Calf stretch — 30 sec each side
- Deep squat hold — 3 x 20 sec (hold onto something)`,
  },
  {
    key: 'gentle2', name: 'Gentle Full Body 2',
    blocks: [
      sec('Warm up'),
      e('Elliptical Trainer', '1', '6 min'),
      sec('Main workout'),
      e('Goblet Squat', '3', '10', '8kg', '90s'),
      e('Machine Chest Press', '3', '10', '15kg', '90s'),
      e('Lat Pulldown', '3', '10', '20kg', '90s'),
      e('Step-Up', '2', '8 each leg', '', '60s'),
      note('If anything feels sore, swap it for something gentler — just let me know what you changed.'),
      sec('Cool down'),
      e('Cat-Cow', '1', '10'),
    ],
  },
  {
    key: 'upperS', name: 'Upper Strength',
    blocks: [
      sec('Warm up'),
      e('Rowing Machine', '1', '5 min'),
      e('Face Pull', '2', '15', '15kg'),
      sec('Main workout'),
      e('Barbell Bench Press', '5', '5', '85kg', '3 min'),
      e('Barbell Bent-Over Row', '5', '5', '75kg', '2–3 min'),
      e('Overhead Barbell Press', '3', '6', '50kg', '2 min'),
      e('Chin-Up', '3', '8', 'Bodyweight', '2 min'),
      sec('Accessories'),
      group('superset', '3', [
        item('Skull Crusher', '', '10', '30kg'),
        item('Barbell Curl', '', '10', '30kg'),
      ], '60s'),
    ],
  },
  {
    key: 'lowerS', name: 'Lower Strength',
    blocks: [
      sec('Warm up'),
      e('Stationary Bike', '1', '5 min'),
      e("World's Greatest Stretch", '1', '4 each side'),
      sec('Main workout'),
      e('Barbell Back Squat', '5', '5', '110kg', '3 min'),
      e('Conventional Deadlift', '3', '5', '140kg', '3 min'),
      e('Bulgarian Split Squat', '3', '8 each leg', '20kg', '90s'),
      e('Seated Calf Raise', '3', '15', '40kg', '45s'),
      sec('Core'),
      e('Hanging Knee Raise', '3', '12'),
    ],
  },
  {
    key: 'upperV', name: 'Upper Volume',
    blocks: [
      sec('Main workout'),
      e('Incline Barbell Press', '4', '10', '60kg', '90s'),
      e('Chest-Supported Row', '4', '12', '24kg', '90s'),
      e('Arnold Press', '3', '12', '16kg', '60s'),
      e('Lat Pulldown', '3', '12', '60kg', '60s'),
      group('superset', '3', [
        item('Cable Lateral Raise', '', '15', '7.5kg'),
        item('Face Pull', '', '15', '20kg'),
      ], '45s'),
      note('Keep rests honest today — this one is about volume, not max weight.'),
    ],
  },
  {
    key: 'lowerV', name: 'Lower Volume',
    blocks: [
      sec('Main workout'),
      e('Front Squat', '4', '8', '70kg', '2 min'),
      e('Romanian Deadlift', '4', '10', '90kg', '2 min'),
      e('Walking Lunge', '3', '20 steps', '20kg', '90s'),
      e('Seated Leg Curl', '3', '12', '50kg', '60s'),
      e('Standing Calf Raise', '3', '15', '70kg', '45s'),
    ],
  },
  {
    key: 'pilates', name: 'Pilates Mat Flow',
    md: `# Centre & Breathe — 3 min
Lie on your back, knees bent. Slow breathing into the ribs.
Pelvic tilts x 10

# Mat Flow
1. The hundred — 1 round of 100 pumps
2. Roll-ups x 6 (bend the knees if you need to)
3. Single-leg stretch x 10 each side
4. Criss-cross x 8 each side
5. Shoulder bridge x 8 — peel up slowly
6. Side-lying leg lifts x 12 each side
7. Clamshells x 15 each side
8. Swimming — 30 sec

# Finish
Spine stretch forward x 5
Child's pose — 1 min

Notes:
Quality over quantity. Move with your breath and keep your neck relaxed.`,
  },
  {
    key: 'mobility', name: 'Mobility Reset',
    blocks: [
      note('Go slowly. You should feel a gentle stretch — never pain.'),
      sec('Spine'),
      e('Cat-Cow', '1', '10'),
      e('Thoracic Rotation', '2', '8 each side'),
      e('Thread the Needle', '2', '6 each side'),
      sec('Hips'),
      e('90/90 Hip Switch', '2', '8'),
      e('Hip Flexor Stretch', '2', '30 sec each side'),
      e('Pigeon Stretch', '1', '45 sec each side'),
      sec('Shoulders'),
      e('Wall Slides', '2', '10'),
      e('Shoulder Dislocates', '2', '10'),
    ],
  },
  {
    key: 'core', name: 'Core Strength',
    blocks: [
      sec('Main workout'),
      e('Dead Bug', '3', '10 each side', '', '45s'),
      e('Side Plank', '3', '30 sec each side', '', '45s'),
      e('Pallof Press', '3', '12 each side', '10kg', '45s'),
      e('Bird Dog', '3', '8 each side', '', '45s'),
      group('circuit', '2', [
        item('Toe Taps', '', '12'),
        item('Hollow Hold', '', '20 sec'),
        item('Glute Bridge', '', '15'),
      ], '60s'),
    ],
  },
  {
    key: 'athletic', name: 'Athletic Conditioning',
    md: `# Warm Up
Agility ladder — 5 min, mix of patterns
High knees x 20 m, skater hops x 10

# Power
Box jumps — 4 x 5 (step down every rep)
Medicine ball rotational throws — 3 x 6 each side

# Conditioning
Sled push — 6 x 20 m, rest 60 sec
Assault bike — 10 x 15 sec flat out / 45 sec easy

# Cool Down
Easy walk 5 min, then hip and hamstring stretches

Notes:
Explosive and crisp. If speed drops off a lot, take an extra 30 seconds rest.`,
  },
  {
    key: 'welcome', name: 'Welcome Back Session',
    md: `# Welcome back, Chloe!
Today is about seeing how everything feels. No pressure at all.

# Warm Up
5 min easy bike

# Movement check
- Bodyweight squats x 10
- Incline push-ups x 8
- Glute bridges x 12
- Bird dogs x 5 each side
- Plank — hold for as long as it feels comfortable (up to 30 sec)

# Finish
5 min walk and a gentle stretch

Let me know in the notes if anything felt sore or tight.`,
  },
]

/* ───────────── programs */

type PDef = {
  key: string
  name: string
  description: string
  goal: string
  weeks: number
  /** 7 entries, Monday first. Workout key or null. Applied to every week. */
  pattern: (string | null)[]
  /** Optional alternative pattern for odd weeks (index 1, 3 …) */
  alt?: (string | null)[]
}

const PROGRAMS: PDef[] = [
  {
    key: 'beginner', name: '4 Week Beginner Strength', goal: 'Build strength',
    description: 'Three simple full-body sessions a week to learn the main lifts and build confidence.',
    weeks: 4, pattern: ['fbA', null, 'fbB', null, 'fbA', null, null], alt: ['fbB', null, 'fbA', null, 'fbB', null, null],
  },
  {
    key: 'fatloss', name: '8 Week Fat Loss', goal: 'Weight loss',
    description: 'Strength plus conditioning with one long walk each week. Sustainable, not punishing.',
    weeks: 8, pattern: ['lowerCardio', 'upperCircuit', null, 'conditioning', null, 'longWalk', null],
  },
  {
    key: 'muscle', name: '12 Week Muscle Building', goal: 'Build muscle',
    description: 'A four-day push / pull / legs / glutes split with steady progression.',
    weeks: 12, pattern: ['push', 'pull', null, 'legs', 'glutes', null, null],
  },
  {
    key: 'return', name: '6 Week Return to Fitness', goal: 'Return to training',
    description: 'A gentle way back after time off. Three short sessions to rebuild the habit.',
    weeks: 6, pattern: ['gentle1', null, 'walkMob', null, 'gentle2', null, null],
  },
  {
    key: 'fullbody3', name: '3 Day Full Body', goal: 'General fitness',
    description: 'Monday, Wednesday, Friday full-body training. Simple and effective.',
    weeks: 6, pattern: ['fbA', null, 'fbC', null, 'fbB', null, null],
  },
  {
    key: 'upperlower', name: 'Upper / Lower Split', goal: 'Strength',
    description: 'Four days a week: a heavy and a volume day for upper and lower body.',
    weeks: 8, pattern: ['upperS', 'lowerS', null, 'upperV', 'lowerV', null, null],
  },
  {
    key: 'coremob', name: 'Core & Mobility', goal: 'Mobility & core',
    description: 'Pilates-style mat work, core strength and mobility three times a week.',
    weeks: 6, pattern: ['pilates', null, 'core', null, 'mobility', null, null],
  },
]

/* ───────────── clients */

type CDef = {
  key: string
  name: string
  email: string
  phone: string
  goal: string
  experience: Client['experience']
  notes: string
  color: string
  program?: string
  /** weeks ago the program started (0 = this week) */
  startedWeeksAgo: number
  /** chance a past session was completed */
  adherence: number
  /** sessions (counted back from most recent past) forced to be missed */
  recentMisses?: number
  startWeight: number
  weeklyWeightChange: number
  joinedDaysAgo: number
}

const CLIENTS: CDef[] = [
  { key: 'emma', name: 'Emma Wilson', email: 'emma.wilson@example.com', phone: '0412 345 678', goal: 'General fitness — feel fitter and stronger for netball season', experience: 'Intermediate', notes: 'Plays netball Saturdays. Prefers early morning sessions.', color: '#3f826d', program: 'fullbody3', startedWeeksAgo: 3, adherence: 0.9, startWeight: 66.4, weeklyWeightChange: -0.15, joinedDaysAgo: 140 },
  { key: 'jake', name: 'Jake Thompson', email: 'jake.t@example.com', phone: '0423 111 902', goal: 'Build muscle — gain 4 kg of lean mass', experience: 'Intermediate', notes: 'Eats well, sleeps badly. Works shifts at the hospital.', color: '#3f6fa8', program: 'muscle', startedWeeksAgo: 5, adherence: 0.92, startWeight: 78.2, weeklyWeightChange: 0.25, joinedDaysAgo: 210 },
  { key: 'olivia', name: 'Olivia Martin', email: 'olivia.martin@example.com', phone: '0433 870 221', goal: 'Weight loss — down to 75 kg by Christmas', experience: 'Beginner', notes: 'Busy with two young kids. Evening sessions work best.', color: '#b26a3c', program: 'fatloss', startedWeeksAgo: 4, adherence: 0.78, recentMisses: 2, startWeight: 84.6, weeklyWeightChange: -0.6, joinedDaysAgo: 60 },
  { key: 'daniel', name: 'Daniel Cooper', email: 'dan.cooper@example.com', phone: '0401 556 330', goal: 'Strength — 150 kg deadlift', experience: 'Advanced', notes: 'Competitive, likes numbers. Old left shoulder niggle — keep pressing volume sensible.', color: '#5b5f97', program: 'upperlower', startedWeeksAgo: 6, adherence: 0.95, startWeight: 88.0, weeklyWeightChange: 0.1, joinedDaysAgo: 400 },
  { key: 'sophie', name: 'Sophie Taylor', email: 'sophie.taylor@example.com', phone: '0455 218 774', goal: 'Beginner training — learn the basics with confidence', experience: 'Beginner', notes: 'First time in a gym. A little nervous — lots of encouragement.', color: '#a6567e', program: 'beginner', startedWeeksAgo: 2, adherence: 0.8, recentMisses: 1, startWeight: 61.0, weeklyWeightChange: 0, joinedDaysAgo: 18 },
  { key: 'mia', name: 'Mia Roberts', email: 'mia.roberts@example.com', phone: '0477 903 145', goal: 'Pilates & mobility — ease lower back stiffness', experience: 'Intermediate', notes: 'Desk job. Lower back tightness after long days. Loves reformer classes.', color: '#7a5aa6', program: 'coremob', startedWeeksAgo: 3, adherence: 0.88, startWeight: 58.5, weeklyWeightChange: 0, joinedDaysAgo: 95 },
  { key: 'liam', name: 'Liam Harris', email: 'liam.harris@example.com', phone: '0490 334 812', goal: 'Athletic conditioning — pre-season for footy', experience: 'Advanced', notes: 'Plays local AFL. Pre-season starts in January.', color: '#2f7d8a', program: 'upperlower', startedWeeksAgo: 2, adherence: 0.9, startWeight: 81.0, weeklyWeightChange: -0.1, joinedDaysAgo: 30 },
  { key: 'chloe', name: 'Chloe Anderson', email: 'chloe.a@example.com', phone: '0468 120 559', goal: 'Return to fitness after a year off', experience: 'Beginner', notes: 'Had a year off after moving interstate. Used to run 5 km regularly.', color: '#8a7a2f', program: 'return', startedWeeksAgo: 0, adherence: 1, startWeight: 70.3, weeklyWeightChange: 0, joinedDaysAgo: 5 },
  { key: 'ben', name: 'Ben Nguyen', email: 'ben.nguyen@example.com', phone: '0411 778 090', goal: 'Marathon prep', experience: 'Intermediate', notes: 'Finished his block in August. Paused training — may come back in the new year.', color: '#6b7280', startedWeeksAgo: 0, adherence: 0, startWeight: 72, weeklyWeightChange: 0, joinedDaysAgo: 320 },
]

const TRAINER_NOTES: Record<string, [number, string][]> = {
  emma: [[20, 'Squat depth much better. Ready for a heavier goblet squat next block.'], [6, 'Mentioned a tight left calf after netball — monitor, add extra calf stretching.']],
  jake: [[30, 'Weight trending up nicely. Reminded him about protein on night shifts.'], [9, 'Bench stalled at 70 kg for 2 weeks. Consider a deload week after week 6.']],
  olivia: [[25, 'Started strong. Really enjoying the circuit sessions.'], [4, 'Has missed a couple of sessions — kids have been sick. Check in gently, maybe shorten sessions.']],
  daniel: [[40, 'Shoulder feeling good. Keep overhead pressing at 3 sets max.'], [12, 'Deadlift 140 x 5 moved fast. 150 kg single in about 4 weeks looks realistic.']],
  sophie: [[14, 'First session went great — she was nervous but loved it. Keep the same exercises for a few weeks.']],
  mia: [[22, 'Lower back much less stiff after 2 weeks of mobility. Keep the 90/90 work.'], [3, 'Asked about adding a reformer class — fine to swap the Friday session if she wants.']],
  liam: [[13, 'Added a Saturday conditioning day to his copy of the Upper / Lower program for pre-season.']],
  chloe: [[4, 'Initial chat: no injuries, just deconditioned. Starting with the Return to Fitness program.']],
  ben: [[90, 'Paused training after marathon. Follow up in January.']],
}

type MDef = [daysAgo: number, hour: number, from: 'trainer' | 'client', text: string]
const MESSAGES: Record<string, MDef[]> = {
  emma: [
    [3, 7, 'trainer', 'Great work this week Emma! Your squats are looking so much stronger.'],
    [3, 8, 'client', 'Thanks! Legs are a bit sore today haha'],
    [0, 7, 'client', 'Hey! Can we move Thursday to Friday this week? I have a work thing.'],
  ],
  jake: [
    [6, 18, 'client', 'Is it ok if I train pull day after a night shift or should I swap it?'],
    [6, 19, 'trainer', 'Totally fine to swap it — just keep the order Push → Pull → Legs in the week.'],
    [5, 7, 'client', 'Legend, thanks'],
  ],
  olivia: [
    [2, 20, 'trainer', 'Hi Olivia, hope the kids are feeling better! No stress about missing sessions — want me to make this week shorter?'],
  ],
  daniel: [
    [8, 6, 'client', 'Deadlift felt amazing today. 140 x 5!'],
    [8, 9, 'trainer', 'Massive! That is a 10 kg PB for 5 reps. Keep it rolling.'],
  ],
  mia: [
    [1, 17, 'client', 'I submitted my check-in. Back has been so much better this week!'],
  ],
  liam: [
    [4, 12, 'trainer', 'I added a Saturday conditioning session to your program for pre-season.'],
    [1, 19, 'client', 'Saturday session was brutal 😅 Should the sled be heavier or faster?'],
  ],
  sophie: [
    [10, 15, 'trainer', 'Welcome Sophie! Your first workouts are in the app. Message me any time.'],
    [10, 16, 'client', 'Thank you!! A bit nervous but excited'],
  ],
}

/* ───────────── build */

export function createSeedData(): DemoData {
  const t = today()
  const thisMonday = startOfWeek(t)
  const rand = rng(20261109)

  // workouts
  const wByKey = new Map<string, Workout>()
  const workouts: Workout[] = WORKOUTS.map((d, i) => {
    const created = stamp(addDays(t, -120 + i * 3), 10)
    const w: Workout = {
      id: `w-${d.key}`,
      name: d.name,
      mode: 'md' in d ? 'write' : 'build',
      html: 'md' in d ? mdToHtml(d.md) : '',
      blocks: 'blocks' in d ? d.blocks : [],
      createdAt: created,
      updatedAt: created,
    }
    wByKey.set(d.key, w)
    return w
  })
  // Chloe's welcome session is a one-off, not a library template
  const welcome = wByKey.get('welcome')!

  // programs (templates)
  const pByKey = new Map<string, Program>()
  const programs: Program[] = PROGRAMS.map((d, i) => {
    const created = stamp(addDays(t, -100 + i * 5), 11)
    const p: Program = {
      id: `p-${d.key}`,
      name: d.name,
      description: d.description,
      goal: d.goal,
      daysPerWeek: d.pattern.filter(Boolean).length,
      status: 'active',
      weeks: Array.from({ length: d.weeks }, (_, wi) => {
        const pat = d.alt && wi % 2 === 1 ? d.alt : d.pattern
        return { id: uid('wk-'), days: pat.map((k) => ({ workoutId: k ? `w-${k}` : null })) }
      }),
      createdAt: created,
      updatedAt: created,
    }
    pByKey.set(d.key, p)
    return p
  })

  const clients: Client[] = []
  const sessions: ScheduledSession[] = []
  const completions: WorkoutCompletion[] = []
  const progress: ProgressEntry[] = []
  const notes: TrainerNote[] = []
  const messages: Message[] = []

  for (const c of CLIENTS) {
    const client: Client = {
      id: `c-${c.key}`,
      name: c.name,
      email: c.email,
      phone: c.phone,
      goal: c.goal,
      experience: c.experience,
      notes: c.notes,
      color: c.color,
      status: c.key === 'ben' ? 'archived' : 'active',
      createdAt: stamp(addDays(t, -c.joinedDaysAgo), 10),
    }
    clients.push(client)

    // program + sessions
    if (c.program) {
      const template = pByKey.get(c.program)!
      const start = addDays(thisMonday, -7 * c.startedWeeksAgo)
      const copy = makeClientCopy(template, workouts, client.id, start)
      if (c.key === 'liam') {
        // Liam's personal tweak: Saturday conditioning in every week
        const ath = workouts.find((w) => w.id === 'w-athletic')!
        const athCopy = { ...ath, id: uid('w-'), clientId: client.id, sourceId: ath.id }
        copy.workouts.push(athCopy)
        copy.program.weeks.forEach((w) => (w.days[5] = { workoutId: athCopy.id, note: 'Pre-season conditioning' }))
        copy.program.daysPerWeek = 5
        copy.program.name = 'Upper / Lower + Conditioning'
      }
      workouts.push(...copy.workouts)
      programs.push(copy.program)

      const all = generateSessions(copy.program, start)
      const past = all.filter((s) => s.date < t)
      const forcedMiss = new Set(c.recentMisses ? past.slice(-c.recentMisses).map((s) => s.id) : [])
      // per-workout session counter to drive weight progression
      const seen = new Map<ID, number>()
      for (const s of all) {
        if (s.date < t) {
          const done = !forcedMiss.has(s.id) && rand() < c.adherence
          if (done) {
            const w = workouts.find((x) => x.id === s.workoutId)!
            const n = seen.get(w.id) ?? 0
            seen.set(w.id, n + 1)
            const comp = buildCompletion(w, s, client.id, n, rand)
            completions.push(comp)
            s.status = 'completed'
            s.completionId = comp.id
          }
        }
        sessions.push(s)
      }
    }

    // body weight — weekly entries for the last ~8 weeks (or since joining)
    if (c.key !== 'ben') {
      const weeks = Math.min(8, Math.floor(c.joinedDaysAgo / 7))
      for (let i = weeks; i >= 0; i--) {
        const date = addDays(t, -i * 7 - 1)
        const wobble = (rand() - 0.5) * 0.5
        const weight = +(c.startWeight + (weeks - i) * c.weeklyWeightChange + wobble).toFixed(1)
        const entry: ProgressEntry = { id: uid('pe-'), clientId: client.id, date, weight }
        if (i % 4 === 0 && (c.key === 'olivia' || c.key === 'jake' || c.key === 'mia' || c.key === 'emma')) {
          const base = c.key === 'jake' ? { chest: 102, waist: 82, arm: 36 } : c.key === 'olivia' ? { waist: 92, hips: 108 } : { waist: 72, hips: 96 }
          const k = weeks - i
          entry.measurements = Object.fromEntries(
            Object.entries(base).map(([key, v]) => [key, +(v + k * (c.weeklyWeightChange < 0 ? -0.35 : c.key === 'jake' && key !== 'waist' ? 0.2 : -0.1)).toFixed(1)]),
          )
        }
        if (c.key === 'mia' && i === 0) {
          entry.date = addDays(t, -1)
          entry.checkIn = true
          entry.reviewed = false
          entry.note = 'Back stiffness is about a 2/10 now (was 6/10). Sleeping better too. Would love to try a reformer class on Fridays.'
        }
        if (c.key === 'olivia' && i === 0) {
          entry.checkIn = true
          entry.reviewed = true
          entry.note = 'Tough fortnight with the kids being sick, but still walking most days.'
        }
        progress.push(entry)
      }
    }

    for (const [daysAgo, text] of TRAINER_NOTES[c.key] ?? []) {
      const date = addDays(t, -daysAgo)
      notes.push({ id: uid('n-'), clientId: client.id, date, text, updatedAt: stamp(date, 13) })
    }

    const msgs = MESSAGES[c.key] ?? []
    msgs.forEach(([daysAgo, hour, from, text], i) => {
      const isLast = i === msgs.length - 1
      messages.push({
        id: uid('m-'),
        clientId: client.id,
        from,
        text,
        sentAt: stamp(addDays(t, -daysAgo), hour, 10 + i),
        // the latest client messages for Emma, Mia and Liam are still unread by the trainer
        read: !(from === 'client' && isLast && ['emma', 'mia', 'liam'].includes(c.key)),
      })
    })
  }

  // one-off sessions & appointments so today always has something on
  const chloe = 'c-chloe'
  const welcomeCopy: Workout = { ...welcome, id: uid('w-'), clientId: chloe, sourceId: welcome.id }
  workouts.push(welcomeCopy)
  sessions.push({ id: uid('s-'), clientId: chloe, date: t, kind: 'workout', workoutId: welcomeCopy.id, status: 'scheduled' })

  const appts: [string, number, string, string][] = [
    ['c-emma', 0, '07:00', 'PT session'],
    ['c-daniel', 0, '17:30', 'PT session — deadlift technique'],
    ['c-chloe', 2, '09:30', 'PT session'],
    ['c-sophie', 1, '16:00', 'PT session'],
    ['c-emma', 7, '07:00', 'PT session'],
    ['c-olivia', 3, '18:30', 'Check-in call'],
    ['c-daniel', -7, '17:30', 'PT session'],
    ['c-emma', -7, '07:00', 'PT session'],
    ['c-sophie', -6, '16:00', 'PT session'],
    ['c-mia', 4, '12:00', 'Mobility assessment'],
  ]
  for (const [clientId, offset, time, title] of appts) {
    sessions.push({ id: uid('s-'), clientId, date: addDays(t, offset), kind: 'appointment', title, time, status: 'scheduled' })
  }

  return {
    version: DATA_VERSION,
    seededOn: t,
    trainer: { name: 'Casey', business: 'Muscle Up Strength & Conditioning' },
    clients,
    workouts,
    programs,
    sessions,
    completions,
    progress,
    notes,
    messages,
    customExercises: [],
    favouriteExerciseIds: ['ex-goblet-squat', 'ex-barbell-hip-thrust', 'ex-dead-bug', 'ex-kettlebell-swing', 'ex-romanian-deadlift'],
  }
}

/** Plausible logged results for a structured workout; written workouts get a note. */
function buildCompletion(w: Workout, s: ScheduledSession, clientId: ID, n: number, rand: () => number): WorkoutCompletion {
  const results: ExerciseResult[] = []
  if (w.mode === 'build') {
    for (const b of w.blocks) {
      const items = b.type === 'exercise' ? [b] : b.type === 'group' ? b.items : []
      const rounds = b.type === 'group' ? b.rounds : undefined
      for (const it of items) {
        const count = setCount(it, rounds)
        const base = parseFloat(it.weight ?? '')
        const inc = base >= 60 ? 2.5 : base >= 20 ? 2 : 1
        const weight = Number.isFinite(base) ? String(Math.max(0, base - 2 * inc + n * inc)) : undefined
        const reps = /^\d+$/.test(it.reps ?? '') ? it.reps : undefined
        results.push({
          itemId: it.id,
          exerciseId: it.exerciseId,
          name: it.name,
          sets: Array.from({ length: count }, (_, k) => ({
            done: true,
            weight,
            reps: reps ? String(Math.max(1, +reps - (k === count - 1 && rand() < 0.3 ? 1 : 0))) : it.reps,
          })),
        })
      }
    }
  }
  const notesPool = ['Felt strong today', 'Bit tired but got it done', 'Loved this one!', 'Harder than last week', '', '', '']
  return {
    id: uid('wc-'),
    clientId,
    sessionId: s.id,
    workoutId: w.id,
    workoutName: w.name,
    date: s.date,
    completedAt: stamp(s.date, 6 + Math.floor(rand() * 12), Math.floor(rand() * 59)),
    notes: notesPool[Math.floor(rand() * notesPool.length)] || undefined,
    feeling: 3 + Math.floor(rand() * 3),
    results,
    by: 'client',
  }
}

