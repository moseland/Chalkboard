import { useState, useEffect } from 'react';
import { Check, X, Loader2, GripVertical } from 'lucide-react';
import useCanvasStore from '../store/canvasStore';
import Konva from 'konva';
import { images } from '../api';
import useDraggable from '../hooks/useDraggable';

export default function MagicEraserOverlay({ onDeleteNodes, onUpdateNode }) {
    const magicEraserMode = useCanvasStore((state) => state.magicEraserMode);
    const targetId = useCanvasStore((state) => state.magicEraserTargetId);
    const strokeIds = useCanvasStore((state) => state.magicEraserStrokeIds);
    const setMagicEraserMode = useCanvasStore((state) => state.setMagicEraserMode);
    const saveHistory = useCanvasStore((state) => state.saveHistory);
    const setProcessing = useCanvasStore((state) => state.setProcessing);
    const isProcessing = useCanvasStore((state) => state.isProcessing);

    const { position, handlePointerDown } = useDraggable({ x: window.innerWidth / 2, y: window.innerHeight - 100 });

    // Effect to disable image dragging while in eraser mode
    useEffect(() => {
        if (!magicEraserMode || !targetId || !window.__stageRef) return;

        const stage = window.__stageRef;
        const imgNode = stage.findOne(`#${targetId}`);
        if (!imgNode) return;

        const originalDraggable = imgNode.draggable();
        imgNode.draggable(false);

        return () => {
            imgNode.draggable(originalDraggable);
        };
    }, [magicEraserMode, targetId]);

    if (!magicEraserMode) return null;

    const handleCancel = () => {
        if (strokeIds.length > 0 && onDeleteNodes) {
            onDeleteNodes(strokeIds);
        }
        setMagicEraserMode(false);
    };

    const handleSubmit = async () => {
        if (!window.__stageRef || !targetId) return;
        if (strokeIds.length === 0) {
            alert("Please draw over the area you want to erase first.");
            return;
        }

        setProcessing(true, "Magic Eraser is processing...");

        try {
            const stage = window.__stageRef;
            const imgKonvaNode = stage.findOne(`#${targetId}`);
            if (!imgKonvaNode) {
                alert("Target image not found on canvas.");
                setProcessing(false);
                return;
            }

            const transformer = stage.findOne('Transformer');
            const selectionBox = stage.findOne('.selection-box');
            if (transformer) transformer.visible(false);
            if (selectionBox) selectionBox.visible(false);

            // 1. CAPTURE BOX - precise bounding box in screen space
            const box = imgKonvaNode.getClientRect();

            // 2. ISOLATE IMAGE
            const layer = stage.getLayers()[0];
            const allNodes = layer.getChildren();
            const originalVisibilities = new Map();
            allNodes.forEach(node => {
                originalVisibilities.set(node, node.visible());
                node.hide();
            });

            imgKonvaNode.show();
            stage.batchDraw();

            const baseImageDataURL = stage.toDataURL({
                x: box.x, y: box.y, width: box.width, height: box.height, pixelRatio: 1
            });

            // 3. CAPTURE MASK
            imgKonvaNode.hide();

            // Create temporary black background matching image transform EXACTLY
            const bgRect = new Konva.Rect({
                x: imgKonvaNode.x(),
                y: imgKonvaNode.y(),
                width: imgKonvaNode.width(),
                height: imgKonvaNode.height(),
                scaleX: imgKonvaNode.scaleX(),
                scaleY: imgKonvaNode.scaleY(),
                rotation: imgKonvaNode.rotation(),
                offsetX: imgKonvaNode.offsetX(),
                offsetY: imgKonvaNode.offsetY(),
                fill: 'black',
                listening: false
            });
            layer.add(bgRect);
            bgRect.moveToBottom();

            const strokeKonvaNodes = strokeIds.map(sid => stage.findOne(`#${sid}`)).filter(Boolean);
            const originalStrokeAttrs = new Map();

            strokeKonvaNodes.forEach(node => {
                node.show();
                // Store original color and composite op if the node supports them
                const attrs = {};
                if (typeof node.stroke === 'function') {
                    attrs.stroke = node.stroke();
                    node.stroke('white');
                }
                if (typeof node.globalCompositeOperation === 'function') {
                    attrs.globalCompositeOperation = node.globalCompositeOperation();
                    node.globalCompositeOperation('source-over');
                }
                originalStrokeAttrs.set(node, attrs);
            });

            stage.batchDraw();

            const maskDataURL = stage.toDataURL({
                x: box.x, y: box.y, width: box.width, height: box.height, pixelRatio: 1
            });

            // 4. RESTORE
            bgRect.destroy();
            strokeKonvaNodes.forEach(node => {
                const attrs = originalStrokeAttrs.get(node);
                if (attrs) {
                    if (attrs.stroke !== undefined && typeof node.stroke === 'function') {
                        node.stroke(attrs.stroke);
                    }
                    if (attrs.globalCompositeOperation !== undefined && typeof node.globalCompositeOperation === 'function') {
                        node.globalCompositeOperation(attrs.globalCompositeOperation);
                    }
                }
            });
            allNodes.forEach(node => {
                node.visible(originalVisibilities.get(node));
            });
            if (transformer) transformer.visible(true);
            if (selectionBox) selectionBox.visible(true);
            stage.batchDraw();

            // 5. SEND TO API
            const res = await images.edit({
                image: baseImageDataURL,
                mask: maskDataURL,
                task: 'erase'
            });

            if (res.data && res.data.image) {
                if (onDeleteNodes) onDeleteNodes(strokeIds);
                if (onUpdateNode) onUpdateNode(targetId, { src: res.data.image });
                saveHistory();
                setMagicEraserMode(false);
            } else {
                throw new Error("Stability AI failed to return an image.");
            }

        } catch (err) {
            console.error("Magic Eraser Error:", err);
            alert(`Magic Eraser failed: ${err.message || 'Unknown error'}`);
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
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '12px 20px',
            borderRadius: '100px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 3001,
            animation: 'tw-slide-up 0.3s ease-out',
            cursor: 'default'
        }}>
            <div
                onPointerDown={handlePointerDown}
                style={{
                    cursor: 'grab',
                    padding: '4px',
                    marginRight: '-4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgba(255,255,255,0.3)'
                }}
            >
                <GripVertical size={20} />
            </div>

            <div style={{ marginRight: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}> Magic Eraser Mode</span>
                <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px' }}>Draw over area to erase</span>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            <button
                onClick={handleCancel}
                disabled={isProcessing}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                title="Cancel Eraser"
            >
                <X size={20} />
            </button>

            <button
                onClick={handleSubmit}
                disabled={isProcessing}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '0 16px',
                    height: '36px',
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
                onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
                {isProcessing ? (
                    <>
                        <Loader2 size={18} className="tw-spin" />
                        Erasing...
                    </>
                ) : (
                    <>
                        <Check size={18} />
                        Apply Eraser
                    </>
                )}
            </button>

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
