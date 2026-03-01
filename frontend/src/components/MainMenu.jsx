import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Undo2, Redo2, Download, Image as ImageIcon, Trash2, X, Square, Copy, Clipboard, Layers, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Home, Settings, UserPlus } from 'lucide-react';
import useCanvasStore from '../store/canvasStore';

export default function MainMenu({ onReorder, onClear, onImageImport, onUndo, onRedo, onManageAccess }) {
    const [isOpen, setIsOpen] = useState(false);
    const {
        lines, undo, redo, history, future, selectedNodeIds,
        copy, paste, clipboard, bringForward, sendBackward,
        bringToFront, sendToBack, setShowPreferencesModal
    } = useCanvasStore();
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleCloseCanvas = () => {
        navigate('/dashboard');
    };

    const handleUndo = (e) => {
        e.stopPropagation();
        if (onUndo) onUndo();
        else undo();
    };

    const handleRedo = (e) => {
        e.stopPropagation();
        if (onRedo) onRedo();
        else redo();
    };

    const handleCopy = (e) => {
        e.stopPropagation();
        copy();
        setIsOpen(false);
    };

    const handlePaste = (e) => {
        e.stopPropagation();
        paste();
        setIsOpen(false);
    };

    const handleBringForward = (e) => {
        e.stopPropagation();
        bringForward();
        if (onReorder) onReorder();
    };

    const handleSendBackward = (e) => {
        e.stopPropagation();
        sendBackward();
        if (onReorder) onReorder();
    };

    const handleBringToFront = (e) => {
        e.stopPropagation();
        bringToFront();
        if (onReorder) onReorder();
    };

    const handleSendToBack = (e) => {
        e.stopPropagation();
        sendToBack();
        if (onReorder) onReorder();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
        setIsOpen(false);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const src = event.target.result;
                const newNode = await useCanvasStore.getState().addImageNode(src);
                if (newNode && onImageImport) {
                    onImageImport(newNode);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExportCanvas = () => {
        if (!window.__stageRef) return;
        const stage = window.__stageRef;
        const transformer = stage.findOne('Transformer');
        const selectionBox = stage.findOne('.selection-box');

        if (transformer) transformer.visible(false);
        if (selectionBox) selectionBox.visible(false);
        stage.batchDraw();

        const dataURL = stage.toDataURL({
            pixelRatio: 2,
            mimeType: 'image/png'
        });

        if (transformer) transformer.visible(true);
        if (selectionBox) selectionBox.visible(true);
        stage.batchDraw();

        downloadURI(dataURL, 'chalkboard-export.png');
        setIsOpen(false);
    };

    const handleExportSelected = () => {
        if (!window.__stageRef || selectedNodeIds.length === 0) return;

        const stage = window.__stageRef;
        const transformer = stage.findOne('Transformer');
        if (!transformer) return;

        const box = transformer.getClientRect();

        transformer.visible(false);
        const selectionBox = stage.findOne('.selection-box');
        if (selectionBox) selectionBox.visible(false);
        stage.batchDraw();

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

        downloadURI(dataURL, 'chalkboard-selection.png');
        setIsOpen(false);
    };

    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear the entire board? This can be undone.')) {
            if (onClear) onClear();
            setIsOpen(false);
        }
    };

    const downloadURI = (uri, name) => {
        const link = document.createElement('a');
        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="tw-main-menu-container">
            <button
                className={`tw-menu-toggle ${isOpen ? 'active' : ''}`}
                onClick={toggleMenu}
                title="Main Menu"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {isOpen && (
                <div className="tw-menu-flyout">
                    <button onClick={handleUndo} disabled={history.length === 0} title="Undo">
                        <Undo2 size={18} />
                        <span>Undo</span>
                    </button>
                    <button onClick={handleRedo} disabled={future.length === 0} title="Redo">
                        <Redo2 size={18} />
                        <span>Redo</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={handleCopy} disabled={selectedNodeIds.length === 0} title="Copy Selected">
                        <Copy size={18} />
                        <span>Copy</span>
                    </button>

                    <button onClick={handlePaste} disabled={clipboard.length === 0} title="Paste Clipboard">
                        <Clipboard size={18} />
                        <span>Paste</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={handleBringForward} disabled={selectedNodeIds.length === 0} title="Bring Forward">
                        <ArrowUp size={18} />
                        <span>Bring Forward</span>
                    </button>

                    <button onClick={handleSendBackward} disabled={selectedNodeIds.length === 0} title="Send Backward">
                        <ArrowDown size={18} />
                        <span>Send Backward</span>
                    </button>

                    <button onClick={handleBringToFront} disabled={selectedNodeIds.length === 0} title="Bring to Front">
                        <ArrowUpToLine size={18} />
                        <span>Bring to Front</span>
                    </button>

                    <button onClick={handleSendToBack} disabled={selectedNodeIds.length === 0} title="Send to Back">
                        <ArrowDownToLine size={18} />
                        <span>Send to Back</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={handleImportClick} title="Import Image">
                        <ImageIcon size={18} />
                        <span>Import Image</span>
                    </button>

                    <button onClick={handleExportCanvas} title="Export Full Canvas">
                        <Download size={18} />
                        <span>Export Canvas</span>
                    </button>

                    <button
                        onClick={handleExportSelected}
                        disabled={selectedNodeIds.length === 0}
                        title="Export Selected"
                    >
                        <Square size={18} />
                        <span>Export Selected</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={handleClear} className="danger" title="Clear Board">
                        <Trash2 size={18} />
                        <span>Clear Board</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={() => { setShowPreferencesModal(true); setIsOpen(false); }} title="Preferences & Settings">
                        <Settings size={18} />
                        <span>Preferences</span>
                    </button>

                    <button
                        onClick={() => {
                            onManageAccess();
                            setIsOpen(false);
                        }}
                        title="Manage Access"
                    >
                        <UserPlus size={18} />
                        <span>Manage Access</span>
                    </button>

                    <div className="tw-menu-divider" />

                    <button onClick={handleCloseCanvas} title="Close Canvas & Return to Dashboard">
                        <Home size={18} />
                        <span>Close Canvas</span>
                    </button>
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
}
