import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const inputCls =
  'w-full h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/80 transition-colors hover:border-line-strong focus:border-sage-400 focus:outline-none focus:ring-4 focus:ring-sage-100'

export function Field({ label, hint, children, optional, className, htmlFor }: { label: string; hint?: string; children: ReactNode; optional?: boolean; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-soft">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; optional?: boolean; hint?: string }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, optional, hint, className, id, ...rest }, ref) {
  const auto = useId()
  const el = <input ref={ref} id={id ?? auto} className={cn(inputCls, className)} {...rest} />
  if (!label) return el
  return <Field label={label} optional={optional} hint={hint} htmlFor={id ?? auto}>{el}</Field>
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; optional?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, optional, className, id, ...rest }, ref) {
  const auto = useId()
  const el = <textarea ref={ref} id={id ?? auto} className={cn(inputCls, 'h-auto min-h-[88px] py-2.5 leading-relaxed resize-y', className)} {...rest} />
  if (!label) return el
  return <Field label={label} optional={optional} htmlFor={id ?? auto}>{el}</Field>
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; optional?: boolean }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, optional, className, id, children, ...rest }, ref) {
  const auto = useId()
  const el = (
    <select ref={ref} id={id ?? auto} className={cn(inputCls, 'appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%237a817c%27 stroke-width=%272.5%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-no-repeat bg-[right_0.75rem_center] pr-9', className)} {...rest}>
      {children}
    </select>
  )
  if (!label) return el
  return <Field label={label} optional={optional} htmlFor={id ?? auto}>{el}</Field>
})
