'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
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
      "p-2 rounded-lg transition-all hover:bg-zinc-800",
      isActive ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "text-zinc-500 hover:text-zinc-300"
    )}
  >
    {children}
  </button>
);

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
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
          class: 'text-teal-400 underline cursor-pointer',
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
          "prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[150px] p-4 text-zinc-300",
        ),
      },
    },
  });

  if (!editor) return null;

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
      "w-full rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden focus-within:border-teal-500/50 transition-all",
      className
    )}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
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
        
        <div className="w-px h-4 bg-zinc-800 mx-1" />

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
        
        <div className="w-px h-4 bg-zinc-800 mx-1" />

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
        
        <div className="w-px h-4 bg-zinc-800 mx-1" />

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
          border-left: 3px solid #14b8a6;
          padding-left: 1rem;
          font-style: italic;
          color: #94a3b8;
          margin: 1rem 0;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #52525b;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
