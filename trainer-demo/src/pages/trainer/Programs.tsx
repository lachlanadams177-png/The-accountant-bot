import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, ClipboardList, Copy, FilePlus2, LayoutList, MoreHorizontal, PenLine, Plus, Search, Send, Trash2, Users, Eye } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useLibraryWorkouts } from '../../store/hooks'
import { Button } from '../../components/ui/Button'
import { Badge, Card, EmptyState, Menu, PageHeader, Segmented } from '../../components/ui/misc'
import { AssignProgramModal, AssignWorkoutModal } from '../../components/AssignDialogs'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import { sessionsPerWeek } from '../../lib/programs'
import { workoutSummary, countExercises } from '../../lib/workout'
import { timeAgo } from '../../lib/date'

export function ProgramsPage({ tab }: { tab: 'programs' | 'workouts' }) {
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader
        title={tab === 'programs' ? 'Programs' : 'Workouts'}
        subtitle={tab === 'programs' ? 'Multi-week plans you can assign to clients' : 'Your reusable workout library'}
        actions={
          <>
            <Segmented value={tab} onChange={(v) => navigate(v === 'programs' ? '/programs' : '/workouts')} options={[{ value: 'programs', label: 'Programs' }, { value: 'workouts', label: 'Workouts' }]} />
            {tab === 'programs'
              ? <Button variant="primary" icon={Plus} onClick={() => navigate('/programs/new')}>Create program</Button>
              : <Button variant="primary" icon={FilePlus2} onClick={() => navigate('/workouts/new')}>Create workout</Button>}
          </>
        }
      />
      {tab === 'programs' ? <ProgramLibrary /> : <WorkoutLibrary />}
    </div>
  )
}

