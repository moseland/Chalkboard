import { Component, Trash2 } from 'lucide-react';
import useCanvasStore from '../store/canvasStore';
import useDraggable from '../hooks/useDraggable';

export default function ShapeToolbar({ onDelete }) {
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
    const lines = useCanvasStore((state) => state.lines);
    const updateNode = useCanvasStore((state) => state.updateNode);

    // Position it slightly above the standard ImageToolbar
    const { position, handlePointerDown } = useDraggable({ x: 0, y: -20 });

    if (selectedNodeIds.length === 0) return null;

    const selectedNodes = lines.filter(l => selectedNodeIds.includes(l.id));
    if (selectedNodes.length === 0) return null;

    const allShapes = selectedNodes.every(n => n.tool === 'shape' || n.tool === 'polygon');
    if (!allShapes) return null;

    const firstNode = selectedNodes[0];

    // Default values based on the first selected shape
    const currentOpacity = firstNode.opacity !== undefined ? firstNode.opacity : 1;
    const currentColor = firstNode.color || '#E2E8F0';
    const currentFillColor = firstNode.fillColor || 'transparent';

    const handleChange = (property, value) => {
        selectedNodeIds.forEach(id => {
            updateNode(id, { [property]: value });
        });
    };

    const handleDelete = () => {
        const deletedIds = [...selectedNodeIds];
        useCanvasStore.getState().deleteNodes(deletedIds);
        if (onDelete) onDelete(deletedIds);
    };

    return (
        <div
            className="tw-image-toolbar tw-shape-toolbar"
            style={{
                transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                width: 'auto',
                minWidth: '200px'
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

            <div className="toolbar-section actions" style={{ padding: '0 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Stroke</span>
                    <div style={{ position: 'relative', width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }} title="Stroke Color">
                        <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => handleChange('color', e.target.value)}
                            style={{ position: 'absolute', top: '-10px', left: '-10px', width: '44px', height: '44px', cursor: 'pointer', padding: 0, border: 'none', background: 'none' }}
                        />
                    </div>
                </div>

                <div className="divider" style={{ margin: 0 }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Fill</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            className={`tw-color-swatch ${currentFillColor === 'transparent' ? 'active' : ''}`}
                            style={{ width: '24px', height: '24px', backgroundColor: '#1e293b', border: '1px dashed #94a3b8', padding: 0, overflow: 'hidden' }}
                            onClick={() => handleChange('fillColor', 'transparent')}
                            title="Transparent"
                        >
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, transparent 40%, #ef4444 40%, #ef4444 60%, transparent 60%)' }} />
                        </button>
                        <div style={{ position: 'relative', width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }} title="Fill Color">
                            <input
                                type="color"
                                value={currentFillColor === 'transparent' ? '#ffffff' : currentFillColor}
                                onChange={(e) => handleChange('fillColor', e.target.value)}
                                style={{ position: 'absolute', top: '-10px', left: '-10px', width: '44px', height: '44px', cursor: 'pointer', padding: 0, border: 'none', background: 'none' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="divider" style={{ margin: 0 }} />

                <button onClick={handleDelete} className="danger" title="Delete Shape">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="toolbar-section sliders" style={{ padding: '0 1rem 0.5rem 1rem' }}>
                <div className="slider-group" style={{ margin: 0 }}>
                    <label>Opacity {Math.round(currentOpacity * 100)}%</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={currentOpacity}
                        onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
}
