import { useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, GripVertical, Heading, Layers, Repeat, StickyNote, Trash2, Ungroup, Dumbbell,
} from 'lucide-react'
import type { ExerciseItem, WorkoutBlock } from '../types'
import { uid } from '../lib/id'
import { cn } from '../lib/cn'
import { ExerciseSearch } from './ExerciseSearch'
import { IconButton } from './ui/Button'
import { EmptyState } from './ui/misc'

type Group = Extract<WorkoutBlock, { type: 'group' }>

const cellBase = 'h-9 rounded-lg border border-transparent bg-neutral-100/70 px-2.5 text-sm tabular-nums placeholder:text-muted/70 hover:border-line focus:bg-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100'
const cellCls = cellBase + ' w-full'

export function StructuredBuilder({ blocks, onChange }: { blocks: WorkoutBlock[]; onChange: (b: WorkoutBlock[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const update = (id: string, patch: Partial<WorkoutBlock>) => onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as WorkoutBlock) : b)))
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id)
    const b = blocks[i]
    const copy = (b.type === 'group' ? { ...b, id: uid('b-'), items: b.items.map((x) => ({ ...x, id: uid('it-') })) } : { ...b, id: uid('b-') }) as WorkoutBlock
    onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)])
  }
  const add = (b: WorkoutBlock) => { onChange([...blocks, b]); setLastAdded(b.id) }
  const ungroup = (g: Group) => {
    const i = blocks.findIndex((b) => b.id === g.id)
    onChange([...blocks.slice(0, i), ...g.items.map((it) => ({ ...it, type: 'exercise' as const })), ...blocks.slice(i + 1)])
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = blocks.findIndex((b) => b.id === e.active.id)
    const to = blocks.findIndex((b) => b.id === e.over!.id)
    onChange(arrayMove(blocks, from, to))
  }

  return (
    <div>
      <ExerciseSearch onPick={(p) => add({ type: 'exercise', id: uid('it-'), name: p.name, exerciseId: p.exerciseId })} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <AddChip icon={Heading} label="Section heading" onClick={() => add({ id: uid('b-'), type: 'section', title: '' })} />
        <AddChip icon={StickyNote} label="Instructions / note" onClick={() => add({ id: uid('b-'), type: 'text', text: '' })} />
        <AddChip icon={Layers} label="Superset" onClick={() => add({ id: uid('b-'), type: 'group', kind: 'superset', rounds: '3', items: [] })} />
        <AddChip icon={Repeat} label="Circuit" onClick={() => add({ id: uid('b-'), type: 'group', kind: 'circuit', rounds: '3', items: [] })} />
      </div>

      <div className="mt-5">
        {blocks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-white/50">
            <EmptyState icon={Dumbbell} title="Add your first exercise" text="Search above — the exercise drops straight in. Sets, reps and everything else are optional." />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map((b, i) => (
                  <SortableBlock key={b.id} id={b.id}>
                    {(handle) => (
                      <BlockCard
                        block={b}
                        handle={handle}
                        autoFocus={b.id === lastAdded}
                        isFirst={i === 0}
                        isLast={i === blocks.length - 1}
                        onMove={(dir) => onChange(arrayMove(blocks, i, i + dir))}
                        onChange={(patch) => update(b.id, patch)}
                        onRemove={() => remove(b.id)}
                        onDuplicate={() => duplicate(b.id)}
                        onUngroup={b.type === 'group' ? () => ungroup(b) : undefined}
                      />
                    )}
                  </SortableBlock>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

function AddChip({ icon: Icon, label, onClick }: { icon: typeof Heading; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 h-8 text-[13px] font-medium text-ink-soft hover:border-line-strong hover:text-ink">
      <Icon size={14} /> {label}
    </button>
  )
}

type Handle = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }

function SortableBlock({ id, children }: { id: string; children: (h: Handle) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'relative z-20 opacity-90 shadow-pop rounded-2xl')}>
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners })}
    </div>
  )
}

function DragHandle({ handle }: { handle: Handle }) {
  return (
    <button type="button" aria-label="Drag to reorder (or press space, then arrow keys)" className="mt-1.5 -ml-1 cursor-grab touch-none rounded-md p-1 text-muted/70 hover:text-ink active:cursor-grabbing" {...handle.attributes} {...handle.listeners}>
      <GripVertical size={16} />
    </button>
  )
}

function BlockActions({ onMove, isFirst, isLast, onDuplicate, onRemove, extra }: { onMove: (d: 1 | -1) => void; isFirst: boolean; isLast: boolean; onDuplicate: () => void; onRemove: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {extra}
      <IconButton size="sm" icon={ArrowUp} label="Move up" disabled={isFirst} onClick={() => onMove(-1)} className="hidden sm:inline-flex" />
      <IconButton size="sm" icon={ArrowDown} label="Move down" disabled={isLast} onClick={() => onMove(1)} className="hidden sm:inline-flex" />
      <IconButton size="sm" icon={Copy} label="Duplicate" onClick={onDuplicate} />
      <IconButton size="sm" icon={Trash2} label="Remove" onClick={onRemove} className="hover:text-miss" />
    </div>
  )
}

