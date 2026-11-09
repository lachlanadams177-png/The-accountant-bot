import { useState } from 'react'
import { RotateCcw, Database, Info } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { toast } from '../../components/ui/toast'
import { useResetDemo } from '../../layouts/TrainerLayout'

export function SettingsPage() {
  const trainer = useStore((s) => s.trainer)
  const updateTrainer = useStore((s) => s.updateTrainer)
  const st = useStore()
  const counts = { c: st.clients.length, w: st.workouts.length, p: st.programs.length, s: st.sessions.length }
  const [name, setName] = useState(trainer.name)
  const [business, setBusiness] = useState(trainer.business)
  const reset = useResetDemo()
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <Card className="p-5">
        <h2 className="font-semibold">Your profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Business name" optional value={business} onChange={(e) => setBusiness(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end"><Button variant="primary" disabled={!name.trim()} onClick={() => { updateTrainer({ name: name.trim(), business: business.trim() }); toast.success('Profile saved') }}>Save</Button></div>
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><Database size={17} className="text-brand-600" /> Demo data</h2>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">Everything in this demo is saved in this browser’s local storage — nothing is sent to a server. Right now there are {counts.c} clients, {counts.w} workouts (including client copies), {counts.p} programs and {counts.s} calendar sessions.</p>
        <p className="mt-2 flex gap-2 text-sm text-muted"><Info size={15} className="mt-0.5 shrink-0" /> Using a different browser or clearing site data starts fresh with the example data.</p>
        <div className="mt-4 flex justify-end"><Button variant="danger" icon={RotateCcw} onClick={reset}>Reset Demo Data</Button></div>
      </Card>
    </div>
  )
}
