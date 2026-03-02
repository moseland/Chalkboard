import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Group, Path, Text, Rect, Circle, RegularPolygon, Transformer, Image as KonvaImage, Shape } from 'react-konva';
import Konva from 'konva';
import useCanvasStore from '../store/canvasStore';
import useImage from 'use-image';
import webpfy from '../utils/webpfy';
import { renderRichTextToSVG } from '../utils/richTextRenderer';
import { DollarRecognizer } from '../utils/dollarRecognizer';

const recognizer = new DollarRecognizer();
import RichTextEditor from './RichTextEditor';
import { Check, X } from 'lucide-react';

const URLImage = ({ line, tool, onSelect, onChange }) => {
    const [image] = useImage(line.src, 'anonymous');
    const imageRef = useRef(null);

    useEffect(() => {
        if (image && imageRef.current) {
            imageRef.current.cache();
        }
    }, [image, line.brightness, line.contrast, line.saturation]);

    return (
        <KonvaImage
            ref={imageRef}
            id={line.id}
            name={line.id}
            image={image}
            x={line.x}
            y={line.y}
            width={line.width}
            height={line.height}
            scaleX={line.scaleX || 1}
            scaleY={line.scaleY || 1}
            rotation={line.rotation || 0}
            draggable={tool === 'select'}
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={(e) => {
                onChange(line.id, {
                    x: e.target.x(),
                    y: e.target.y()
                });
            }}
            onTransformEnd={(e) => {
                const node = e.target;
                onChange(line.id, {
                    x: node.x(),
                    y: node.y(),
                    scaleX: node.scaleX(),
                    scaleY: node.scaleY(),
                    rotation: node.rotation()
                });
            }}
            filters={[Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL]}
            brightness={line.brightness || 0}
            contrast={line.contrast || 0}
            saturation={line.saturation || 0}
            luminance={0}
            opacity={line.opacity !== undefined ? line.opacity : 1}
        />
    );
};

const DataNode = ({ id, line, tool, isEditing, onSelect, onEdit, onChange }) => {
    const [image, setImage] = useState(null);
    const [measuredHeight, setMeasuredHeight] = useState(line.height || 200);
    const imageRef = useRef(null);

    useEffect(() => {
        const updateImage = async () => {
            const { dataUrl, height } = await renderRichTextToSVG({
                html: line.html || line.text || '<p>New Node</p>',
                width: line.width - 40, // Padding
                color: '#e2e8f0',
                fontSize: 16,
                fontFamily: 'Inter, system-ui, sans-serif'
            });
            setMeasuredHeight(height);

            const img = new window.Image();
            img.onload = () => {
                setImage(img);
                if (imageRef.current) {
                    imageRef.current.getLayer()?.batchDraw();
                }
            };
            img.src = dataUrl;
        };
        updateImage();
    }, [line.html, line.text, line.width]);

    const [hoveredPort, setHoveredPort] = useState(null);
    const portSize = 20;
    const portHitSize = 30;
    const ports = [
        { name: 'top', x: line.width / 2, y: 0 },
        { name: 'bottom', x: line.width / 2, y: line.height },
        { name: 'left', x: 0, y: line.height / 2 },
        { name: 'right', x: line.width, y: line.height / 2 },
    ];

    const pendingConnector = useCanvasStore(state => state.pendingConnector);
    const setPendingConnector = useCanvasStore(state => state.setPendingConnector);

    const handlePortMouseDown = (e, portName) => {
        if (e) e.cancelBubble = true;
        if (tool !== 'connector') return;
        const stage = window.__stageRef;
        const pos = stage.getRelativePointerPosition();
        setPendingConnector({ fromId: line.id, fromPort: portName, x: pos.x, y: pos.y });
    };

    const handleNodeClick = (e) => {
        onSelect(e);
    };

    return (
        <Group
            id={id || line.id}
            name={id || line.id}
            x={line.x}
            y={line.y}
            width={line.width}
            height={line.height}
            draggable={tool === 'select'}
            onClick={handleNodeClick}
            onTap={handleNodeClick}
            onDblClick={() => onEdit(line)}
            onDragMove={(e) => {
                useCanvasStore.getState().updateNodePosition(line.id, e.target.x(), e.target.y());
            }}
            onDragEnd={(e) => {
                onChange(line.id, {
                    x: e.target.x(),
                    y: e.target.y()
                });
            }}
            onTransform={(e) => {
                const node = e.target;
                const newWidth = Math.max(50, node.width() * node.scaleX());
                const newHeight = Math.max(30, node.height() * node.scaleY());
                node.scaleX(1);
                node.scaleY(1);
                node.width(newWidth);
                node.height(newHeight);
            }}
            onTransformEnd={(e) => {
                const node = e.target;
                onChange(line.id, {
                    x: node.x(),
                    y: node.y(),
                    width: node.width(),
                    height: node.height(),
                    scaleX: 1,
                    scaleY: 1,
                    rotation: node.rotation()
                });
            }}
        >
            <Rect
                width={line.width}
                height={line.height}
                fill={line.fillColor || 'rgba(30, 41, 59, 0.8)'}
                stroke={line.color || '#334155'}
                strokeWidth={2}
                cornerRadius={8}
            />
            {image && (
                <KonvaImage
                    ref={imageRef}
                    image={image}
                    x={20}
                    y={20}
                    width={line.width - 40}
                    height={measuredHeight}
                    opacity={isEditing ? 0 : 1}
                />
            )}

            {(tool === 'connector' || tool === 'select') && ports.map(port => (
                <Group key={port.name}>
                    {/* Invisible larger hit area */}
                    <Rect
                        x={port.x - portHitSize / 2}
                        y={port.y - portHitSize / 2}
                        width={portHitSize}
                        height={portHitSize}
                        fill="transparent"
                        onMouseDown={(e) => handlePortMouseDown(e, port.name)}
                        onTouchStart={(e) => handlePortMouseDown(e, port.name)}
                        onMouseEnter={() => {
                            setHoveredPort(port.name);
                            document.body.style.cursor = 'crosshair';
                        }}
                        onMouseLeave={() => {
                            setHoveredPort(null);
                            document.body.style.cursor = 'default';
                        }}
                    />
                    {/* Visible port square */}
                    <Rect
                        x={port.x - portSize / 2}
                        y={port.y - portSize / 2}
                        width={portSize}
                        height={portSize}
                        fill={hoveredPort === port.name ? "#818cf8" : "#4f46e5"}
                        stroke="#ffffff"
                        strokeWidth={hoveredPort === port.name ? 2 : 1}
                        cornerRadius={4}
                        scaleX={hoveredPort === port.name ? 1.2 : 1}
                        scaleY={hoveredPort === port.name ? 1.2 : 1}
                        offsetX={hoveredPort === port.name ? portSize * 0.1 : 0}
                        offsetY={hoveredPort === port.name ? portSize * 0.1 : 0}
                        listening={false}
                    />
                </Group>
            ))}
        </Group>
    );
};

