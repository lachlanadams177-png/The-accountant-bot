import { create } from 'zustand'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOpts { title: string; message?: string; confirmLabel?: string; danger?: boolean; cancelLabel?: string }
const useConfirmStore = create<{ opts: ConfirmOpts | null; resolve?: (v: boolean) => void }>(() => ({ opts: null }))

/** Promise-based confirmation: `if (await confirm({...})) doIt()` */
export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ opts, resolve }))
}

export function ConfirmHost() {
  const { opts, resolve } = useConfirmStore()
  const done = (v: boolean) => { resolve?.(v); useConfirmStore.setState({ opts: null, resolve: undefined }) }
  return (
    <Modal
      open={!!opts}
      onClose={() => done(false)}
      title={opts?.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => done(false)}>{opts?.cancelLabel ?? 'Cancel'}</Button>
          <Button data-autofocus variant={opts?.danger ? 'danger' : 'primary'} onClick={() => done(true)}>
            {opts?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {opts?.message && <p className="text-sm text-ink-soft leading-relaxed">{opts.message}</p>}
    </Modal>
  )
}
