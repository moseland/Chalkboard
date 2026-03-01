import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline as UnderlineIcon, Check, ChevronDown } from 'lucide-react';

// ─── Custom Tiptap Extensions ────────────────────────────────────────

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() { return { types: ['textStyle'] }; },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
            unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const LineHeight = Extension.create({
    name: 'lineHeight',
    addOptions() { return { types: ['paragraph', 'heading'] }; },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: element => element.style.lineHeight?.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setLineHeight: lineHeight => ({ commands }) => this.options.types.every(type => commands.updateAttributes(type, { lineHeight })),
            unsetLineHeight: () => ({ commands }) => this.options.types.every(type => commands.resetAttributes(type, 'lineHeight')),
        };
    },
});

// ─── Constants ───────────────────────────────────────────────────────

const FONTS = ['sans-serif', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald'];
const LINE_HEIGHTS = ['1', '1.2', '1.4', '1.6', '1.8', '2', '2.5', '3'];
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48', '64', '80'];

// ─── Custom Dropdown (prevents focus loss) ─────────────────────────

function ToolbarDropdown({ label, value, options, onSelect, renderOption }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div className="tw-rt-dropdown" ref={ref}>
            <button
                className="tw-rt-dropdown-trigger"
                onMouseDown={(e) => {
                    e.preventDefault(); // Keep editor focus!
                    e.stopPropagation();
                    setOpen(!open);
                }}
                title={label}
            >
                <span className="tw-rt-dropdown-label">{value || label}</span>
                <ChevronDown size={10} />
            </button>
            {open && (
                <div className="tw-rt-dropdown-menu">
                    {options.map((opt) => {
                        const optValue = typeof opt === 'object' ? opt.value : opt;
                        const optLabel = typeof opt === 'object' ? opt.label : opt;
                        return (
                            <button
                                key={optValue}
                                className={`tw-rt-dropdown-item ${optValue === value ? 'is-active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Keep editor focus!
                                    e.stopPropagation();
                                    onSelect(optValue);
                                    setOpen(false);
                                }}
                            >
                                {renderOption ? renderOption(opt) : optLabel}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────

export default function RichTextEditor({ node, onSave, onCancel, stageScale, stagePos }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(node.width);
    const [height, setHeight] = useState(node.height || 100);

    // Convert Canvas coordinates to Screen Pixels for the CSS absolute overlay
    const screenX = node.x * stageScale + (stagePos?.x || 0);
    const screenY = node.y * stageScale + (stagePos?.y || 0);

    const [updateCounter, setUpdateCounter] = useState(0);

    // Initialize Tiptap editor
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
            Underline,
            TextStyle,
            Color,
            FontFamily.configure({ types: ['textStyle'] }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            FontSize,
            LineHeight,
        ],
        content: node.html || node.text || '',
        onSelectionUpdate: () => setUpdateCounter(c => c + 1),
        onTransaction: () => setUpdateCounter(c => c + 1),
        editorProps: {
            attributes: {
                class: 'tw-rich-text-editor',
                style: [
                    `color: ${node.color || '#E2E8F0'}`,
                    `font-size: ${(node.fontSize || 32) * stageScale}px`,
                    `font-family: ${node.fontFamily || 'sans-serif'}`,
                    `min-height: ${50 * stageScale}px`,
                ].join('; '),
            },
            handleKeyDown: (view, event) => {
                if (event.key === 'Enter' && event.metaKey) {
                    handleSave();
                    return true;
                }
                if (event.key === 'Escape') {
                    onCancel();
                    return true;
                }
                return false;
            },
        },
        autofocus: 'all',
    });

    // Click-outside to save
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!containerRef.current) return;
            const isInsideEditor = containerRef.current.contains(e.target);
            const isInsideMainToolbar = e.target.closest('.tw-text-toolbar');
            if (!isInsideEditor && !isInsideMainToolbar) {
                handleSave();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [width, height, node.id, editor]);

    const handleSave = useCallback(() => {
        if (!editor) return;
        const html = editor.getHTML();
        const editorEl = containerRef.current?.querySelector('.tiptap');
        const contentHeight = editorEl ? editorEl.scrollHeight : height;
        onSave(html, width, contentHeight);
    }, [editor, width, height, onSave]);

    if (!editor) return null;

    // ─── Read current formatting from editor state (reactive) ────────
    const attrs = editor.getAttributes('textStyle');
    const currentFont = attrs.fontFamily || '';
    const currentFontSize = attrs.fontSize ? parseInt(attrs.fontSize) : '';
    const currentColor = attrs.color || node.color || '#E2E8F0';
    const currentHeading = [1, 2, 3, 4, 5, 6].find(l => editor.isActive('heading', { level: l })) || 0;
    const headingLabel = currentHeading === 0 ? 'Paragraph' : `H${currentHeading}`;
    const activeNodeAttrs = currentHeading > 0 ? editor.getAttributes('heading') : editor.getAttributes('paragraph');
    const currentLineHeight = activeNodeAttrs.lineHeight || 'Line Height';

    return (
        <div
            ref={containerRef}
            className="tw-rich-text-container"
            style={{
                position: 'absolute',
                top: screenY + 'px',
                left: screenX + 'px',
                width: (width * stageScale) + 'px',
                minHeight: (height * stageScale) + 'px',
                transformOrigin: 'top left',
                transform: `rotate(${node.rotation || 0}deg)`,
                zIndex: 4000
            }}
        >
            {/* ─── Inline Formatting Toolbar ─────────────────────── */}
            <div className="tw-rt-inline-toolbar" onMouseDown={(e) => e.stopPropagation()}>

                {/* Font Family */}
                <ToolbarDropdown
                    label="Font"
                    value={currentFont || 'Font'}
                    options={FONTS}
                    onSelect={(f) => editor.chain().focus().setFontFamily(f).run()}
                    renderOption={(f) => <span style={{ fontFamily: f }}>{f}</span>}
                />

                {/* Font Size — custom dropdown, no focus loss */}
                <ToolbarDropdown
                    label="Size"
                    value={currentFontSize ? `${currentFontSize}` : 'Size'}
                    options={FONT_SIZES}
                    onSelect={(s) => editor.chain().focus().setFontSize(s + 'px').run()}
                />

                {/* Heading */}
                <ToolbarDropdown
                    label="Style"
                    value={headingLabel}
                    options={[
                        { label: 'Paragraph', value: 0 },
                        { label: 'Heading 1', value: 1 },
                        { label: 'Heading 2', value: 2 },
                        { label: 'Heading 3', value: 3 },
                    ]}
                    onSelect={(v) => {
                        const level = parseInt(v);
                        if (level === 0) editor.chain().focus().setParagraph().run();
                        else editor.chain().focus().toggleHeading({ level }).run();
                    }}
                />

                <div className="tw-rt-separator" />

                {/* Bold / Italic / Underline */}
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    title="Bold"
                >
                    <Bold size={14} />
                </button>
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                >
                    <Italic size={14} />
                </button>
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'is-active' : ''}
                    title="Underline"
                >
                    <UnderlineIcon size={14} />
                </button>

                <div className="tw-rt-separator" />

                {/* Color Picker */}
                <div className="tw-rt-color-swatch" title="Text Color" style={{ borderColor: currentColor }}>
                    <input
                        type="color"
                        value={currentColor}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    />
                </div>

                {/* Line Height */}
                <ToolbarDropdown
                    label="Line Height"
                    value={currentLineHeight}
                    options={LINE_HEIGHTS}
                    onSelect={(v) => editor.chain().focus().setLineHeight(v).run()}
                />

                <div className="tw-rt-separator" />

                {/* Save */}
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSave}
                    className="tw-rt-save-btn"
                    title="Save & Close"
                >
                    <Check size={14} />
                </button>
            </div>

            {/* ─── Editor Content ─────────────────────────────────── */}
            <div className="tw-rt-editor-wrapper">
                <EditorContent
                    editor={editor}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            </div>

            <div className="tw-rich-text-hint">Press Cmd+Enter to save, Esc to cancel</div>
        </div>
    );
}
