import { create } from 'zustand'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { uid } from '../../lib/id'

type Tone = 'success' | 'info' | 'error'
interface Toast { id: string; text: string; tone: Tone; action?: { label: string; onClick: () => void } }

const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: string) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.action ? 6000 : 3200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  success: (text: string, action?: Toast['action']) => useToasts.getState().push({ text, tone: 'success', action }),
  info: (text: string, action?: Toast['action']) => useToasts.getState().push({ text, tone: 'info', action }),
  error: (text: string) => useToasts.getState().push({ text, tone: 'error' }),
}

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 sm:bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info
        return (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink text-white pl-3.5 pr-2 py-2.5 shadow-pop animate-rise text-sm max-w-md">
            <Icon size={18} className={t.tone === 'success' ? 'text-sage-300' : t.tone === 'error' ? 'text-red-300' : 'text-sky-300'} />
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button className="font-semibold text-sage-200 hover:text-white px-2" onClick={() => { t.action!.onClick(); dismiss(t.id) }}>
                {t.action.label}
              </button>
            )}
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="p-1 rounded-md text-white/60 hover:text-white">
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
