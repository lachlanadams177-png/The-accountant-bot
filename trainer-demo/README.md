# Muscle up, strength and conditioning — interactive demo

A working, clickable demo of a simpler personal-training platform: a trainer dashboard for
desktop/tablet and a mobile-first client app. It runs entirely on your own computer, with no accounts,
API keys or servers.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd trainer-demo
npm install        # first time only
npm run dev        # starts http://localhost:5173
```

Open **http://localhost:5173** in Chrome, Edge, Safari or Firefox.

Other commands:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build on http://localhost:4173
```

To try the client app on a phone, connect it to the same Wi-Fi as your laptop and open the
"Network" address that `npm run dev` prints, for example `http://192.168.1.20:5173`.

## Using the demo

- The dark **Demo bar** at the top switches between **Trainer view** and **Client view**. In client
  view you choose which client you're "logged in" as.
- **Quick Session** (green button, top left) is the fastest path: pick a client and a day, type, then
  Save & Assign.
- **Profile menu → Settings → Reset Demo Data** puts all the example data back.

## What's in it

| Area | What works |
|---|---|
| Dashboard | Greeting, quick actions, live counts (active clients, workouts scheduled/completed this week, clients needing attention), today's sessions, completed today, unread messages and check-ins, needs-attention list, activity feed. Every number comes from the data. |
| Clients | Search, active/archived filter, add (only a name is required), edit, archive/restore (with undo), assign/change program, copy a client's program into the library. |
| Client profile | **Overview** (details, program, next workout, completion, recent activity) · **Program** (week-by-week grid, customise their copy, change program, add one-off sessions, schedule) · **Progress** (completion, weekly chart, body weight chart + add entries, exercise progression chart, personal bests, measurements, check-ins) · **Notes** (private, dated, editable, never shown to the client). |
| Workouts — Quick Write | Name + a large rich-text editor. Headings, bold, italic, bullet and numbered lists, dividers, undo/redo, Markdown shortcuts, paste. Nothing is forced into fields. Autosaves a local draft while you type, offers to restore it, and asks before you leave with unsaved changes. Start from a template, client preview, save as template, duplicate, delete (with confirmation), assign to client, add to program. |
| Workouts — Structured Builder | Type-to-search exercises (Enter adds), or add any free-text line. Inline sets / reps / weight / rest / tempo / notes, all optional. Section headings and instruction notes between exercises, supersets and circuits, drag-and-drop or arrow-button reordering, duplicate, remove. |
| Text → structured | Optional and explicit: shows a preview of what it found first. The original text is always kept and you can switch back. |
| Programs | Library cards (duration, sessions/week, goal, number of clients) with view, edit, duplicate, assign, archive. Builder: name, description, weeks, days per week, goal; a 7-day grid per week; add an existing workout, write one inline, or open the full editor; drag workouts between days; duplicate day/week; copy Week 1 to all weeks; rest days; day and week notes; assign to several clients at once. |
| Template vs client copy | Assigning always creates a **client-specific copy** of the program *and* of its workouts. Editing a client's copy never touches the master or other clients. Editing the master only affects future assignments. Saving a client's copy re-syncs their upcoming calendar, keeping completed and manually moved sessions. |
| Calendar | Week (default) and month views, Monday-first, Australian dates. Scheduled / completed / missed / appointment styles with icons. Drag to reschedule (with undo), filter by client, add library workouts, PT appointments or free-text sessions. Click a session to mark it complete, reschedule, duplicate, swap the workout, edit it or remove it. |
| Exercises | 209 original exercise records across Strength, Cardio, Bodyweight, Mobility, Functional and Pilates & Core. Instant search, category / muscle / equipment filters, favourites, add/edit/delete custom exercises, link or upload demo media, start a workout from an exercise. |
| Messages | Conversation list with unread badges, threads, and sending from either side. Clearly labelled as local-only. |
| Client app | "Hi Emma!", today's workout with a big Start button, this week's progress, totals, upcoming appointment, message trainer. Workout player: written workouts show the trainer's formatting exactly; structured workouts have tick-off sets with reps/kg inputs prefilled from targets, "last time" results, extra sets, and an optional how-did-it-feel rating and notes. In-progress logging survives a refresh. Progress: weekly chart, check-in form (weight + note, flagged on the trainer dashboard), body weight chart, personal bests, exercise history, timeline. |

## Demo data

8 active fictional clients plus 1 archived, 7 program templates, 22 library workouts (a mix of
Quick Write and structured), 209 exercises, and about 6 weeks of history (completions with logged
weights, body weight entries, measurements, check-ins, trainer notes, messages and PT appointments).
Dates are generated relative to the day you first open the demo, so "today" always has something on.

All names, contact details and data are made up.

### Where it's saved

Everything is stored in your browser's **localStorage** under the key `muscleup-demo`, plus small
draft entries (`muscleup-draft:*`, `muscleup-log:*`). Refreshing keeps your changes. A different browser,
a private window or clearing site data starts again with fresh example data. **Reset Demo Data** in
Settings does the same on purpose.

## Tests

The brief's acceptance tests A–J and a few extra flows are scripted with Playwright:

```bash
npm i -D playwright && npx playwright install chromium   # one-off
npm run dev                                              # in one terminal
node tests/acceptance.cjs ./test-output                  # in another
node tests/extra-flows.cjs ./test-output
```

Each script uses a fresh browser profile, so it doesn't touch your own demo data.

## Code layout

```
src/
  types.ts              data model (Client, Workout, WorkoutBlock, Program, ScheduledSession, …)
  data/exercises.ts     exercise library
  data/seed.ts          generated demo data
  store/useStore.ts     Zustand store and every action, persisted to localStorage
  lib/                  dates (en-AU, Monday-first), program copy/sync logic, stats, text parsing
  components/           UI kit, rich-text editor, structured builder, dialogs, charts, chat
  layouts/              trainer shell (sidebar / bottom nav), client shell, demo bar
  pages/trainer/        Dashboard, Clients, ClientProfile, Programs, ProgramBuilder, WorkoutEditor, …
  pages/client/         ClientHome, ClientWorkouts, WorkoutPlayer, ClientProgress, ClientMessages
```

The store's actions are the seam for a future backend: each one maps naturally onto an API call,
and the data types are plain JSON.

## Known limitations

- Single trainer, single browser. There's no real login, sync or multi-device support, and messages
  don't send anywhere.
- Uploaded exercise images are stored in localStorage, so they're limited to about 1.5 MB each and the
  total browser quota of about 5 MB.
- Exercises have text descriptions only; no demonstration videos are bundled.
- On touch screens, calendar sessions are dragged with a long-press and program/builder items by their
  grip handle. The structured builder also has arrow buttons and keyboard reordering.
- One workout per program day. Several clients can each have one active program at a time.
- No recurring appointments, reminders, nutrition, payments or integrations (deliberately out of scope).
