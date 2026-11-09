import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Field'
import { toast } from './ui/toast'
import { RichEditor } from './RichEditor'
import { useUi } from '../store/ui'
import { useStore } from '../store/useStore'
import { useActiveClients, useLibraryWorkouts } from '../store/hooks'
import { fmtDay, today } from '../lib/date'
import { blocksToHtml, isHtmlEmpty } from '../lib/workout'
import { uid } from '../lib/id'

const DRAFT_KEY = 'fernly-draft:quick-session'

/**
 * The fastest path in the app: pick a client, pick a day, type, save.
 * Text is autosaved locally so closing the dialog never loses it.
 */
export function QuickSessionModal() {
  const prefill = useUi((s) => s.quickSession)
  const close = useUi((s) => s.closeQuickSession)
  const clients = useActiveClients()
  const library = useLibraryWorkouts()
  const saveWorkout = useStore((s) => s.saveWorkout)
  const scheduleWorkout = useStore((s) => s.scheduleWorkout)
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name.split(' ')[0] ?? ''

  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(today())
  const [name, setName] = useState('')
  const [html, setHtml] = useState('')
  const [asTemplate, setAsTemplate] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!prefill) return
    let draft: { html?: string; name?: string } = {}
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') } catch { /* ignore */ }
    setClientId(prefill.clientId ?? '')
    setDate(prefill.date ?? today())
    setName(prefill.name ?? draft.name ?? '')
    setHtml(prefill.html ?? draft.html ?? '')
    setAsTemplate(false)
    setError('')
  }, [prefill])

  useEffect(() => {
    if (!prefill) return
    // written on every change (cheap) so closing the dialog can never lose text
    if (isHtmlEmpty(html) && !name) localStorage.removeItem(DRAFT_KEY)
    else localStorage.setItem(DRAFT_KEY, JSON.stringify({ html, name }))
  }, [html, name, prefill])

  const useTemplate = (id: string) => {
    const w = library.find((x) => x.id === id)
    if (!w) return
    setHtml(w.mode === 'write' ? w.html : blocksToHtml(w.blocks))
    if (!name) setName(w.name)
  }

  const save = () => {
    if (!clientId) return setError('Choose who this session is for.')
    if (isHtmlEmpty(html)) return setError('Type the session instructions first.')
    const now = new Date().toISOString()
    const finalName = name.trim() || `Session — ${fmtDay(date)}`
    const workout = saveWorkout({ id: uid('w-'), name: finalName, mode: 'write', html, blocks: [], clientId, createdAt: now, updatedAt: now })
    scheduleWorkout({ workoutId: workout.id, clientId, date, copy: false })
    if (asTemplate) saveWorkout({ id: uid('w-'), name: finalName, mode: 'write', html, blocks: [], createdAt: now, updatedAt: now })
    localStorage.removeItem(DRAFT_KEY)
    toast.success(`Saved and assigned to ${clientName(clientId)} for ${fmtDay(date)}${asTemplate ? ' · also saved as a template' : ''}`)
    close()
  }

  return (
    <Modal
      open={!!prefill}
      onClose={close}
      size="lg"
      title={<span className="inline-flex items-center gap-2"><Zap size={18} className="text-sage-600" /> Quick Session</span>}
      description="Write a one-off session and send it straight to a client. Your text is saved as you type."
      footer={
        <>
          <label className="mr-auto inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-sage-600" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} />
            Also save as a reusable template
          </label>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save & Assign</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setError('') }}>
          <option value="">Choose a client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        <Input label="Session name" optional placeholder={`Session — ${fmtDay(date)}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-soft">Instructions</span>
        <select
          aria-label="Start from a template"
          className="h-8 rounded-lg border border-line bg-white px-2 text-[13px] text-ink-soft"
          value=""
          onChange={(e) => useTemplate(e.target.value)}
        >
          <option value="">Start from a template…</option>
          {library.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <RichEditor className="mt-2" value={html} onChange={(v) => { setHtml(v); setError('') }} minHeight={220} compact autoFocus placeholder={'Just type the session here…\n\nWarm up\n5 min bike\n\nMain\nSquats — 3 x 10'} />
      {error && <p role="alert" className="mt-3 text-sm text-miss">{error}</p>}
    </Modal>
  )
}