function BlockCard(props: {
  block: WorkoutBlock
  handle: Handle
  autoFocus: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (d: 1 | -1) => void
  onChange: (p: Partial<WorkoutBlock>) => void
  onRemove: () => void
  onDuplicate: () => void
  onUngroup?: () => void
}) {
  const { block: b, handle, onChange } = props
  const actions = <BlockActions {...props} extra={props.onUngroup && <IconButton size="sm" icon={Ungroup} label="Ungroup" onClick={props.onUngroup} />} />

  if (b.type === 'section') {
    return (
      <div className="flex items-start gap-2 pt-3 pb-1">
        <DragHandle handle={handle} />
        <input autoFocus={props.autoFocus} value={b.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Section heading — e.g. Warm up" aria-label="Section heading"
          className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold uppercase tracking-wider text-brand-700 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-muted focus:outline-none h-9" />
        {actions}
      </div>
    )
  }
  if (b.type === 'text') {
    return (
      <div className="flex items-start gap-2 rounded-2xl bg-brand-50/70 border border-brand-100 px-3 py-2">
        <DragHandle handle={handle} />
        <textarea autoFocus={props.autoFocus} value={b.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write any instructions here…" aria-label="Instructions"
          rows={Math.max(1, b.text.split('\n').length)} className="flex-1 min-w-0 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink-soft placeholder:text-muted focus:outline-none" />
        {actions}
      </div>
    )
  }
  if (b.type === 'exercise') {
    return (
      <div className="rounded-2xl border border-line bg-white px-3 py-2.5 shadow-card">
        <div className="flex items-start gap-2">
          <DragHandle handle={handle} />
          <ItemEditor item={b} onChange={(p) => onChange(p)} autoFocus={props.autoFocus} />
          {actions}
        </div>
      </div>
    )
  }
  // group
  const setItems = (items: ExerciseItem[]) => onChange({ items } as Partial<WorkoutBlock>)
  return (
    <div className="rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <DragHandle handle={handle} />
        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 h-7 text-[13px] font-semibold', b.kind === 'superset' ? 'bg-plan-bg text-plan' : 'bg-appt-bg text-appt')}>
          {b.kind === 'superset' ? <Layers size={14} /> : <Repeat size={14} />}
          <select aria-label="Group type" value={b.kind} onChange={(e) => onChange({ kind: e.target.value as Group['kind'] } as Partial<WorkoutBlock>)} className="bg-transparent focus:outline-none cursor-pointer">
            <option value="superset">Superset</option>
            <option value="circuit">Circuit</option>
          </select>
        </span>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">Rounds <input value={b.rounds ?? ''} onChange={(e) => onChange({ rounds: e.target.value } as Partial<WorkoutBlock>)} className={cn(cellBase, 'w-14 h-8')} placeholder="3" /></label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">Rest <input value={b.rest ?? ''} onChange={(e) => onChange({ rest: e.target.value } as Partial<WorkoutBlock>)} className={cn(cellBase, 'w-20 h-8')} placeholder="60s" /></label>
        <span className="flex-1" />
        {actions}
      </div>
      <div className="divide-y divide-line/70 px-3">
        {b.items.length === 0 && <p className="py-3 pl-7 text-sm text-muted">Add two or more exercises to do back-to-back.</p>}
        {b.items.map((it, i) => (
          <div key={it.id} className="flex items-start gap-2 py-2.5">
            <span className="mt-2 w-5 text-center text-xs font-semibold text-muted">{String.fromCharCode(65 + i)}</span>
            <ItemEditor item={it} inGroup onChange={(p) => setItems(b.items.map((x) => (x.id === it.id ? { ...x, ...p } : x)))} />
            <div className="flex items-center gap-0.5">
              <IconButton size="sm" icon={ChevronUp} label="Move up" disabled={i === 0} onClick={() => setItems(arrayMove(b.items, i, i - 1))} />
              <IconButton size="sm" icon={ChevronDown} label="Move down" disabled={i === b.items.length - 1} onClick={() => setItems(arrayMove(b.items, i, i + 1))} />
              <IconButton size="sm" icon={Trash2} label="Remove from group" onClick={() => setItems(b.items.filter((x) => x.id !== it.id))} className="hover:text-miss" />
            </div>
          </div>
        ))}
        <div className="py-2.5 pl-7">
          <ExerciseSearch compact placeholder={`Add an exercise to this ${b.kind}…`} onPick={(p) => setItems([...b.items, { id: uid('it-'), name: p.name, exerciseId: p.exerciseId }])} />
        </div>
      </div>
    </div>
  )
}

function ItemEditor({ item, onChange, inGroup, autoFocus }: { item: ExerciseItem; onChange: (p: Partial<ExerciseItem>) => void; inGroup?: boolean; autoFocus?: boolean }) {
  const [more, setMore] = useState(!!(item.tempo || item.notes))
  const cell = (k: keyof ExerciseItem, label: string, ph: string, w = '') => (
    <label className={cn('flex flex-col gap-0.5', w)}>
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{label}</span>
      <input value={(item[k] as string) ?? ''} onChange={(e) => onChange({ [k]: e.target.value })} placeholder={ph} className={cellCls} autoFocus={autoFocus && k === (inGroup ? 'reps' : 'sets')} />
    </label>
  )
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1.5">
        <div className="flex-1 min-w-[180px] pb-1">
          <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Exercise name" className="w-full bg-transparent text-[15px] font-medium focus:outline-none h-8" />
          {more ? null : <button type="button" onClick={() => setMore(true)} className="text-[12.5px] text-brand-700 hover:underline">+ Tempo & notes</button>}
        </div>
        <div className={cn('grid gap-1.5', inGroup ? 'grid-cols-3 w-full sm:w-[252px]' : 'grid-cols-4 w-full sm:w-[340px]')}>
          {!inGroup && cell('sets', 'Sets', '3')}
          {cell('reps', 'Reps', '10')}
          {cell('weight', 'Weight', 'kg')}
          {cell('rest', 'Rest', '60s')}
        </div>
      </div>
      {more && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[110px_1fr]">
          {cell('tempo', 'Tempo', '3-1-1')}
          {cell('notes', 'Notes for the client', 'e.g. Keep chest up')}
        </div>
      )}
    </div>
  )
}
