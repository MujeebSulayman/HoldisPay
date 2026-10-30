'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Quote
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MenuButton = ({
  onClick,
  isActive = false,
  children,
  title
}: {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-2 rounded-lg transition-all hover:bg-white/[0.08]",
      isActive ? "bg-brand-500/10 text-brand-400 border border-brand-500/20" : "text-zinc-500 hover:text-zinc-300"
    )}
  >
    {children}
  </button>
);

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-400 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[150px] p-4 text-zinc-300 selection:bg-brand-500/30",
        ),
      },
    },
  });

  if (!mounted || !editor) {
    return (
      <div className={cn(
        "w-full rounded-lg border border-white/10 glass min-h-[210px]",
        className
      )} />
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn(
      "w-full rounded-lg border border-white/10 glass overflow-hidden focus-within:border-brand-500/50 transition-all",
      className
    )}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-white/10 bg-zinc-900/80 backdrop-blur-sm">
        <MenuButton
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        >
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <MenuButton
          title="H1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
        >
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="H2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <MenuButton
          title="Bullet List"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="Ordered List"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
        >
          <Quote className="w-4 h-4" />
        </MenuButton>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <MenuButton
          title="Link"
          onClick={setLink}
          isActive={editor.isActive('link')}
        >
          <LinkIcon className="w-4 h-4" />
        </MenuButton>

        <div className="flex-1" />

        <MenuButton
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Styles to fix bullet lists and order lists default browser behavior in Tailwind */}
      <style jsx global>{`
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .tiptap blockquote {
          border-left: 3px solid #5288ff;
          padding-left: 1rem;
          font-style: italic;
          color: #94a3b8;
          margin: 1rem 0;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #6b7280; /* gray-500 */
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
