import { useState, useEffect } from 'react';
import { Check, X, Loader2, Maximize, GripHorizontal } from 'lucide-react';
import useCanvasStore from '../store/canvasStore';
import Konva from 'konva';
import { images } from '../api';
import useDraggable from '../hooks/useDraggable';

export default function OutpaintOverlay({ onUpdateNode }) {
    const outpaintMode = useCanvasStore((state) => state.outpaintMode);
    const targetId = useCanvasStore((state) => state.outpaintTargetId);
    const setOutpaintMode = useCanvasStore((state) => state.setOutpaintMode);
    const saveHistory = useCanvasStore((state) => state.saveHistory);
    const setProcessing = useCanvasStore((state) => state.setProcessing);
    const isProcessing = useCanvasStore((state) => state.isProcessing);

    const [prompt, setPrompt] = useState('');
    const [frameId] = useState(`outpaint-frame-${Math.random().toString(36).substr(2, 9)}`);

    const { position, handlePointerDown } = useDraggable({ x: window.innerWidth / 2, y: window.innerHeight - 150 });

    // Effect to add/remove the frame node
    useEffect(() => {
        if (!outpaintMode || !targetId || !window.__stageRef) return;

        const stage = window.__stageRef;
        const layer = stage.getLayers()[0];
        const imgNode = stage.findOne(`#${targetId}`);
        if (!imgNode) return;

        // Disable image dragging while outpainting to prevent misalignment
        const originalDraggable = imgNode.draggable();
        imgNode.draggable(false);

        // Create a temporary frame rectangle
        const frame = new Konva.Rect({
            id: frameId,
            name: frameId,
            x: imgNode.x(),
            y: imgNode.y(),
            width: imgNode.width() * imgNode.scaleX(),
            height: imgNode.height() * imgNode.scaleY(),
            rotation: imgNode.rotation(),
            offsetX: imgNode.offsetX() * imgNode.scaleX(),
            offsetY: imgNode.offsetY() * imgNode.scaleY(),
            stroke: '#10b981',
            strokeWidth: 2,
            dash: [5, 5],
            draggable: true,
            listening: true
        });

        layer.add(frame);

        // Attach Transformer to the frame instead of the image
        const transformer = stage.findOne('Transformer');
        if (transformer) {
            transformer.nodes([frame]);
        }

        stage.batchDraw();

        return () => {
            imgNode.draggable(originalDraggable);
            const node = stage.findOne(`#${frameId}`);
            if (node) node.destroy();
            if (transformer) {
                transformer.nodes([]);
            }
            stage.batchDraw();
        };
    }, [outpaintMode, targetId, frameId]);

    if (!outpaintMode) return null;

    const handleCancel = () => {
        setOutpaintMode(false);
    };

    const handleSubmit = async () => {
        if (!window.__stageRef || !targetId) return;

        setProcessing(true, "Outpainting background...");

        try {
            const stage = window.__stageRef;
            const imgNode = stage.findOne(`#${targetId}`);
            const frameNode = stage.findOne(`#${frameId}`);

            if (!imgNode || !frameNode) throw new Error("Nodes not found");

            // 1. Calculate Offsets
            const imgRect = imgNode.getClientRect();
            const frameRect = frameNode.getClientRect();

            const nativeWidth = imgNode.width();
            const nativeHeight = imgNode.height();
            const scaleX = imgRect.width / nativeWidth;
            const scaleY = imgRect.height / nativeHeight;

            const left = Math.max(0, Math.round((imgRect.x - frameRect.x) / scaleX));
            const right = Math.max(0, Math.round((frameRect.x + frameRect.width - (imgRect.x + imgRect.width)) / scaleX));
            const up = Math.max(0, Math.round((imgRect.y - frameRect.y) / scaleY));

            const imgBottom = imgRect.y + imgRect.height;
            const frameBottom = frameRect.y + frameRect.height;
            const down = Math.max(0, Math.round((frameBottom - imgBottom) / scaleY));

            if (left === 0 && right === 0 && up === 0 && down === 0) {
                alert("Please expand the frame to outpaint.");
                setProcessing(false);
                return;
            }

            // 2. Capture the image
            const baseImageDataURL = imgNode.toDataURL({ pixelRatio: 1 });

            // 3. Send to API
            const res = await images.edit({
                image: baseImageDataURL,
                task: 'outpaint',
                prompt: prompt,
                left: left,
                right: right,
                up: up,
                down: down
            });

            if (res.data && res.data.image) {
                if (onUpdateNode) {
                    onUpdateNode(targetId, {
                        src: res.data.image,
                        x: imgNode.x() - (left * imgNode.scaleX()),
                        y: imgNode.y() - (up * imgNode.scaleY())
                    });
                }
                saveHistory();
                setOutpaintMode(false);
            } else {
                throw new Error("Stability AI failed to return an image.");
            }

        } catch (err) {
            console.error("Outpaint Error:", err);
            alert(`Outpaint failed: ${err.message || 'Unknown error'}`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '16px 24px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 3001,
            animation: 'tw-slide-up 0.3s ease-out',
            width: '400px',
            cursor: 'default'
        }}>
            <div
                onPointerDown={handlePointerDown}
                style={{
                    cursor: 'grab',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '4px 0',
                    marginTop: '-8px',
                    color: 'rgba(255,255,255,0.2)'
                }}
            >
                <GripHorizontal size={24} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginBottom: '4px' }}>
                <Maximize size={18} style={{ color: '#10b981' }} />
                <span style={{ color: 'white', fontSize: '15px', fontWeight: 600 }}>Outpainting Mode</span>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, width: '100%' }}>
                Resize the green dashed frame to expand the image area.
            </p>

            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to fill the new area with (e.g. 'starry night sky', 'beach with palm trees')..."
                style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '13px',
                    resize: 'none',
                    height: '60px',
                    outline: 'none'
                }}
            />

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '4px' }}>
                <button
                    onClick={handleCancel}
                    disabled={isProcessing}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '40px',
                        borderRadius: '100px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    <X size={18} />
                    Cancel
                </button>

                <button
                    onClick={handleSubmit}
                    disabled={isProcessing}
                    style={{
                        flex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '40px',
                        borderRadius: '100px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.2s'
                    }}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 size={18} className="tw-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Check size={18} />
                            Apply Outpaint
                        </>
                    )}
                </button>
            </div>

            <style>{`
                @keyframes tw-slide-up {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                .tw-spin {
                    animation: tw-spin 1s linear infinite;
                }
                @keyframes tw-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
