import { useNavigate } from 'react-router-dom'
import { Smartphone, Monitor } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useActiveClients } from '../store/hooks'
import { cn } from '../lib/cn'

/** Always-visible strip that makes it obvious this is a demo and lets you swap views. */
export function DemoBar() {
  const mode = useStore((s) => s.mode)
  const demoClientId = useStore((s) => s.demoClientId)
  const setMode = useStore((s) => s.setMode)
  const clients = useActiveClients()
  const navigate = useNavigate()

  const toTrainer = () => { setMode('trainer'); navigate('/') }
  const toClient = (id = demoClientId) => {
    const valid = clients.some((c) => c.id === id) ? id : clients[0]?.id
    setMode('client', valid)
    navigate('/client')
  }

  return (
    <div className="sticky top-0 z-40 bg-ink text-white/90 text-[13px]">
      <div className="mx-auto flex h-11 items-center gap-2 sm:gap-3 px-3 sm:px-5">
        <span className="inline-flex items-center gap-2 shrink-0">
          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.2)]" aria-hidden />
          <span className="font-semibold text-white">Demo<span className="hidden sm:inline"> mode</span></span>
          <span className="hidden md:inline text-white/55">· everything is saved in this browser only</span>
        </span>
        <span className="flex-1 min-w-0" />
        <div className="inline-flex items-center rounded-lg bg-white/10 p-0.5" role="tablist" aria-label="Switch view">
          <button role="tab" aria-selected={mode === 'trainer'} onClick={toTrainer} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 font-medium transition-colors', mode === 'trainer' ? 'bg-white text-ink' : 'text-white/75 hover:text-white')}>
            <Monitor size={14} /> Trainer<span className="hidden sm:inline -ml-0.5">view</span>
          </button>
          <button role="tab" aria-selected={mode === 'client'} onClick={() => toClient()} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 font-medium transition-colors', mode === 'client' ? 'bg-white text-ink' : 'text-white/75 hover:text-white')}>
            <Smartphone size={14} /> Client<span className="hidden sm:inline -ml-0.5">view</span>
          </button>
        </div>
        {mode === 'client' && (
          <select
            aria-label="Which client to view as"
            value={demoClientId}
            onChange={(e) => toClient(e.target.value)}
            className="h-8 min-w-0 w-[8.5rem] sm:w-auto rounded-lg bg-white/10 border border-white/15 px-2 text-white text-[13px] [&>option]:text-ink"
          >
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
