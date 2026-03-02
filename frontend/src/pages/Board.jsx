import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Canvas from '../components/Canvas';
import Toolbar from '../components/Toolbar';
import ChatSidebar from '../components/ChatSidebar';
import ImageModal from '../components/ImageModal';
import ImageToolbar from '../components/ImageToolbar';
import TextToolbar from '../components/TextToolbar';
import ShapeToolbar from '../components/ShapeToolbar';
import MainMenu from '../components/MainMenu';
import SketchModal from '../components/SketchModal';
import StockPhotoModal from '../components/StockPhotoModal';
import PreferencesModal from '../components/PreferencesModal';
import MagicEraserOverlay from '../components/MagicEraserOverlay';
import OutpaintOverlay from '../components/OutpaintOverlay';
import CanvasStatus from '../components/CanvasStatus';
import ZoomControls from '../components/ZoomControls';
import ManageAccessModal from '../components/ManageAccessModal'; // Added import
import MermaidModal from '../components/MermaidModal';
import { boards, auth } from '../api';
import useCanvasStore from '../store/canvasStore';
import useChatStore from '../store/chatStore';

export default function Board() {
    const { id } = useParams();
    const navigate = useNavigate();
    const ws = useRef(null);

    const setInitialState = useCanvasStore(state => state.setInitialState);
    const setChatState = useChatStore(state => state.setMessages);
    const setAiActiveUntil = useChatStore(state => state.setAiActiveUntil);
    const showStockModal = useCanvasStore(state => state.showStockModal);
    const showMermaidModal = useCanvasStore(state => state.showMermaidModal);
    const setShowStockModal = useCanvasStore(state => state.setShowStockModal);
    const setShowMermaidModal = useCanvasStore(state => state.setShowMermaidModal);
    const [showAccessModal, setShowAccessModal] = useState(false); // Added state
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const initBoard = async () => {
            try {
                // 1. Fetch initial state from the REST API
                const res = await boards.get(id);
                if (!isMounted) return;

                setInitialState(res.data.canvas_data);

                // Hydrate chat history if it exists
                if (res.data.chat_history && Array.isArray(res.data.chat_history)) {
                    const currentUserId = String(userRes?.data?.id);
                    const hydratedHistory = res.data.chat_history.map(msg => ({
                        ...msg,
                        isSelf: msg.authorId === currentUserId
                    }));
                    setChatState(hydratedHistory);
                }

                // 2. Initialize WebSocket once the initial REST fetch passes
                const token = localStorage.getItem('token');
                if (!token) throw new Error("No auth token");

                // Construct WebSocket URL robustly from VITE_API_URL
                const getWsUrl = () => {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
                    if (apiUrl.startsWith('http')) {
                        return apiUrl.replace('http', 'ws');
                    }
                    // Handle relative path (e.g., /api/v1)
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const host = window.location.host;
                    return `${protocol}//${host}${apiUrl}`;
                };

                const wsUrl = getWsUrl();

                ws.current = new WebSocket(`${wsUrl}/ws/boards/${id}?token=${token}`);

                ws.current.onopen = () => {
                    console.log("WebSocket Connected");
                    setConnected(true);
                };

                ws.current.onerror = (err) => {
                    console.error("WebSocket Error:", err);
                };

                ws.current.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'stroke') {
                        // Incoming remote stroke or self-echo
                        useCanvasStore.setState(state => {
                            const existingIndex = state.lines.findIndex(l => l.id === data.payload.id);
                            if (existingIndex !== -1) {
                                // Update existing (e.g., our own stroke bouncing back)
                                const newLines = [...state.lines];
                                newLines[existingIndex] = { ...newLines[existingIndex], ...data.payload };
                                return { lines: newLines };
                            }
                            // Append new remote stroke
                            return { lines: [...state.lines, data.payload] };
                        });
                    } else if (data.type === 'presence') {
                        // User cursor
                        useCanvasStore.getState().updateCursor(
                            data.userId,
                            data.payload.position,
                            data.payload.userDetails
                        );
                    } else if (data.type === 'user_left') {
                        // User disconnects
                        useCanvasStore.getState().removeCursor(data.userId);
                    } else if (data.type === 'delete_node') {
                        // Remove nodes deleted by peers
                        useCanvasStore.setState(state => {
                            const newLines = state.lines.filter(l => !data.payload.nodeIds.includes(l.id));
                            return { lines: newLines };
                        });
                    } else if (data.type === 'reorder') {
                        // Resync local order to match authority/peer
                        useCanvasStore.setState(state => {
                            const idMap = {};
                            state.lines.forEach(l => idMap[l.id] = l);
                            const newLines = data.payload.nodeIds
                                .filter(id => idMap[id])
                                .map(id => idMap[id]);
                            return { lines: newLines };
                        });
                    } else if (data.type === 'clear') {
                        // Remote clear
                        useCanvasStore.setState({ lines: [] });
                    } else if (data.type === 'chat') {
                        // Incoming chat message
                        useChatStore.getState().addMessage(data.payload);

                        // If the AI included functional actions, coordinate execution
                        if (data.payload.action) {
                            const actions = Array.isArray(data.payload.action) ? data.payload.action : [data.payload.action];
                            const isRequester = data.payload.requesterId === String(userRes?.data?.id);

                            actions.forEach(action => {
                                // 1. Authoritative Drawing Actions:
                                // draw_shape, draw_text, clear_board, and update_node are now broadcasted 
                                // directly by the backend as standard 'stroke' or 'clear' events.
                                // We ignore them here to avoid duplication.
                                if (['draw_shape', 'draw_text', 'clear_board', 'update_node'].includes(action.action)) {
                                    return;
                                }

                                // 2. Heavy AI Tool Actions (Image Gen):
                                // We ONLY execute these if we are the user who triggered Igor.
                                // This prevents every connected client from calling the Stability API simultaneously.
                                if (['generate_image', 'sketch_to_image', 'structure_to_image'].includes(action.action)) {
                                    if (!isRequester) return;

                                    const executeImageGen = async () => {
                                        try {
                                            const token = localStorage.getItem('token');
                                            const isEdit = action.action !== 'generate_image';
                                            const endpoint = isEdit ? '/images/edit' : '/images/generate';
                                            const apiUrl = import.meta.env.VITE_API_URL
                                                ? import.meta.env.VITE_API_URL + endpoint
                                                : `http://localhost:8000/api/v1${endpoint}`;

                                            let imagePayload = null;
                                            if (isEdit) {
                                                if (window.__stageRef) {
                                                    imagePayload = window.__stageRef.toDataURL({
                                                        pixelRatio: 1,
                                                        mimeType: 'image/jpeg',
                                                        quality: 0.8
                                                    });
                                                } else {
                                                    throw new Error("Canvas stage not found for snapshot");
                                                }
                                            }

                                            const body = isEdit ? {
                                                image: imagePayload,
                                                prompt: action.prompt,
                                                task: action.action === 'sketch_to_image' ? 'sketch' : 'structure'
                                            } : {
                                                prompt: action.prompt,
                                                provider: 'stability',
                                                model: 'core'
                                            };

                                            const res = await fetch(apiUrl, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify(body)
                                            });

                                            if (!res.ok) throw new Error("AI Image Gen Failed");
                                            const result = await res.json();

                                            const newImg = {
                                                id: action.id || `img-${Date.now()}-${Math.random()}`,
                                                tool: 'image',
                                                src: result.image,
                                                x: action.x || window.innerWidth / 2 - 256,
                                                y: action.y || window.innerHeight / 2 - 256,
                                                width: action.width || 512,
                                                height: action.height || 512,
                                                scaleX: 1,
                                                scaleY: 1,
                                                rotation: 0,
                                                opacity: action.opacity !== undefined ? action.opacity : 1
                                            };

                                            // Drawing the image locally
                                            useCanvasStore.setState(state => ({
                                                lines: [...state.lines, newImg]
                                            }));

                                            // Broadcast the finished image to others
                                            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                                                ws.current.send(JSON.stringify({
                                                    type: 'stroke',
                                                    payload: newImg
                                                }));
                                            }
                                        } catch (err) {
                                            console.error("AI Image Generation Error:", err);
                                        }
                                    };
                                    executeImageGen();
                                }
                            });
                        }
                    }
                    else if (data.type === 'ai_active_state') {
                        // Igor's context-aware mode status
                        setAiActiveUntil(data.payload.expiresAt);
                    }
                };

                ws.current.onclose = () => {
                    console.log("WebSocket Disconnected");
                    setConnected(false);
                };

                // REST data loaded successfully, clear loading screen
                setLoading(false);

                // Attach global pointer move for presence
                let lastSent = 0;
                window.onPointerMove = (position) => {
                    const now = Date.now();
                    // Throttle to ~30fps (33ms) to save network
                    if (now - lastSent > 33 && ws.current && ws.current.readyState === WebSocket.OPEN) {
                        const user = userRes?.data;
                        if (!user) return;

                        ws.current.send(JSON.stringify({
                            type: 'presence',
                            payload: {
                                position,
                                userDetails: {
                                    name: user.display_name || user.email?.split('@')[0] || 'Unknown',
                                    color: '#3B82F6' // Temporary random blue for testing
                                }
                            }
                        }));
                        lastSent = now;
                    }
                };

            } catch (err) {
                console.error("Failed to load board", err);
                if (err.response?.status === 403) {
                    navigate('/dashboard');
                } else {
                    navigate('/dashboard');
                }
            }
        };

        let userRes;
        auth.me().then(res => {
            if (!isMounted) return;
            userRes = res;
            initBoard();
        }).catch(() => {
            if (!isMounted) return;
            navigate('/login');
        });

        return () => {
            isMounted = false;
            window.onPointerMove = null;
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [id, navigate, setInitialState, setShowStockModal]); // Added setShowStockModal to dependency array

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if user is typing in an input or textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                useCanvasStore.getState().copy();
            } else if (isMod && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                useCanvasStore.getState().paste();
            } else if (isMod && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (isMod && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                const selectedIds = useCanvasStore.getState().selectedNodeIds;
                if (selectedIds.length > 0) {
                    handleDeleteNodes(selectedIds);
                }
            } else if (e.key === '+' || e.key === '=') {
                useCanvasStore.getState().bringForward();
                handleReorder();
            } else if (e.key === '-') {
                useCanvasStore.getState().sendBackward();
                handleReorder();
            }
        };

        // Remove the local broadcastReorder and use the component level handleReorder instead
        // if needed, but the handleReorder is already defined in the component scope.
        // Actually, broadcastReorder was defined inside useEffect, let's just make it call handleReorder.


        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleUndo = () => {
        const prevLines = useCanvasStore.getState().undo();
        if (prevLines && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'clear' }));
            prevLines.forEach(line => {
                ws.current.send(JSON.stringify({ type: 'stroke', payload: line }));
            });
        }
    };

    const handleRedo = () => {
        const nextLines = useCanvasStore.getState().redo();
        if (nextLines && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'clear' }));
            nextLines.forEach(line => {
                ws.current.send(JSON.stringify({ type: 'stroke', payload: line }));
            });
        }
    };

    const handleStrokeComplete = (line) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'stroke',
                payload: line
            }));
        }
    };

    const handleDeleteNodes = (nodeIds) => {
        // Find connector lines that reference any of the deleted nodes
        const allLines = useCanvasStore.getState().lines;
        const connectorIdsToRemove = allLines
            .filter(l => l.tool === 'connector' && (nodeIds.includes(l.fromId) || nodeIds.includes(l.toId)))
            .map(l => l.id);
        const allIdsToRemove = [...new Set([...nodeIds, ...connectorIdsToRemove])];

        useCanvasStore.getState().deleteNodes(nodeIds);
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'delete_node',
                payload: {
                    nodeIds: allIdsToRemove
                }
            }));
        }
    };

    const handleUpdateNode = (id, newAttrs) => {
        const store = useCanvasStore.getState();
        store.updateNode(id, newAttrs);
        // Important: fetch fresh state after update to get the new lines array
        const updatedNode = useCanvasStore.getState().lines.find(l => l.id === id);
        if (updatedNode && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'stroke',
                payload: updatedNode
            }));
        }
    };

    const handleSendChatMessage = (text, modelId) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            // Optimistic local update
            const tempMessage = {
                text,
                authorId: 'me',
                authorName: 'Me',
                isSelf: true,
                isAi: false
            };
            useChatStore.getState().addMessage(tempMessage);

            let snapshot = null;
            if (text.includes('@igor')) {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    snapshot = canvas.toDataURL('image/jpeg', 0.5);
                }
            }

            let viewportData = null;
            if (window.__stageRef) {
                const stage = window.__stageRef;
                const scale = stage.scaleX();

                viewportData = {
                    centerX: Math.round((-stage.x() + window.innerWidth / 2) / scale),
                    centerY: Math.round((-stage.y() + window.innerHeight / 2) / scale),
                    width: Math.round(window.innerWidth / scale),
                    height: Math.round(window.innerHeight / scale)
                };
            }

            // Broadcast to others
            ws.current.send(JSON.stringify({
                type: 'chat',
                payload: {
                    text,
                    isAi: text.includes('@igor'),
                    snapshot: window.__stageRef ? window.__stageRef.toDataURL({ pixelRatio: 0.5 }) : null,
                    modelId: modelId || 'google/gemini-2.5-flash',
                    viewport: viewportData
                }
            }));
        }
    };

    const handleReorder = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const lines = useCanvasStore.getState().lines;
            ws.current.send(JSON.stringify({
                type: 'reorder',
                payload: { nodeIds: lines.map(l => l.id) }
            }));
        }
    };

    const handleClearBoard = () => {
        useCanvasStore.getState().saveHistory();
        useCanvasStore.setState({ lines: [] });
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'clear'
            }));
        }
    };

    if (loading) {
        return <div className="tw-app"><div className="tw-loading">Connecting to Board...</div></div>;
    }

    return (
        <div className="tw-board-layout">
            <Toolbar />
            <ImageToolbar onDelete={handleDeleteNodes} />
            <TextToolbar onDelete={handleDeleteNodes} />
            <ShapeToolbar onDelete={handleDeleteNodes} />
            <ImageModal onImageAdded={handleStrokeComplete} />
            <SketchModal onImageAdded={handleStrokeComplete} onDeleteNodes={handleDeleteNodes} />
            <PreferencesModal />
            <MainMenu
                onReorder={handleReorder}
                onClear={handleClearBoard}
                onImageImport={handleStrokeComplete}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onManageAccess={() => setShowAccessModal(true)}
            />
            <ManageAccessModal
                isOpen={showAccessModal}
                onClose={() => setShowAccessModal(false)}
                boardId={id}
            />
            <ChatSidebar onSendMessage={handleSendChatMessage} />
            <Canvas onStrokeComplete={handleStrokeComplete} onDeleteNodes={handleDeleteNodes} onUpdateNode={handleUpdateNode} />
            <StockPhotoModal
                isOpen={showStockModal}
                onClose={() => setShowStockModal(false)}
                onSelect={async (photo) => {
                    const newNode = await useCanvasStore.getState().addImageNode(photo.src.large);
                    if (newNode) handleStrokeComplete(newNode);
                    setShowStockModal(false);
                }}
            />
            <MagicEraserOverlay onDeleteNodes={handleDeleteNodes} onUpdateNode={handleUpdateNode} />
            <OutpaintOverlay onUpdateNode={handleUpdateNode} />
            {showMermaidModal && (
                <MermaidModal
                    onClose={() => setShowMermaidModal(false)}
                    onImageAdded={handleStrokeComplete}
                />
            )}
            <CanvasStatus />
            <ZoomControls />
        </div>
    );
}
