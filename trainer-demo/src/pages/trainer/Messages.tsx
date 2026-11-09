import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useActiveClients } from '../../store/hooks'
import { Avatar, Card, EmptyState, PageHeader } from '../../components/ui/misc'
import { ChatThread } from '../../components/Chat'
import { conversations } from '../../lib/stats'
import { timeAgo } from '../../lib/date'
import { cn } from '../../lib/cn'

export function MessagesPage() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const clients = useActiveClients()
  const messages = useStore((s) => s.messages)
  const sendMessage = useStore((s) => s.sendMessage)
  const markRead = useStore((s) => s.markRead)
  const [q, setQ] = useState('')
  const convos = useMemo(() => conversations(messages, clients).sort((a, b) => (b.last?.sentAt ?? '').localeCompare(a.last?.sentAt ?? '')), [messages, clients])
  const shown = convos.filter((c) => !q.trim() || clients.find((x) => x.id === c.clientId)?.name.toLowerCase().includes(q.toLowerCase()))
  const current = convos.find((c) => c.clientId === clientId)
  const client = clients.find((c) => c.id === clientId)

  useEffect(() => { if (clientId && current?.unreadForTrainer) markRead(clientId, 'trainer') }, [clientId, current?.unreadForTrainer, markRead])

  return (
    <div>
      <PageHeader title="Messages" subtitle="Simple one-to-one chat with each client" />
      <Card className="grid md:grid-cols-[300px_1fr] overflow-hidden h-[calc(100vh-280px)] min-h-[480px]">
        <div className={cn('flex flex-col border-r border-line min-h-0', clientId && 'hidden md:flex')}>
          <div className="p-3 border-b border-line">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" aria-label="Find a client" className="h-9 w-full rounded-lg border border-line pl-8 pr-3 text-sm focus:outline-none focus:border-brand-400" />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {shown.map((c) => {
              const cl = clients.find((x) => x.id === c.clientId)!
              return (
                <li key={c.clientId}>
                  <Link to={`/messages/${c.clientId}`} className={cn('flex items-center gap-3 px-3 py-3 border-l-2', c.clientId === clientId ? 'bg-brand-50 border-brand-500' : 'border-transparent hover:bg-neutral-50')}>
                    <Avatar name={cl.name} color={cl.color} size={38} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2"><span className={cn('text-sm truncate', c.unreadForTrainer ? 'font-semibold' : 'font-medium')}>{cl.name}</span>{c.last && <span className="text-[11px] text-muted shrink-0">{timeAgo(c.last.sentAt)}</span>}</span>
                      <span className={cn('block text-[13px] truncate', c.unreadForTrainer ? 'text-ink' : 'text-muted')}>{c.last ? `${c.last.from === 'trainer' ? 'You: ' : ''}${c.last.text}` : 'No messages yet'}</span>
                    </span>
                    {c.unreadForTrainer > 0 && <span className="h-5 min-w-5 rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white inline-flex items-center justify-center">{c.unreadForTrainer}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
        <div className={cn('flex flex-col min-h-0 bg-canvas/60', !clientId && 'hidden md:flex')}>
          {client && current ? (
            <>
              <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
                <button className="md:hidden p-1 -ml-1" aria-label="Back to conversations" onClick={() => navigate('/messages')}><ArrowLeft size={18} /></button>
                <Avatar name={client.name} color={client.color} size={34} />
                <Link to={`/clients/${client.id}`} className="font-semibold hover:underline">{client.name}</Link>
              </div>
              <ChatThread className="flex-1" messages={current.messages} me="trainer" otherName={client.name.split(' ')[0]} onSend={(t) => sendMessage(client.id, 'trainer', t)} />
            </>
          ) : <EmptyState icon={MessageCircle} title="Choose a conversation" text="Pick a client on the left to read and reply." className="m-auto" />}
        </div>
      </Card>
    </div>
  )
}
