import { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { ChatThread } from '../../components/Chat'
import { Avatar } from '../../components/ui/misc'

export function ClientMessages() {
  const clientId = useStore((s) => s.demoClientId)
  const all = useStore((s) => s.messages)
  const trainer = useStore((s) => s.trainer)
  const sendMessage = useStore((s) => s.sendMessage)
  const markRead = useStore((s) => s.markRead)
  const messages = all.filter((m) => m.clientId === clientId).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
  const unread = messages.some((m) => m.from === 'trainer' && !m.read)
  useEffect(() => { if (unread) markRead(clientId, 'client') }, [unread, clientId, markRead])

  return (
    <div className="flex h-[calc(100dvh-44px-64px)] sm:h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3.5">
        <Avatar name={trainer.name} size={38} />
        <div><p className="font-semibold">{trainer.name}</p><p className="text-xs text-muted">Your trainer</p></div>
      </div>
      <ChatThread className="flex-1" messages={messages} me="client" otherName={trainer.name.split(' ')[0]} onSend={(t) => sendMessage(clientId, 'client', t)} />
    </div>
  )
}