function ProgramLibrary() {
  const { programs, clients, duplicateProgram, setProgramStatus } = useStore()
  const navigate = useNavigate()
  const [showArchived, setShowArchived] = useState(false)
  const [assignId, setAssignId] = useState<string | undefined>()
  const activeClientIds = new Set(clients.filter((c) => c.status === 'active').map((c) => c.id))
  const templates = programs.filter((p) => !p.clientId && (showArchived ? p.status === 'archived' : p.status === 'active'))
  const assignedCount = (id: string) => programs.filter((p) => p.sourceId === id && p.status === 'active' && activeClientIds.has(p.clientId!)).length
  const archivedCount = programs.filter((p) => !p.clientId && p.status === 'archived').length

  return (
    <>
      {archivedCount > 0 && (
        <div className="mb-4">
          <Segmented size="sm" value={showArchived ? 'a' : 'c'} onChange={(v) => setShowArchived(v === 'a')} options={[{ value: 'c', label: 'Current' }, { value: 'a', label: `Archived · ${archivedCount}` }]} />
        </div>
      )}
      {templates.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title={showArchived ? 'No archived programs' : 'No programs yet'} text={showArchived ? undefined : 'Create a program once, then assign it to as many clients as you like.'} action={!showArchived && <Button variant="primary" icon={Plus} onClick={() => navigate('/programs/new')}>Create program</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((p) => {
            const n = assignedCount(p.id)
            return (
              <Card key={p.id} className="group relative flex flex-col p-5 hover:shadow-lift hover:border-line-strong transition-all">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/programs/${p.id}`} className="after:absolute after:inset-0"><h3 className="text-[17px] font-semibold tracking-tight leading-snug">{p.name}</h3></Link>
                  <div className="relative z-10 -mr-2 -mt-1">
                    <Menu
                      trigger={(t) => <button {...t} aria-label={`Actions for ${p.name}`} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-black/5"><MoreHorizontal size={18} /></button>}
                      items={p.status === 'archived' ? [
                        { label: 'Restore', icon: ArchiveRestore, onClick: () => { setProgramStatus(p.id, 'active'); toast.success('Program restored') } },
                      ] : [
                        { label: 'View & edit', icon: Eye, onClick: () => navigate(`/programs/${p.id}`) },
                        { label: 'Assign to clients', icon: Send, onClick: () => setAssignId(p.id) },
                        { label: 'Duplicate', icon: Copy, onClick: () => { const c = duplicateProgram(p.id); if (c) toast.success(`Created “${c.name}”`, { label: 'Open', onClick: () => navigate(`/programs/${c.id}`) }) } },
                        'divider',
                        { label: 'Archive', icon: Archive, danger: true, onClick: async () => { if (await confirm({ title: `Archive “${p.name}”?`, message: 'It’s hidden from your library. Clients already on it keep their own copy.', confirmLabel: 'Archive', danger: true })) { setProgramStatus(p.id, 'archived'); toast.success('Program archived') } } },
                      ]}
                    />
                  </div>
                </div>
                {p.description && <p className="mt-1.5 text-sm text-muted line-clamp-2">{p.description}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge>{p.weeks.length} week{p.weeks.length === 1 ? '' : 's'}</Badge>
                  <Badge>{sessionsPerWeek(p)} sessions / week</Badge>
                  {p.goal && <Badge tone="brand">{p.goal}</Badge>}
                </div>
                <div className="mt-auto pt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><Users size={15} className="text-muted" /> {n} client{n === 1 ? '' : 's'}</span>
                  {p.status === 'active' && <Button size="sm" className="relative z-10" icon={Send} onClick={() => setAssignId(p.id)}>Assign</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <AssignProgramModal open={!!assignId} programId={assignId} onClose={() => setAssignId(undefined)} />
    </>
  )
}

function WorkoutLibrary() {
  const workouts = useLibraryWorkouts()
  const { duplicateWorkout, deleteWorkout, programs } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'write' | 'build'>('all')
  const [assignId, setAssignId] = useState<string | undefined>()
  const rows = useMemo(() => workouts.filter((w) => (kind === 'all' || w.mode === kind) && (!q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [workouts, q, kind])

  const remove = async (id: string, name: string) => {
    const used = programs.filter((p) => !p.clientId && p.weeks.some((w) => w.days.some((d) => d.workoutId === id))).length
    if (await confirm({ title: `Delete “${name}”?`, message: `${used ? `It’s used in ${used} program${used > 1 ? 's' : ''} — those days will become rest days. ` : ''}Clients who already have a copy keep theirs. This can’t be undone.`, confirmLabel: 'Delete', danger: true })) {
      deleteWorkout(id)
      toast.success('Workout deleted')
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workouts" aria-label="Search workouts" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </div>
        <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'write', label: 'Quick Write' }, { value: 'build', label: 'Structured' }]} />
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={FilePlus2} title={q ? 'No workouts match' : 'No workouts yet'} text={q ? undefined : 'Create your first workout.'} action={!q && <Button variant="primary" icon={FilePlus2} onClick={() => navigate('/workouts/new')}>Create workout</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((w) => (
            <Card key={w.id} className="relative flex flex-col p-4 hover:shadow-lift hover:border-line-strong transition-all">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{w.mode === 'write' ? <PenLine size={17} /> : <LayoutList size={17} />}</span>
                <div className="flex-1 min-w-0">
                  <Link to={`/workouts/${w.id}`} className="after:absolute after:inset-0"><h3 className="font-semibold leading-snug">{w.name}</h3></Link>
                  <p className="text-xs text-muted">{w.mode === 'write' ? 'Quick Write' : `${countExercises(w)} exercises`} · edited {timeAgo(w.updatedAt)}</p>
                </div>
                <div className="relative z-10 -mr-1">
                  <Menu
                    trigger={(t) => <button {...t} aria-label={`Actions for ${w.name}`} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:bg-black/5"><MoreHorizontal size={18} /></button>}
                    items={[
                      { label: 'Edit', icon: PenLine, onClick: () => navigate(`/workouts/${w.id}`) },
                      { label: 'Assign to client', icon: Send, onClick: () => setAssignId(w.id) },
                      { label: 'Duplicate', icon: Copy, onClick: () => { const c = duplicateWorkout(w.id); if (c) toast.success(`Created “${c.name}”`, { label: 'Open', onClick: () => navigate(`/workouts/${c.id}`) }) } },
                      'divider',
                      { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(w.id, w.name) },
                    ]}
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-soft line-clamp-2">{workoutSummary(w)}</p>
            </Card>
          ))}
        </div>
      )}
      <AssignWorkoutModal open={!!assignId} workoutId={assignId} onClose={() => setAssignId(undefined)} />
    </>
  )
}
