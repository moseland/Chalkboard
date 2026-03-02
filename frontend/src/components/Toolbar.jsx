import { useState } from 'react';
import useCanvasStore from '../store/canvasStore';
import Konva from 'konva';
import { images } from '../api';
import {
    MousePointer2,
    Hand,
    Pencil,
    Eraser,
    Type,
    Sparkles,
    Square,
    Circle,
    Triangle,
    Pentagon,
    ChevronDown,
    Camera,
    Wand2,
    ImagePlus,
    Maximize,
    GitGraph,
    Activity
} from 'lucide-react';

export default function Toolbar() {
    const [showShapeMenu, setShowShapeMenu] = useState(false);
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [isProcessingAi, setIsProcessingAi] = useState(false);

    const tool = useCanvasStore((state) => state.tool);
    const color = useCanvasStore((state) => state.color);
    const fillColor = useCanvasStore((state) => state.fillColor);
    const brushSize = useCanvasStore((state) => state.brushSize);
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);

    const setTool = useCanvasStore((state) => state.setTool);
    const setColor = useCanvasStore((state) => state.setColor);
    const setFillColor = useCanvasStore((state) => state.setFillColor);
    const setBrushSize = useCanvasStore((state) => state.setBrushSize);
    const setShowStockModal = useCanvasStore((state) => state.setShowStockModal);
    const magicEraserMode = useCanvasStore((state) => state.magicEraserMode);
    const setMagicEraserMode = useCanvasStore((state) => state.setMagicEraserMode);
    const outpaintMode = useCanvasStore((state) => state.outpaintMode);
    const setOutpaintMode = useCanvasStore((state) => state.setOutpaintMode);
    const setShowMermaidModal = useCanvasStore((state) => state.setShowMermaidModal);

    const colors = ['#E2E8F0', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

    const handleSketchToRender = () => {
        if (!window.__stageRef || selectedNodeIds.length === 0) {
            alert("Please select some strokes to render first.");
            setShowAiMenu(false);
            return;
        }

        const stage = window.__stageRef;
        const transformer = stage.findOne('Transformer');
        if (!transformer) return;

        const box = transformer.getClientRect();

        transformer.visible(false);
        const selectionBox = stage.findOne('.selection-box');
        if (selectionBox) selectionBox.visible(false);
        stage.batchDraw();

        // Stage getClientRect includes the scale and position of stage.
        // Konva's toDataURL with x/y/width/height extracts raw pixels at that viewport box.
        const dataURL = stage.toDataURL({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: 2
        });

        transformer.visible(true);
        if (selectionBox) selectionBox.visible(true);
        stage.batchDraw();

        const stageConfig = useCanvasStore.getState().stageConfig;

        // We need the logical un-scaled coordinates for the new image node so it drops exactly in place
        // The box from getClientRect is in screen pixels.
        const logicalBox = {
            x: (box.x - stageConfig.x) / stageConfig.scale,
            y: (box.y - stageConfig.y) / stageConfig.scale,
            width: box.width / stageConfig.scale,
            height: box.height / stageConfig.scale
        };

        useCanvasStore.getState().setSketchPayload({
            image: dataURL,
            box: logicalBox,
            nodeIds: selectedNodeIds
        });
        useCanvasStore.getState().setShowSketchModal(true);
        setShowAiMenu(false);
    };

    const handleMagicEraserEntry = () => {
        const linesStore = useCanvasStore.getState().lines;
        const selectedNodes = linesStore.filter(l => selectedNodeIds.includes(l.id));
        const imageNode = selectedNodes.find(n => n.tool === 'image');

        if (!imageNode) return;

        setMagicEraserMode(true, imageNode.id);
        setShowAiMenu(false);
    };

    const handleOutpaintEntry = () => {
        const linesStore = useCanvasStore.getState().lines;
        const selectedNodes = linesStore.filter(l => selectedNodeIds.includes(l.id));
        const imageNode = selectedNodes.find(n => n.tool === 'image');

        if (!imageNode) return;

        setOutpaintMode(true, imageNode.id);
        setShowAiMenu(false);
    };

    return (
        <div className="tw-toolbar">
            <div className="tw-tool-group">
                <button
                    className={`tw-tool-btn ${tool === 'select' ? 'active' : ''}`}
                    onClick={() => setTool('select')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Select (V)"
                >
                    <MousePointer2 size={18} />
                </button>
                <button
                    className={`tw-tool-btn ${tool === 'pan' ? 'active' : ''}`}
                    onClick={() => setTool('pan')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Pan (H)"
                >
                    <Hand size={18} />
                </button>
                <div className="tw-divider" />
                <button
                    className={`tw-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                    onClick={() => setTool('pen')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Pen (P)"
                >
                    <Pencil size={18} />
                </button>
                <button
                    className={`tw-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                    onClick={() => setTool('eraser')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Eraser (E)"
                >
                    <Eraser size={18} />
                </button>
                <div className="tw-divider" />
                <div style={{ position: 'relative' }}>
                    <button
                        className={`tw-tool-btn ${['rectangle', 'circle', 'triangle', 'polygon'].includes(tool) ? 'active' : ''}`}
                        onClick={() => setShowShapeMenu(!showShapeMenu)}
                        disabled={magicEraserMode || outpaintMode}
                        title="Shapes"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        {tool === 'rectangle' ? <Square size={18} /> :
                            tool === 'circle' ? <Circle size={18} /> :
                                tool === 'triangle' ? <Triangle size={18} /> :
                                    tool === 'polygon' ? <Pentagon size={18} /> :
                                        <Square size={18} />}
                        <ChevronDown size={14} opacity={0.5} />
                    </button>
                    {showShapeMenu && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '0.5rem',
                            background: 'rgba(30, 41, 59, 0.95)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            zIndex: 100
                        }}>
                            <button
                                className={`tw-tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
                                onClick={() => { setTool('rectangle'); setShowShapeMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Square size={16} /> <span style={{ fontSize: '12px' }}>Rectangle</span>
                            </button>
                            <button
                                className={`tw-tool-btn ${tool === 'circle' ? 'active' : ''}`}
                                onClick={() => { setTool('circle'); setShowShapeMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Circle size={16} /> <span style={{ fontSize: '12px' }}>Circle</span>
                            </button>
                            <button
                                className={`tw-tool-btn ${tool === 'triangle' ? 'active' : ''}`}
                                onClick={() => { setTool('triangle'); setShowShapeMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Triangle size={16} /> <span style={{ fontSize: '12px' }}>Triangle</span>
                            </button>
                            <button
                                className={`tw-tool-btn ${tool === 'polygon' ? 'active' : ''}`}
                                onClick={() => { setTool('polygon'); setShowShapeMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Pentagon size={16} /> <span style={{ fontSize: '12px' }}>Polygon</span>
                            </button>
                        </div>
                    )}
                </div>
                <button
                    className={`tw-tool-btn ${tool === 'text' ? 'active' : ''}`}
                    onClick={() => setTool('text')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Text (T)"
                >
                    <Type size={18} />
                </button>
                <button
                    className={`tw-tool-btn ${tool === 'connector' ? 'active' : ''}`}
                    onClick={() => setTool('connector')}
                    disabled={magicEraserMode || outpaintMode}
                    title="Connector (C)"
                >
                    <GitGraph size={18} />
                </button>
                <div className="tw-divider" />
                <div style={{ position: 'relative' }}>
                    <button
                        className={`tw-tool-btn`}
                        onClick={() => setShowAiMenu(!showAiMenu)}
                        disabled={magicEraserMode || outpaintMode}
                        title="AI Tools"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Sparkles size={18} />
                        <ChevronDown size={14} opacity={0.5} />
                    </button>
                    {showAiMenu && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '0.5rem',
                            background: 'rgba(30, 41, 59, 0.95)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            zIndex: 100,
                            minWidth: '180px'
                        }}>
                            <button
                                className="tw-tool-btn"
                                onClick={() => { useCanvasStore.setState({ showImageModal: true }); setShowAiMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <ImagePlus size={16} /> <span style={{ fontSize: '12px' }}>Prompt to Image</span>
                            </button>
                            <button
                                className="tw-tool-btn"
                                onClick={handleSketchToRender}
                                disabled={isProcessingAi}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Wand2 size={16} /> <span style={{ fontSize: '12px' }}>Sketch to Render</span>
                            </button>
                            <button
                                className="tw-tool-btn"
                                onClick={handleMagicEraserEntry}
                                disabled={selectedNodeIds.length !== 1}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Eraser size={16} /> <span style={{ fontSize: '12px' }}>Magic Eraser</span>
                            </button>
                            <button
                                className="tw-tool-btn"
                                onClick={handleOutpaintEntry}
                                disabled={selectedNodeIds.length !== 1}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Maximize size={16} /> <span style={{ fontSize: '12px' }}>Outpaint / Expand</span>
                            </button>
                            <button
                                className="tw-tool-btn"
                                onClick={() => { setShowMermaidModal(true); setShowAiMenu(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', padding: '0.5rem 1rem' }}
                            >
                                <Activity size={16} /> <span style={{ fontSize: '12px' }}>Mermaid Diagram</span>
                            </button>
                        </div>
                    )}
                </div>
                <button
                    className="tw-tool-btn"
                    onClick={() => setShowStockModal(true)}
                    title="Search Stock Photos"
                >
                    <Camera size={18} />
                </button>
            </div>

            {(tool === 'pen' || tool === 'eraser') && (
                <>
                    <div className="tw-divider" />
                    <div className="tw-tool-group tw-brush-size-group">
                        <span className="tw-group-label">Size</span>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="tw-brush-range"
                        />
                        <span className="tw-size-value">{brushSize}</span>
                    </div>
                </>
            )}

            <div className="tw-divider" />

            <div className="tw-color-group">
                <div className="tw-color-subgroup">
                    <span className="tw-group-label-tiny">Stroke</span>
                    <div className="tw-color-list">
                        {colors.map((c) => (
                            <button
                                key={`stroke-${c}`}
                                className={`tw-color-swatch ${color === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                disabled={magicEraserMode}
                                onClick={() => {
                                    setColor(c);
                                    if (tool === 'eraser') setTool('pen');
                                }}
                            />
                        ))}
                        <div className="tw-custom-color-picker" title="Custom Color">
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => {
                                    setColor(e.target.value);
                                    if (tool === 'eraser') setTool('pen');
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="tw-divider" />

                <div className="tw-color-subgroup">
                    <span className="tw-group-label-tiny">Fill</span>
                    <div className="tw-color-list">
                        <button
                            className={`tw-color-swatch ${fillColor === 'transparent' ? 'active' : ''}`}
                            style={{
                                backgroundColor: '#1e293b',
                                border: '1px dashed #94a3b8'
                            }}
                            onClick={() => setFillColor('transparent')}
                            title="Transparent"
                        >
                            <div className="tw-transparent-swatch-bg" />
                        </button>
                        {colors.slice(0, 3).map((c) => (
                            <button
                                key={`fill-${c}`}
                                className={`tw-color-swatch ${fillColor === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setFillColor(c)}
                            />
                        ))}
                        <div className="tw-custom-color-picker" title="Custom Fill Color">
                            <input
                                type="color"
                                value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                                onChange={(e) => setFillColor(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
