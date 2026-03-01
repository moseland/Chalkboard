import { useState, useEffect } from 'react';
import useCanvasStore from '../store/canvasStore';
import { images } from '../api';
import { Sparkles, Image as ImageIcon, Eraser, Scissors, FlipHorizontal, FlipVertical, Trash2, ArrowUpCircle, Component } from 'lucide-react';
import useDraggable from '../hooks/useDraggable';

export default function ImageToolbar({ onDelete }) {
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
    const lines = useCanvasStore((state) => state.lines);
    const updateNode = useCanvasStore((state) => state.updateNode);
    const [isProcessing, setIsProcessing] = useState(false);

    const { position, handlePointerDown } = useDraggable({ x: 0, y: 0 });

    // Only show if at least 1 item is selected
    if (selectedNodeIds.length === 0) return null;

    const selectedNodes = lines.filter(l => selectedNodeIds.includes(l.id));
    if (selectedNodes.length === 0) return null;

    const allImages = selectedNodes.every(n => n.tool === 'image');
    const allTexts = selectedNodes.every(n => n.tool === 'text');
    const allShapes = selectedNodes.every(n => n.tool === 'shape' || n.tool === 'polygon');

    // If only text is selected, the TextToolbar handles it.
    // If only shapes are selected, the ShapeToolbar handles it.
    if (allTexts || allShapes) return null;

    const firstNode = selectedNodes[0];

    // Read initial values from the first selected node
    const currentOpacity = firstNode.opacity !== undefined ? firstNode.opacity : 1;
    const currentBrightness = firstNode.brightness || 0;
    const currentContrast = firstNode.contrast || 0;
    const currentSaturation = firstNode.saturation || 0;

    const handleChange = (property, value) => {
        const numValue = parseFloat(value);
        selectedNodeIds.forEach(id => {
            updateNode(id, { [property]: numValue });
        });
    };

    const handleDelete = () => {
        const deletedIds = [...selectedNodeIds];
        useCanvasStore.getState().deleteNodes(deletedIds);
        if (onDelete) onDelete(deletedIds);
    };

    const handleFlipX = () => {
        selectedNodes.forEach(n => {
            const currentScaleX = n.scaleX || 1;
            const newScaleX = currentScaleX * -1;
            const rad = (n.rotation || 0) * Math.PI / 180;
            // The unrotated width is n.width. We shift x/y to account for the pivot point.
            // When flipping an object bounded by (0,0) and (width,0), its new bound is (0,0) to (-width, 0).
            // To keep it visually in the same place, we must move its origin to where the old (width,0) was.
            const dx = (n.width || 0) * currentScaleX * Math.cos(rad);
            const dy = (n.width || 0) * currentScaleX * Math.sin(rad);

            updateNode(n.id, {
                scaleX: newScaleX,
                x: n.x + dx,
                y: n.y + dy
            });
        });
    };

    const handleFlipY = () => {
        selectedNodes.forEach(n => {
            const currentScaleY = n.scaleY || 1;
            const newScaleY = currentScaleY * -1;
            const rad = (n.rotation || 0) * Math.PI / 180;
            // Similar math for Y-axis (height). Rotated (0, height) vector = (-height * sin, height * cos).
            const dx = -(n.height || 0) * currentScaleY * Math.sin(rad);
            const dy = (n.height || 0) * currentScaleY * Math.cos(rad);

            updateNode(n.id, {
                scaleY: newScaleY,
                x: n.x + dx,
                y: n.y + dy
            });
        });
    };

    const handleAIAction = async (task) => {
        if (isProcessing) return;

        // Single selection AI operations for now
        if (selectedNodes.length > 1) {
            alert("AI features currently only work on one image at a time.");
            return;
        }

        const targetNode = selectedNodes[0];
        let payload = {
            image: targetNode.src,
            task: task
        };

        if (task === 'search-and-replace') {
            const search = prompt("What do you want to find? (e.g. 'the dog')");
            if (!search) return;
            const replace = prompt("What to replace it with? (e.g. 'a cat')");
            if (!replace) return;

            payload.search_prompt = search;
            payload.prompt = replace;
        }

        setIsProcessing(true);
        try {
            const res = await images.edit(payload);
            if (res.data && res.data.image) {
                updateNode(targetNode.id, { src: res.data.image });
            }
        } catch (err) {
            console.error(err);
            alert("AI processing failed. Check console.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div
            className="tw-image-toolbar"
            style={{
                transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                // Don't transition transform directly as it hurts drag performance
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

            <div className="toolbar-section sliders">
                <div className="slider-group">
                    <label>Opacity {Math.round(currentOpacity * 100)}%</label>
                    <input
                        type="range"
                        min="0" max="1" step="0.05"
                        value={currentOpacity}
                        onChange={(e) => handleChange('opacity', e.target.value)}
                    />
                </div>

                <div className="slider-group">
                    <label>Brightness</label>
                    <input
                        type="range"
                        min="-1" max="1" step="0.05"
                        value={currentBrightness}
                        onChange={(e) => handleChange('brightness', e.target.value)}
                    />
                </div>

                <div className="slider-group">
                    <label>Contrast</label>
                    <input
                        type="range"
                        min="-100" max="100" step="1"
                        value={currentContrast}
                        onChange={(e) => handleChange('contrast', e.target.value)}
                    />
                </div>

                <div className="slider-group">
                    <label>Saturation</label>
                    <input
                        type="range"
                        min="-100" max="100" step="1"
                        value={currentSaturation}
                        onChange={(e) => handleChange('saturation', e.target.value)}
                    />
                </div>
            </div>

            <div className="toolbar-section actions">
                <button onClick={handleFlipX} title="Flip Horizontal">
                    <FlipHorizontal size={18} />
                </button>
                <button onClick={handleFlipY} title="Flip Vertical">
                    <FlipVertical size={18} />
                </button>
                <div className="divider" />

                {allImages && (
                    <>
                        {allImages && (
                            <>
                                <button className="ai-btn" onClick={() => handleAIAction('remove-background')} disabled={isProcessing} title="Remove Background">
                                    <Scissors size={18} />
                                </button>
                                <button className="ai-btn" onClick={() => handleAIAction('search-and-replace')} disabled={isProcessing} title="Search & Replace">
                                    <Sparkles size={18} />
                                </button>
                                <button className="ai-btn" onClick={() => handleAIAction('upscale')} disabled={isProcessing} title="Upscale Image">
                                    <ArrowUpCircle size={18} />
                                </button>
                                <div className="divider" />
                                <span style={{ fontSize: '10px', color: '#c084fc' }}>{isProcessing ? '...' : ''}</span>
                            </>
                        )}
                    </>
                )}

                <button onClick={handleDelete} className="danger" title="Delete Selection">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}
