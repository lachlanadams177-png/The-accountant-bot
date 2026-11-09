import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select, Textarea } from './ui/Field'
import { toast } from './ui/toast'
import { useStore } from '../store/useStore'
import { useUi } from '../store/ui'
import type { Client, ExperienceLevel } from '../types'

type FormState = { name: string; email: string; phone: string; goal: string; experience: '' | ExperienceLevel; notes: string }
const blank: FormState = { name: '', email: '', phone: '', goal: '', experience: '', notes: '' }

export function ClientFormModal({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client }) {
  const addClient = useStore((s) => s.addClient)
  const updateClient = useStore((s) => s.updateClient)
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>(blank)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setF(client ? { name: client.name, email: client.email ?? '', phone: client.phone ?? '', goal: client.goal ?? '', experience: client.experience ?? '', notes: client.notes ?? '' } : blank)
  }, [open, client])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }))
    if (k === 'name') setError('')
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!f.name.trim()) return setError('Please enter a name.')
    const data = {
      name: f.name.trim(),
      email: f.email.trim() || undefined,
      phone: f.phone.trim() || undefined,
      goal: f.goal.trim() || undefined,
      experience: f.experience || undefined,
      notes: f.notes.trim() || undefined,
    }
    if (client) {
      updateClient(client.id, data)
      toast.success('Client details saved')
      onClose()
    } else {
      const c = addClient(data)
      toast.success(`${c.name} added`)
      onClose()
      navigate(`/clients/${c.id}`)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Edit client' : 'Add a client'}
      description={client ? undefined : 'Only a name is needed. You can fill in the rest any time.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>{client ? 'Save changes' : 'Add client'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Name" placeholder="e.g. Emma Wilson" value={f.name} onChange={set('name')} aria-invalid={!!error} autoComplete="off" />
          {error && <p role="alert" className="mt-1.5 text-sm text-miss">{error}</p>}
        </div>
        <Input label="Email" optional type="email" value={f.email} onChange={set('email')} autoComplete="off" />
        <Input label="Phone" optional type="tel" value={f.phone} onChange={set('phone')} autoComplete="off" />
        <div className="sm:col-span-2"><Input label="Fitness goal" optional placeholder="e.g. Get stronger for netball season" value={f.goal} onChange={set('goal')} /></div>
        <Select label="Experience" optional value={f.experience} onChange={set('experience')}>
          <option value="">Not sure yet</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </Select>
        <div className="sm:col-span-2">
          <Textarea label="Notes" optional placeholder="Injuries, preferences, availability…" value={f.notes} onChange={set('notes')} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/** Global "Add client" dialog, opened from anywhere via useUi. */
export function GlobalAddClient() {
  const open = useUi((s) => s.addClientOpen)
  const setOpen = useUi((s) => s.setAddClientOpen)
  return <ClientFormModal open={open} onClose={() => setOpen(false)} />
}
