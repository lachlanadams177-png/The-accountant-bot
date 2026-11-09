import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, ClipboardList, MoreHorizontal, Pencil, Search, UserPlus, Users, Copy } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/ui'
import { Avatar, Badge, Card, EmptyState, Menu, PageHeader, ProgressBar, Segmented } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { ClientFormModal } from '../../components/ClientForm'
import { AssignProgramModal } from '../../components/AssignDialogs'
import { confirm } from '../../components/ui/confirm'
import { toast } from '../../components/ui/toast'
import { activeProgram, lastCompletion, weekStats } from '../../lib/stats'
import { relDay } from '../../lib/date'
import type { Client } from '../../types'

export function ClientsPage() {
  const { clients, programs, sessions, completions, setClientStatus, saveProgramAsTemplate } = useStore()
  const setAddOpen = useUi((s) => s.setAddClientOpen)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'active' | 'archived'>('active')
  const [editing, setEditing] = useState<Client | undefined>()
  const [assignFor, setAssignFor] = useState<string | undefined>()

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return clients
      .filter((c) => c.status === filter)
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.goal?.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ c, program: activeProgram(programs, c.id), last: lastCompletion(completions, c.id), week: weekStats(sessions, c.id) }))
  }, [clients, programs, sessions, completions, q, filter])

  const counts = { active: clients.filter((c) => c.status === 'active').length, archived: clients.filter((c) => c.status === 'archived').length }

  const archive = async (c: Client) => {
    if (await confirm({ title: `Archive ${c.name}?`, message: 'They’ll move to Archived and their upcoming sessions will be removed. Their history stays, and you can restore them any time.', confirmLabel: 'Archive client', danger: true })) {
      setClientStatus(c.id, 'archived')
      toast.success(`${c.name} archived`, { label: 'Undo', onClick: () => setClientStatus(c.id, 'active') })
    }
  }

  const duplicateProgram = (programId: string) => {
    const tpl = saveProgramAsTemplate(programId)
    if (tpl) { toast.success('Program copied to your library'); navigate(`/programs/${tpl.id}`) }
  }

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${counts.active} active client${counts.active === 1 ? '' : 's'}`} actions={<Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>Add client</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or goal" aria-label="Search clients" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </div>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'active', label: `Active · ${counts.active}` }, { value: 'archived', label: `Archived · ${counts.archived}` }]} />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={q ? 'No clients match your search' : filter === 'active' ? 'No clients yet' : 'No archived clients'}
            text={filter === 'active' && !q ? 'Add your first client to get started.' : undefined}
            action={filter === 'active' && !q && <Button variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>Add client</Button>} />
        ) : (
          <>
            {/* table header (desktop) */}
            <div className="hidden md:grid grid-cols-[2fr_1.6fr_1fr_1.1fr_auto] gap-4 border-b border-line px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">
              <span>Client</span><span>Current program</span><span>Last workout</span><span>This week</span><span className="w-9" />
            </div>
            <ul className="divide-y divide-line/70">
              {rows.map(({ c, program, last, week }) => (
                <li key={c.id} className="relative grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1.6fr_1fr_1.1fr_auto] items-center gap-x-4 gap-y-2 px-4 md:px-5 py-3.5 hover:bg-neutral-50/70 transition-colors">
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-3 min-w-0 after:absolute after:inset-0">
                    <Avatar name={c.name} color={c.color} size={40} />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-[13px] text-muted truncate">{c.goal ?? 'No goal set'}</span>
                    </span>
                  </Link>
                  <div className="hidden md:block min-w-0 text-sm">
                    {program ? <span className="truncate block">{program.name}</span> : <span className="text-muted">No program</span>}
                  </div>
                  <div className="hidden md:block text-sm text-ink-soft">{last ? relDay(last.date) : <span className="text-muted">—</span>}</div>
                  <div className="hidden md:block">
                    {week.scheduled ? (
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={week.pct} className="w-20" />
                        <span className="text-[13px] text-ink-soft tabular-nums">{week.completed}/{week.scheduled}</span>
                      </div>
                    ) : <span className="text-[13px] text-muted">Nothing scheduled</span>}
                  </div>
                  <div className="relative z-10 flex items-center gap-2">
                    {c.status === 'archived' && <Badge>Archived</Badge>}
                    <Menu
                      trigger={(p) => <button {...p} aria-label={`Actions for ${c.name}`} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-ink"><MoreHorizontal size={18} /></button>}
                      items={c.status === 'active' ? [
                        { label: 'Edit details', icon: Pencil, onClick: () => setEditing(c) },
                        { label: program ? 'Change program' : 'Assign program', icon: ClipboardList, onClick: () => setAssignFor(c.id) },
                        ...(program ? [{ label: 'Copy their program to library', icon: Copy, onClick: () => duplicateProgram(program.id) }] : []),
                        'divider' as const,
                        { label: 'Archive client', icon: Archive, onClick: () => archive(c), danger: true },
                      ] : [
                        { label: 'Restore client', icon: ArchiveRestore, onClick: () => { setClientStatus(c.id, 'active'); toast.success(`${c.name} restored`) } },
                      ]}
                    />
                  </div>
                  {/* compact mobile meta */}
                  <div className="md:hidden col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[52px] text-[13px] text-muted">
                    <span>{program?.name ?? 'No program'}</span>
                    {week.scheduled > 0 && <span>{week.completed}/{week.scheduled} this week</span>}
                    {last && <span>Last: {relDay(last.date)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ClientFormModal open={!!editing} client={editing} onClose={() => setEditing(undefined)} />
      <AssignProgramModal open={!!assignFor} clientId={assignFor} onClose={() => setAssignFor(undefined)} />
    </div>
  )
}
