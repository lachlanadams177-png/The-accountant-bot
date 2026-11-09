import { useEffect, useRef, useState } from 'react'
import { Send, Info } from 'lucide-react'
import type { Message } from '../types'
import { fmtDay, fmtTime, relDay } from '../lib/date'
import { cn } from '../lib/cn'

/** Shared thread view for trainer and client. `me` is who is reading. */
export function ChatThread({ messages, me, onSend, otherName, className }: { messages: Message[]; me: Message['from']; onSend: (t: string) => void; otherName: string; className?: string }) {
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  const send = () => { const t = text.trim(); if (!t) return; onSend(t); setText('') }

  let lastDay = ''
  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <p className="mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-muted"><Info size={12} /> Demo — messages stay on this device and aren’t sent anywhere</p>
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hi to {otherName}!</p>}
        {messages.map((m) => {
          const day = m.sentAt.slice(0, 10)
          const showDay = day !== lastDay
          lastDay = day
          const mine = m.from === me
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs text-muted">{relDay(day) === fmtDay(day) ? fmtDay(day) : relDay(day)}</p>}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-card', mine ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white border border-line/70 rounded-bl-md')}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={cn('mt-0.5 text-[11px]', mine ? 'text-white/70 text-right' : 'text-muted')}>{fmtTime(m.sentAt)}{mine && m.read ? ' · Read' : ''}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-end gap-2 border-t border-line bg-white p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={`Message ${otherName}…`} aria-label="Message"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          className="flex-1 max-h-32 min-h-11 resize-none rounded-xl border border-line px-3.5 py-2.5 text-[15px] focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700"><Send size={18} /></button>
      </form>
    </div>
  )
}
