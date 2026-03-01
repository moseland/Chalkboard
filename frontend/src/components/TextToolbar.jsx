import { useState, useEffect } from 'react';
import useCanvasStore from '../store/canvasStore';
import { Bold, Italic, Underline, Component, Trash2, Check } from 'lucide-react';
import useDraggable from '../hooks/useDraggable';

const FONTS = ['sans-serif', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald'];
const HEADINGS = [
    { label: 'Paragraph', value: '<p>' },
    { label: 'Heading 1', value: '<h1>' },
    { label: 'Heading 2', value: '<h2>' },
    { label: 'Heading 3', value: '<h3>' },
    { label: 'Heading 4', value: '<h4>' },
    { label: 'Heading 5', value: '<h5>' },
    { label: 'Heading 6', value: '<h6>' }
];

export default function TextToolbar({ onDelete }) {
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
    const editingTextNodeId = useCanvasStore((state) => state.editingTextNodeId);
    const lines = useCanvasStore((state) => state.lines);
    const updateNode = useCanvasStore((state) => state.updateNode);

    // Position it slightly above the standard ImageToolbar
    const { position, handlePointerDown } = useDraggable({ x: 0, y: -40 });

    // State to track if rich text editor is active
    const [isEditorActive, setIsEditorActive] = useState(false);

    useEffect(() => {
        // Poll to see if the editor is mounted and focused
        const interval = setInterval(() => {
            const editor = document.querySelector('.tw-rich-text-editor');
            const isActive = editor && document.activeElement === editor;
            if (isActive !== isEditorActive) {
                setIsEditorActive(isActive);
            }
        }, 300);
        return () => clearInterval(interval);
    }, [isEditorActive]);

    const activeId = editingTextNodeId || (selectedNodeIds.length > 0 ? selectedNodeIds[0] : null);
    if (!activeId) return null;

    const activeNode = lines.find(l => l.id === activeId);
    if (!activeNode || activeNode.tool !== 'text') return null;

    // Default values
    const currentOpacity = activeNode.opacity !== undefined ? activeNode.opacity : 1;
    const currentFontFamily = activeNode.fontFamily || 'sans-serif';
    const currentFontSize = activeNode.fontSize || 24;
    const currentFontStyle = activeNode.fontStyle || 'normal';
    const currentTextDecoration = activeNode.textDecoration || '';
    const currentColor = activeNode.color || '#E2E8F0';

    const isBold = currentFontStyle.includes('bold');
    const isItalic = currentFontStyle.includes('italic');
    const isUnderline = currentTextDecoration.includes('underline');

    const handleChange = (property, value) => {
        if (selectedNodeIds.length > 0) {
            selectedNodeIds.forEach(id => {
                updateNode(id, { [property]: value });
            });
        } else if (editingTextNodeId) {
            updateNode(editingTextNodeId, { [property]: value });
        }
    };

    const applyFormat = (command, value = null, nodeProperty, nodeValue, toggle = false) => {
        const editor = document.querySelector('.tw-rich-text-editor');

        // If we are actively editing inside the inline rich text editor
        if (editor && editingTextNodeId) {
            editor.focus(); // Ensure it has focus before command
            document.execCommand(command, false, value);
        } else if (activeNode) {
            // Otherwise apply to the whole node
            let finalValue = nodeValue;
            if (toggle) {
                const current = activeNode[nodeProperty] || '';
                finalValue = current.includes(nodeValue) ? current.replace(nodeValue, '').trim() || 'normal' : (current === 'normal' ? nodeValue : `${current} ${nodeValue}`);
            }
            handleChange(nodeProperty, finalValue);
        }
    };

    const handleDelete = () => {
        const deletedIds = [...selectedNodeIds];
        useCanvasStore.getState().deleteNodes(deletedIds);
        if (onDelete) onDelete(deletedIds);
    };

    // Prevent focus loss when clicking toolbar items
    const keepFocus = (e) => {
        e.preventDefault();
    };

    return (
        <div
            className="tw-image-toolbar tw-text-toolbar"
            style={{
                transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                zIndex: 5000
            }}
        >
            <div
                className="toolbar-drag-handle"
                onPointerDown={handlePointerDown}
                style={{
                    height: '24px',
                    width: '100%',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '0.5rem'
                }}
            >
                <Component size={14} />
            </div>

            <div className="toolbar-section actions" style={{ padding: '0 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={handleDelete} className="danger" title="Delete Text">
                    <Trash2 size={16} />
                </button>

                <div className="divider" style={{ margin: '0' }} />

                <div className="slider-group" style={{ margin: 0, flex: 1 }}>
                    <label style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px', display: 'block' }}>Opacity {Math.round(currentOpacity * 100)}%</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={currentOpacity}
                        onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ width: '100px' }}
                    />
                </div>
            </div>
        </div>
    );
}