const RichText = ({ id, line, tool, onSelect, onEdit, onChange, isEditing }) => {
    const [image, setImage] = useState(null);
    const [measuredHeight, setMeasuredHeight] = useState(line.height || 100);
    const imageRef = useRef(null);

    useEffect(() => {
        const updateImage = async () => {
            const { dataUrl, height } = await renderRichTextToSVG({
                html: line.html || line.text,
                width: line.width || 400,
                color: line.color,
                fontSize: line.fontSize,
                fontFamily: line.fontFamily
            });
            setMeasuredHeight(height);

            const img = new window.Image();
            img.onload = () => {
                setImage(img);
                if (imageRef.current) {
                    // Optional: we can sync height back to store if it changed, but local State is enough for rendering
                    imageRef.current.getLayer()?.batchDraw();
                }
            };
            img.src = dataUrl;
        };
        updateImage();
    }, [line.html, line.text, line.width, line.color, line.fontSize, line.fontFamily]);

    if (!image) return null;

    return (
        <KonvaImage
            ref={imageRef}
            id={id || line.id}
            name={id || line.id}
            image={image}
            x={line.x}
            y={line.y}
            width={line.width}
            height={measuredHeight} // Use dynamic measured height
            scaleX={line.scaleX || 1}
            scaleY={line.scaleY || 1}
            rotation={line.rotation || 0}
            draggable={tool === 'select'}
            onClick={onSelect}
            onTap={onSelect}
            onDblClick={(e) => {
                onEdit(line);
            }}
            onDblTap={(e) => {
                onEdit(line);
            }}
            onDragEnd={(e) => {
                onChange(line.id, {
                    x: e.target.x(),
                    y: e.target.y()
                });
            }}
            onTransform={(e) => {
                // For rich text, we want to update width during resize to see wrapping
                const node = e.target;
                const newWidth = Math.max(50, node.width() * node.scaleX());
                const newHeight = Math.max(20, node.height() * node.scaleY());
                node.setAttrs({
                    width: newWidth,
                    height: newHeight,
                    scaleX: 1,
                    scaleY: 1
                });
            }}
            onTransformEnd={(e) => {
                const node = e.target;
                onChange(line.id, {
                    x: node.x(),
                    y: node.y(),
                    width: node.width(),
                    height: node.height(),
                    scaleX: 1,
                    scaleY: 1,
                    rotation: node.rotation()
                });
            }}
            opacity={isEditing ? 0 : (line.opacity !== undefined ? line.opacity : 1)}
        />
    );
};
const Connector = ({ line, lines, tool, onSelect, onChange }) => {
    const fromNode = lines.find(n => n.id === line.fromId);
    const toNode = lines.find(n => n.id === line.toId);

    if (!fromNode || !toNode) return null;

    const getPortPos = (node, portName) => {
        const width = (node.width || 0) * (node.scaleX || 1);
        const height = (node.height || 0) * (node.scaleY || 1);

        let offsetX = width / 2;
        let offsetY = height / 2;

        if (portName === 'top') { offsetX = width / 2; offsetY = 0; }
        if (portName === 'bottom') { offsetX = width / 2; offsetY = height; }
        if (portName === 'left') { offsetX = 0; offsetY = height / 2; }
        if (portName === 'right') { offsetX = width; offsetY = height / 2; }

        const rad = (node.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = offsetX - width / 2;
        const dy = offsetY - height / 2;
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;

        return {
            x: (node.x || 0) + width / 2 + rotatedX,
            y: (node.y || 0) + height / 2 + rotatedY
        };
    };

    const getControlPointOffset = (portName) => {
        const offset = 80;
        if (portName === 'top') return { dx: 0, dy: -offset };
        if (portName === 'bottom') return { dx: 0, dy: offset };
        if (portName === 'left') return { dx: -offset, dy: 0 };
        if (portName === 'right') return { dx: offset, dy: 0 };
        return { dx: 0, dy: 0 };
    };

    const start = getPortPos(fromNode, line.fromPort);
    const end = getPortPos(toNode, line.toPort);

    const cp1Offset = getControlPointOffset(line.fromPort);
    const cp2Offset = getControlPointOffset(line.toPort);
    const cp1 = { x: start.x + cp1Offset.dx, y: start.y + cp1Offset.dy };
    const cp2 = { x: end.x + cp2Offset.dx, y: end.y + cp2Offset.dy };

    // Build SVG-style path data for Shape
    const pathData = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

    // Calculate arrowhead angle from tangent at endpoint
    const arrowAngle = Math.atan2(end.y - cp2.y, end.x - cp2.x) * (180 / Math.PI) + 90;
    const arrowRadius = 16;
    // Offset the arrow so its tip touches the port edge, not its center
    const arrowAngleRad = Math.atan2(end.y - cp2.y, end.x - cp2.x);
    const arrowTipX = end.x - Math.cos(arrowAngleRad) * (arrowRadius * 0.5);
    const arrowTipY = end.y - Math.sin(arrowAngleRad) * (arrowRadius * 0.5);

    return (
        <Group>
            <Shape
                sceneFunc={(context, shape) => {
                    context.beginPath();
                    context.moveTo(start.x, start.y);
                    context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                    context.fillStrokeShape(shape);
                }}
                id={line.id}
                name={line.id}
                stroke={line.color || '#E2E8F0'}
                strokeWidth={line.brushSize || 2}
                lineCap="round"
                lineJoin="round"
                hitStrokeWidth={12}
                onClick={onSelect}
                onTap={onSelect}
            />
            {line.connectorType === 'arrow' && (
                <RegularPolygon
                    x={arrowTipX}
                    y={arrowTipY}
                    sides={3}
                    radius={arrowRadius}
                    fill={line.color || '#E2E8F0'}
                    rotation={arrowAngle}
                />
            )}
        </Group>
    );
};



export default function Canvas({ onStrokeComplete, onDeleteNodes }) {
    const stageRef = useRef(null);
    const trRef = useRef(null);

    // Expose stage to window for AI snapshotting
    useEffect(() => {
        window.__stageRef = stageRef.current;
        window.__onStrokeComplete = onStrokeComplete;
        return () => {
            window.__stageRef = null;
            window.__onStrokeComplete = null;
        };
    }, [onStrokeComplete]);

    const lines = useCanvasStore((state) => state.lines);
    const tool = useCanvasStore((state) => state.tool);
    const isDrawing = useCanvasStore((state) => state.isDrawing);
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
    const setSelectedNodeIds = useCanvasStore((state) => state.setSelectedNodeIds);
    const stageConfig = useCanvasStore((state) => state.stageConfig);
    const setStageConfig = useCanvasStore((state) => state.setStageConfig);
    const updateNode = useCanvasStore((state) => state.updateNode);
    const editingTextNodeId = useCanvasStore((state) => state.editingTextNodeId);
    const setEditingTextNodeId = useCanvasStore((state) => state.setEditingTextNodeId);
    const outpaintMode = useCanvasStore((state) => state.outpaintMode);
    const magicEraserMode = useCanvasStore((state) => state.magicEraserMode);

    const startDrawing = useCanvasStore((state) => state.startDrawing);
    const continueDrawing = useCanvasStore((state) => state.continueDrawing);
    const stopDrawing = useCanvasStore((state) => state.stopDrawing);
    const addNode = useCanvasStore((state) => state.addNode);

    // Drag Selection State
    const selectionRectRef = useRef(null);
    const [selectionBox, setSelectionBox] = useState(null);

    const getNearestPort = (node, pointerPos) => {
        const ports = [
            { name: 'top', x: node.width / 2, y: 0 },
            { name: 'bottom', x: node.width / 2, y: node.height },
            { name: 'left', x: 0, y: node.height / 2 },
            { name: 'right', x: node.width, y: node.height / 2 },
        ];
        const localPos = { x: pointerPos.x - node.x, y: pointerPos.y - node.y };
        let nearestPort = ports[0];
        let minDist = Infinity;
        ports.forEach(p => {
            const dist = Math.sqrt(Math.pow(localPos.x - p.x, 2) + Math.pow(localPos.y - p.y, 2));
            if (dist < minDist) { minDist = dist; nearestPort = p; }
        });
        return nearestPort;
    };

    // Called on mousedown/touchstart over a node when connector tool is active
    const handleConnectorDragStart = (e, node) => {
        if (e) e.cancelBubble = true;
        const stage = window.__stageRef;
        const pointerPos = stage.getRelativePointerPosition();
        const nearestPort = getNearestPort(node, pointerPos);
        setPendingConnector({ fromId: node.id, fromPort: nearestPort.name, x: pointerPos.x, y: pointerPos.y });
    };

    // General node click/tap handler - routes to selection or connector drag start
    const handleNodeInteraction = (e, node) => {
        if (tool === 'connector' && node.tool === 'dataNode') {
            handleConnectorDragStart(e, node);
            return;
        }
        // If dataNode tool is active and we click an existing dataNode, open editor
        if (tool === 'dataNode' && node.tool === 'dataNode') {
            if (e) e.cancelBubble = true;
            setEditingTextNode(node);
            setEditingTextNodeId(node.id);
            setSelectedNodeIds([]);
            return;
        }
        // Normal selection
        if (e && e.evt && e.evt.shiftKey) {
            setSelectedNodeIds(prev =>
                prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]
            );
        } else {
            setSelectedNodeIds([node.id]);
        }
    };

    // Text Editing State
    const [editingTextNode, setEditingTextNode] = useState(null);

    useEffect(() => {
        // If we are in an AI special mode, those components manage the transformer.
        if (outpaintMode || magicEraserMode) return;

        if (selectedNodeIds.length > 0 && trRef.current && stageRef.current) {
            const nodes = selectedNodeIds.map(id => stageRef.current.findOne(`.${id}`)).filter(Boolean);
            if (nodes.length > 0) {
                trRef.current.nodes(nodes);
                trRef.current.getLayer().batchDraw();
            }
        } else if (trRef.current) {
            trRef.current.nodes([]);
            trRef.current.getLayer().batchDraw();
        }
    }, [selectedNodeIds, lines.length, outpaintMode, magicEraserMode]); // watch length so deleting a node clears the box

    const handleMouseDown = (e) => {
        // If the rich text editor is open, just ensure we don't accidentally start a new tool
        // while the editor might be in the middle of a save/close cycle from the document listener.
        const activeEditor = document.querySelector('.tw-rich-text-editor');
        if (activeEditor) {
            // Note: we don't call .blur() here anymore because RichTextEditor
            // handles its own saving via the document mousedown listener.
            // But we may want to stop propagation if clicking elsewhere to avoid new nodes.
            // return; // Let's see if this is needed
        }

        if (tool === 'pan') return;

        const isClickedOnTransformer = e.target.getParent()?.className === 'Transformer';
        if (isClickedOnTransformer) return;

        if (tool === 'select') {
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) {
                setSelectedNodeIds([]);
                // Start drag selection
                const pos = e.target.getStage().getRelativePointerPosition();
                setSelectionBox({
                    startX: pos.x,
                    startY: pos.y,
                    x: pos.x,
                    y: pos.y,
                    width: 0,
                    height: 0
                });
            } else {
                const id = e.target.name() || e.target.getParent()?.name();
                if (id) {
                    if (e.evt.shiftKey) {
                        setSelectedNodeIds(prev =>
                            prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
                        );
                    } else {
                        // If not shift clicking and node isn't already selected, select it exclusively
                        if (!selectedNodeIds.includes(id)) {
                            setSelectedNodeIds([id]);
                        }
                    }
                }
            }
            return;
        }

        if (tool === 'connector') {
            // If clicking on empty space, cancel any pending connection
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) {
                setPendingConnector(null);
            }
            // Node-level mousedown is handled by handleNodeInteraction
            return;
        }

        // If another tool is selected but we click on empty, deselect any active node first
        setSelectedNodeIds([]);

        // Don't spawn a new text node if we happen to be double-clicking an existing one
        if (tool === 'text') {
            const id = e.target.name() || e.target.getParent()?.name();
            if (id) {
                const node = lines.find(l => l.id === id);
                if (node && node.tool === 'text') {
                    const screenPos = e.target.absolutePosition();
                    setEditingTextNode({
                        ...node,
                        x: screenPos.x,
                        y: screenPos.y
                    });
                    setEditingTextNodeId(node.id);
                    setSelectedNodeIds([]);
                    return;
                }
            }
        }

        const point = e.target.getStage().getRelativePointerPosition();

        if (tool === 'polygon') {
            if (isDrawing) {
                if (e.evt.detail === 2) { // Double click
                    stopDrawing();
                    // Let the onBlur / useEffect handle broadcast if we needed to, or manually trigger here
                    // For polygons, the shape is only closed on double click, so broadcast here
                    const currentLines = useCanvasStore.getState().lines;
                    const finishedLine = currentLines[currentLines.length - 1];
                    if (finishedLine && finishedLine.closed && onStrokeComplete) {
                        onStrokeComplete(finishedLine);
                    }
                } else {
                    useCanvasStore.getState().addPolygonPoint(point);
                }
                return;
            }
        }

        if (tool === 'dataNode') {
            // Only create a new Data Node if clicking on empty canvas
            const clickedOnEmpty = e.target === e.target.getStage();
            if (!clickedOnEmpty) return;
            useCanvasStore.getState().addDataNode(point);
            // Broadcast the new Data Node over WebSocket
            const newDataNode = useCanvasStore.getState().lines[useCanvasStore.getState().lines.length - 1];
            if (newDataNode && onStrokeComplete) {
                onStrokeComplete(newDataNode);
            }
            setTool('select');
            return;
        }

        startDrawing(point);

        if (tool === 'text') {
            const absPos = e.target.getStage().getPointerPosition();
            const currentLines = useCanvasStore.getState().lines;
            const newNode = currentLines[currentLines.length - 1]; // The node we just spawned

            setEditingTextNode({
                ...newNode,
                x: absPos.x,
                y: absPos.y
            });
            setEditingTextNodeId(newNode.id);
            setSelectedNodeIds([]);
        }
    };

    const handleStageDblClick = (e) => {
        // Only trigger editor on text nodes
        const id = e.target.name() || e.target.getParent()?.name();
        if (id) {
            const node = lines.find(l => l.id === id);
            if (node && node.tool === 'text') {
                setEditingTextNode(node); // Use the original node with canvas x/y
                setEditingTextNodeId(node.id);
                setSelectedNodeIds([]);
            }
        }
    };

    // Snap state
    const holdTimeoutRef = useRef(null);
    const replaceLineWithShape = useCanvasStore((state) => state.replaceLineWithShape);
    const preferences = useCanvasStore((state) => state.preferences);

    const checkAndSnapShape = (points) => {
        // If disabled in preferences, don't attempt to snap
        if (!preferences.shapeRecognition) return false;

        // Convert flat [x, y, x, y] to [{X, Y}]
        if (points.length < 20) return false;

        const strokePoints = [];
        for (let i = 0; i < points.length; i += 2) {
            strokePoints.push({ X: points[i], Y: points[i + 1] });
        }

        // recognize
        const result = recognizer.Recognize(strokePoints, true);

        // Threshold: > 0.75 (75%)
        if (result.Score > 0.75 && result.Name !== "No match") {
            const lastLineIndex = lines.length - 1;
            const lastLine = lines[lastLineIndex];

            if (lastLine && lastLine.tool === 'pen') {
                // Calculate bounds
                const bounds = result.Bounds;
                // Shapes (Rect, Circle, Triangle) are drawn centered in Canvas.jsx
                const newNode = replaceLineWithShape(lastLine.id, result.Name, {
                    x: bounds.X + (bounds.Width / 2),
                    y: bounds.Y + (bounds.Height / 2),
                    width: bounds.Width,
                    height: bounds.Height
                });
                return newNode;
            }
        }
        return null;
    };


    const pendingConnector = useCanvasStore((state) => state.pendingConnector);
    const setPendingConnector = useCanvasStore((state) => state.setPendingConnector);

    const handleMouseMove = (e) => {
        if (tool === 'pan') return;

        if (tool === 'connector' && pendingConnector) {
            const stage = e.target.getStage();
            const point = stage.getRelativePointerPosition();
            setPendingConnector({ ...pendingConnector, x: point.x, y: point.y });
            return;
        }

        if (tool === 'select') {
            if (selectionBox) { //... existing select logic
                const pos = e.target.getStage().getRelativePointerPosition();
                setSelectionBox(prev => ({
                    ...prev,
                    x: Math.min(prev.startX, pos.x),
                    y: Math.min(prev.startY, pos.y),
                    width: Math.abs(pos.x - prev.startX),
                    height: Math.abs(pos.y - prev.startY)
                }));
            }
            return;
        }

        if (!isDrawing) return;
        const stage = e.target.getStage();
        const point = stage.getRelativePointerPosition();


        continueDrawing(point);

        // Geometric Snapping "Hold" timeout (500ms)
        if (tool === 'pen') {
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = setTimeout(() => {
                const currentLine = lines[lines.length - 1];
                if (currentLine && currentLine.tool === 'pen') {
                    const snappedNode = checkAndSnapShape(currentLine.points);
                    if (snappedNode) {
                        stopDrawing();
                        if (onStrokeComplete) {
                            onStrokeComplete(snappedNode);
                        }
                    }
                }
            }, 500);
        }
    };

    const handleMouseUp = (e) => {
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

        if (tool === 'pen' && isDrawing) {
            const currentLine = lines[lines.length - 1];
            if (currentLine && currentLine.tool === 'pen') {
                const snappedNode = checkAndSnapShape(currentLine.points);
                if (snappedNode) {
                    stopDrawing();
                    if (onStrokeComplete) {
                        onStrokeComplete(snappedNode);
                    }
                    return;
                }
            }
        }

        if (tool === 'select' && selectionBox) {
            // Find intersecting nodes
            const box = selectionRectRef.current?.getClientRect();
            if (box && stageRef.current) {
                const shapes = stageRef.current.find(node => {
                    if (node.getParent()?.className === 'Transformer' || node.className === 'Transformer' || node === selectionRectRef.current || node === stageRef.current) {
                        return false;
                    }
                    if (!node.name() || node.name() === 'selection-box') return false; // only selectable nodes

                    const itemBox = node.getClientRect();
                    // Basic bounding box intersection
                    return (
                        box.x < itemBox.x + itemBox.width &&
                        box.x + box.width > itemBox.x &&
                        box.y < itemBox.y + itemBox.height &&
                        box.y + box.height > itemBox.y
                    );
                });

                const ids = shapes.map(node => node.name()).filter(Boolean);
                setSelectedNodeIds([...new Set(ids)]);
            }
            setSelectionBox(null);
            return;
        }

        if (tool === 'connector' && pendingConnector) {
            // On mouseup, check if we released over a node
            const stage = e?.target?.getStage?.() || window.__stageRef;
            if (!stage) { setPendingConnector(null); return; }
            const pointerPos = stage.getRelativePointerPosition();

            // Find the data node we released over
            const targetNode = lines.find(n => {
                if (n.id === pendingConnector.fromId) return false;
                if (n.tool !== 'dataNode') return false; // Only connect to Data Nodes
                if (!n.width || !n.height) return false;
                return (
                    pointerPos.x >= n.x &&
                    pointerPos.x <= n.x + (n.width || 0) &&
                    pointerPos.y >= n.y &&
                    pointerPos.y <= n.y + (n.height || 0)
                );
            });

            if (targetNode) {
                const nearestPort = getNearestPort(targetNode, pointerPos);
                useCanvasStore.getState().addConnector(
                    pendingConnector.fromId, pendingConnector.fromPort,
                    targetNode.id, nearestPort.name
                );
                // Broadcast the new connector over WebSocket
                const allLines = useCanvasStore.getState().lines;
                const newConnector = allLines[allLines.length - 1];
                if (newConnector && onStrokeComplete) {
                    onStrokeComplete(newConnector);
                }
            }
            setPendingConnector(null);
            return;
        }

        if (tool === 'pan' || tool === 'select') return;

        // If we just clicked with the text tool, it spawned the node but we haven't typed yet. 
        // We shouldn't broadcast until the textarea blur event fires.
        if (tool === 'text') {
            stopDrawing();
            return;
        }

        // Prevent standard drag-release closure for polygon.
        // Polygons are closed via double-click in handleMouseDown.
        if (tool === 'polygon') return;

        stopDrawing();

        // Fire event to Board.jsx so it can broadcast via WebSocket
        if (onStrokeComplete && lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            onStrokeComplete(lastLine);
        }
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();

        const scaleBy = 1.05;
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        // Limit zoom
        if (newScale < 0.1 || newScale > 10) return;

        setStageConfig({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    // Generic transform and drag dispatcher
    const handleNodeChange = (id, newAttrs) => {
        updateNode(id, newAttrs);
        const node = lines.find((l) => l.id === id);
        if (node && onStrokeComplete) {
            onStrokeComplete({ ...node, ...newAttrs });
        }
    };

    // Live drag: update the store position on every drag move so connectors follow
    const handleLiveDrag = (e, nodeId) => {
        useCanvasStore.getState().updateNodePosition(nodeId, e.target.x(), e.target.y());
    };

    // New for Presence
    const cursors = useCanvasStore((state) => state.cursors);

    const handleDrop = async (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                try {
                    const { webpBlob } = await webpfy({
                        image: file,
                        quality: 85,
                        maxWidth: 2048,
                        maxHeight: 2048
                    });

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target.result;
                        const stage = stageRef.current;

                        let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

                        if (stage) {
                            stage.setPointersPositions(e);
                            const pointerPosition = stage.getPointerPosition();
                            if (pointerPosition) {
                                const stageTransform = stage.getAbsoluteTransform().copy();
                                stageTransform.invert();
                                pos = stageTransform.point(pointerPosition);
                            }
                        }

                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            let w = img.width;
                            let h = img.height;

                            // Scale down nicely
                            if (w > 800) {
                                const ratio = 800 / w;
                                w = 800;
                                h = h * ratio;
                            }

                            const newNode = {
                                id: `image-${Date.now()}-${Math.random()}`,
                                tool: 'image',
                                src: base64,
                                x: pos.x - w / 2,
                                y: pos.y - h / 2,
                                width: w,
                                height: h,
                                scaleX: 1,
                                scaleY: 1,
                                rotation: 0
                            };

                            addNode(newNode);
                            if (onStrokeComplete) {
                                onStrokeComplete(newNode);
                            }
                        };
                        img.src = base64;
                    };
                    reader.readAsDataURL(webpBlob);
                } catch (error) {
                    console.error("Failed to process image:", error);
                }
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
            <Stage
                width={window.innerWidth}
                height={window.innerHeight}
                ref={stageRef}
                x={stageConfig.x}
                y={stageConfig.y}
                scaleX={stageConfig.scale}
                scaleY={stageConfig.scale}
                draggable={tool === 'pan'}
                onDragEnd={(e) => {
                    if (e.target === stageRef.current) {
                        setStageConfig({
                            x: e.target.x(),
                            y: e.target.y()
                        });
                    }
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMousemove={(e) => {
                    handleMouseMove(e);
                    if (window.onPointerMove && stageRef.current) {
                        window.onPointerMove(stageRef.current.getRelativePointerPosition());
                    }
                }}
                onMouseup={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={(e) => {
                    handleMouseMove(e);
                    if (window.onPointerMove && stageRef.current) {
                        window.onPointerMove(stageRef.current.getRelativePointerPosition());
                    }
                }}
                onTouchEnd={handleMouseUp}
                onDblClick={handleStageDblClick}
                onDblTap={handleStageDblClick}
            >
                <Layer>
                    {lines.map((line, i) => {
                        if (line.tool === 'shape') {
                            let ShapeComponent = null;
                            let shapeProps = {};

                            if (line.shapeType === 'circle') {
                                ShapeComponent = Circle;
                                shapeProps = { radius: line.width / 2 };
                            } else if (line.shapeType === 'triangle') {
                                ShapeComponent = RegularPolygon;
                                shapeProps = { sides: 3, radius: line.width / 2 };
                            } else {
                                ShapeComponent = Rect;
                                shapeProps = {
                                    width: line.width,
                                    height: line.height,
                                    offsetX: line.width / 2, // Center it visually for rotation
                                    offsetY: line.height / 2
                                };
                            }

                            return (
                                <Group
                                    key={line.id || i}
                                    id={line.id}
                                    name={line.id}
                                    x={line.x}
                                    y={line.y}
                                    scaleX={line.scaleX || 1}
                                    scaleY={line.scaleY || 1}
                                    rotation={line.rotation || 0}
                                    opacity={line.opacity !== undefined ? line.opacity : 1}
                                    draggable={tool === 'select'}
                                    onClick={(e) => handleNodeInteraction(e, line)}
                                    onTap={(e) => handleNodeInteraction(e, line)}
                                    onDragMove={(e) => handleLiveDrag(e, line.id)}
                                    onDragEnd={(e) => {
                                        handleNodeChange(line.id, {
                                            x: e.target.x(),
                                            y: e.target.y()
                                        });
                                    }}
                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        handleNodeChange(line.id, {
                                            x: node.x(),
                                            y: node.y(),
                                            scaleX: node.scaleX(),
                                            scaleY: node.scaleY(),
                                            rotation: node.rotation()
                                        });
                                    }}
                                >
                                    <ShapeComponent
                                        {...shapeProps}
                                        stroke={line.color}
                                        strokeWidth={line.brushSize || 5}
                                        fill={line.fillColor || 'transparent'}
                                    />
                                </Group>
                            );
                        } else if (line.tool === 'text') {
                            return (
                                <RichText
                                    key={line.id || i}
                                    id={line.id}
                                    name={line.id}
                                    line={line}
                                    tool={tool}
                                    isEditing={editingTextNodeId === line.id}
                                    onSelect={(e) => handleNodeInteraction(e, line)}
                                    onEdit={(nodeToEdit) => {
                                        setEditingTextNode(nodeToEdit);
                                        setEditingTextNodeId(nodeToEdit.id);
                                        setSelectedNodeIds([]);
                                    }}
                                    onChange={handleNodeChange}
                                />
                            );
                        } else if (line.tool === 'dataNode') {
                            return (
                                <DataNode
                                    key={line.id || i}
                                    id={line.id}
                                    line={line}
                                    tool={tool}
                                    isEditing={editingTextNodeId === line.id}
                                    onSelect={(e) => handleNodeInteraction(e, line)}
                                    onEdit={(nodeToEdit) => {
                                        setEditingTextNode(nodeToEdit);
                                        setEditingTextNodeId(nodeToEdit.id);
                                        setSelectedNodeIds([]);
                                    }}
                                    onChange={handleNodeChange}
                                />
                            );
                        } else if (line.tool === 'connector') {
                            return (
                                <Connector
                                    key={line.id || i}
                                    line={line}
                                    lines={lines}
                                    tool={tool}
                                    onSelect={() => {
                                        if (tool === 'select') setSelectedNodeIds([line.id]);
                                    }}
                                    onChange={handleNodeChange}
                                />
                            );
                        } else if (line.tool === 'image') {
                            return (
                                <URLImage
                                    key={line.id || i}
                                    line={line}
                                    tool={tool}
                                    onSelect={(e) => handleNodeInteraction(e, line)}
                                    onChange={handleNodeChange}
                                />
                            );
                        }

                        return (
                            <Line
                                key={line.id || i}
                                id={line.id}
                                name={line.id}
                                points={line.points}
                                stroke={line.tool === 'eraser' ? '#0f172a' : (line.color || '#E2E8F0')}
                                strokeWidth={line.brushSize || 5}
                                tension={line.tool === 'polygon' ? 0 : 0.5}
                                closed={line.closed || false}
                                fill={line.closed ? (line.fillColor && line.fillColor !== 'transparent' ? line.fillColor : `${line.color}33`) : null}
                                lineCap="round"
                                lineJoin="round"
                                globalCompositeOperation={
                                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                }
                                x={line.x || 0}
                                y={line.y || 0}
                                scaleX={line.scaleX || 1}
                                scaleY={line.scaleY || 1}
                                rotation={line.rotation || 0}
                                opacity={line.opacity !== undefined ? line.opacity : 1}
                                draggable={tool === 'select'}
                                onClick={(e) => {
                                    if (tool === 'select') {
                                        const id = line.id;
                                        if (e.evt.shiftKey) {
                                            setSelectedNodeIds(prev =>
                                                prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
                                            );
                                        } else {
                                            setSelectedNodeIds([id]);
                                        }
                                    }
                                }}
                                onDragEnd={(e) => {
                                    handleNodeChange(line.id, {
                                        x: e.target.x(),
                                        y: e.target.y()
                                    });
                                }}
                                onTransformEnd={(e) => {
                                    const node = e.target;
                                    handleNodeChange(line.id, {
                                        x: node.x(),
                                        y: node.y(),
                                        scaleX: node.scaleX(),
                                        scaleY: node.scaleY(),
                                        rotation: node.rotation()
                                    });
                                }}
                            />
                        );
                    })}

                    {pendingConnector && (() => {
                        const fromNode = lines.find(n => n.id === pendingConnector.fromId);
                        if (!fromNode) return null;
                        const getPortPos = (node, portName) => {
                            const width = (node.width || 0) * (node.scaleX || 1);
                            const height = (node.height || 0) * (node.scaleY || 1);
                            let offsetX = width / 2, offsetY = height / 2;
                            if (portName === 'top') { offsetX = width / 2; offsetY = 0; }
                            if (portName === 'bottom') { offsetX = width / 2; offsetY = height; }
                            if (portName === 'left') { offsetX = 0; offsetY = height / 2; }
                            if (portName === 'right') { offsetX = width; offsetY = height / 2; }
                            const rad = (node.rotation || 0) * (Math.PI / 180);
                            const cos = Math.cos(rad), sin = Math.sin(rad);
                            const dx = offsetX - width / 2, dy = offsetY - height / 2;
                            return { x: (node.x || 0) + width / 2 + (dx * cos - dy * sin), y: (node.y || 0) + height / 2 + (dx * sin + dy * cos) };
                        };
                        const start = getPortPos(fromNode, pendingConnector.fromPort);
                        const endPos = { x: pendingConnector.x, y: pendingConnector.y };
                        const cpOffset = 80;
                        const cp1Offset = pendingConnector.fromPort === 'top' ? { dx: 0, dy: -cpOffset } :
                            pendingConnector.fromPort === 'bottom' ? { dx: 0, dy: cpOffset } :
                                pendingConnector.fromPort === 'left' ? { dx: -cpOffset, dy: 0 } :
                                    { dx: cpOffset, dy: 0 };
                        const cp1 = { x: start.x + cp1Offset.dx, y: start.y + cp1Offset.dy };
                        const cp2 = { x: (start.x + endPos.x) / 2, y: (start.y + endPos.y) / 2 };
                        return (
                            <Shape
                                sceneFunc={(context, shape) => {
                                    context.beginPath();
                                    context.moveTo(start.x, start.y);
                                    context.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPos.x, endPos.y);
                                    context.fillStrokeShape(shape);
                                }}
                                stroke="#4f46e5"
                                strokeWidth={2}
                                dash={[5, 5]}
                                lineCap="round"
                            />
                        );
                    })()}

                    {/* Render Remote Cursors */}
                    {Object.entries(cursors).map(([userId, payload]) => {
                        const { position, userDetails } = payload;
                        return (
                            <Group
                                key={userId}
                                x={position.x}
                                y={position.y}
                                scaleX={1 / stageConfig.scale}
                                scaleY={1 / stageConfig.scale}
                            >
                                {/* Standard web cursor SVG path */}
                                <Path
                                    data="M 0 0 L 12 12 L 6 13 L 0 20 Z"
                                    fill={userDetails?.color || '#EF4444'}
                                    shadowColor="black"
                                    shadowBlur={2}
                                    shadowOpacity={0.2}
                                />
                                {/* User Name Tag */}
                                <Text
                                    text={userDetails?.name || 'Anonymous'}
                                    x={15}
                                    y={15}
                                    fill="white"
                                    fontSize={12}
                                    padding={4}
                                />
                            </Group>
                        );
                    })}

                    {/* Render Selection Box */}
                    {selectionBox && (
                        <Rect
                            ref={selectionRectRef}
                            name="selection-box"
                            fill="rgba(59, 130, 246, 0.2)"
                            stroke="#3B82F6"
                            strokeWidth={1}
                            x={selectionBox.x}
                            y={selectionBox.y}
                            width={selectionBox.width}
                            height={selectionBox.height}
                        />
                    )}

                    {/* Transformer for selected nodes */}
                    {selectedNodeIds.length > 0 && (
                        <Transformer
                            ref={trRef}
                            boundBoxFunc={(oldBox, newBox) => {
                                // limit resize
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                return newBox;
                            }}
                        />
                    )}

                </Layer>
            </Stage>



            {editingTextNodeId && (
                <RichTextEditor
                    node={lines.find(l => l.id === editingTextNodeId) || editingTextNode}
                    stageScale={stageConfig.scale}
                    stagePos={{ x: stageConfig.x, y: stageConfig.y }}
                    onSave={(html, width, height) => {
                        handleNodeChange(editingTextNodeId, { html, width, height });
                        setEditingTextNode(null);
                        setEditingTextNodeId(null);
                        setSelectedNodeIds([editingTextNodeId]);
                    }}
                    onCancel={() => {
                        setEditingTextNode(null);
                        setEditingTextNodeId(null);
                        setSelectedNodeIds([editingTextNodeId]);
                    }}
                />
            )}
        </div>
    );
}
