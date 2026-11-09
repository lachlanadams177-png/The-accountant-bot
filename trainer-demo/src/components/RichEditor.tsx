import { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Minus, Redo2, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

export function RichEditor({
  value,
  onChange,
  placeholder = 'Just type your workout here…',
  minHeight = 360,
  autoFocus,
  className,
  ariaLabel = 'Workout instructions',
  compact,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  autoFocus?: boolean
  className?: string
  ariaLabel?: string
  compact?: boolean
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'prose-workout tiptap',
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  // Accept outside changes (template inserted, draft restored) without fighting the user's typing.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) editor.commands.setContent(value || '', { emitUpdate: false })
  }, [value, editor])

  return (
    <div className={cn('flex flex-col rounded-2xl border border-line bg-white shadow-card focus-within:border-sage-300 focus-within:ring-4 focus-within:ring-sage-50 transition-shadow', className)}>
      <Toolbar editor={editor} compact={compact} />
      <div
        className={cn('flex-1 cursor-text', compact ? 'px-4 py-3' : 'px-5 sm:px-7 py-5')}
        style={{ minHeight }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

function Toolbar({ editor, compact }: { editor: Editor | null; compact?: boolean }) {
  if (!editor) return <div className="h-11 border-b border-line" />
  const btn = (Icon: LucideIcon, label: string, active: boolean, run: () => void, shortcut?: string) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-1.5 text-[13px] transition-colors',
        active ? 'bg-sage-100 text-sage-800' : 'text-ink-soft hover:bg-stone-100 hover:text-ink',
      )}
    >
      <Icon size={16} />
    </button>
  )
  const c = () => editor.chain().focus()
  return (
    <div className={cn('flex flex-wrap items-center gap-0.5 border-b border-line', compact ? 'px-2 py-1' : 'px-3 py-1.5')} role="toolbar" aria-label="Formatting">
      {btn(Heading2, 'Heading', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), `${mod}+Alt+2`)}
      {btn(Heading3, 'Subheading', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), `${mod}+Alt+3`)}
      <span className="mx-1 h-5 w-px bg-line" />
      {btn(Bold, 'Bold', editor.isActive('bold'), () => c().toggleBold().run(), `${mod}+B`)}
      {btn(Italic, 'Italic', editor.isActive('italic'), () => c().toggleItalic().run(), `${mod}+I`)}
      <span className="mx-1 h-5 w-px bg-line" />
      {btn(List, 'Bullet list', editor.isActive('bulletList'), () => c().toggleBulletList().run(), `${mod}+Shift+8`)}
      {btn(ListOrdered, 'Numbered list', editor.isActive('orderedList'), () => c().toggleOrderedList().run(), `${mod}+Shift+7`)}
      {!compact && btn(Minus, 'Divider line', false, () => c().setHorizontalRule().run())}
      <span className="flex-1" />
      {btn(Undo2, 'Undo', false, () => c().undo().run(), `${mod}+Z`)}
      {btn(Redo2, 'Redo', false, () => c().redo().run(), `${mod}+Shift+Z`)}
    </div>
  )
}

/** Read-only rendering of a written workout, exactly as the trainer wrote it. */
export function RichView({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-workout', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
