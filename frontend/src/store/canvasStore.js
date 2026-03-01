import { create } from 'zustand';

const useCanvasStore = create((set) => ({
    lines: [],
    tool: 'select',
    color: '#E2E8F0', // text-light
    fillColor: 'transparent',
    brushSize: 5,
    isDrawing: false,
    selectedNodeIds: [],
    showSketchModal: false,
    magicEraserMode: false,
    magicEraserTargetId: null,
    magicEraserStrokeIds: [],
    outpaintMode: false,
    outpaintTargetId: null,
    isProcessing: false,
    processingMessage: '',
    preferences: {
        shapeRecognition: true
    },
    stageConfig: { x: 0, y: 0, scale: 1 },
    history: [],
    future: [],
    clipboard: [],

    setShowPreferencesModal: (show) => set({ showPreferencesModal: show }),
    updatePreferences: (newPrefs) => set((state) => ({ preferences: { ...state.preferences, ...newPrefs } })),
    setShowSketchModal: (show) => set({ showSketchModal: show }),
    setSketchPayload: (payload) => set({ sketchPayload: payload }),
    setMagicEraserMode: (active, targetId = null) => set((state) => {
        if (!active && state.magicEraserMode) {
            // If we are cancelling, delete all strokes drawn in this mode
            const newLines = state.lines.filter(l => !state.magicEraserStrokeIds.includes(l.id));
            return {
                magicEraserMode: false,
                magicEraserTargetId: null,
                magicEraserStrokeIds: [],
                lines: newLines,
                tool: 'select'
            };
        }
        return {
            magicEraserMode: active,
            magicEraserTargetId: targetId,
            magicEraserStrokeIds: [],
            // When entering mode, switch to pen and black color
            ...(active ? { tool: 'pen', color: '#000000', selectedNodeIds: [] } : {})
        };
    }),
    addMagicEraserStroke: (id) => set((state) => ({
        magicEraserStrokeIds: [...state.magicEraserStrokeIds, id]
    })),
    setProcessing: (isProcessing, message = '') => set({ isProcessing, processingMessage: message }),
    setOutpaintMode: (active, targetId = null) => set({
        outpaintMode: active,
        outpaintTargetId: targetId,
        tool: active ? 'select' : 'select' // Ensure select tool is active
    }),

    saveHistory: (snapshot = null) => set((state) => ({
        history: [...state.history, JSON.stringify(snapshot || state.lines)].slice(-50),
        future: []
    })),

    undo: () => {
        let result = null;
        set((state) => {
            if (state.history.length === 0) return state;
            const previous = JSON.parse(state.history[state.history.length - 1]);
            const newHistory = state.history.slice(0, -1);
            result = previous;
            return {
                lines: previous,
                history: newHistory,
                future: [JSON.stringify(state.lines), ...state.future]
            };
        });
        return result;
    },

    redo: () => {
        let result = null;
        set((state) => {
            if (state.future.length === 0) return state;
            const next = JSON.parse(state.future[0]);
            const newFuture = state.future.slice(1);
            result = next;
            return {
                lines: next,
                history: [...state.history, JSON.stringify(state.lines)],
                future: newFuture
            };
        });
        return result;
    },

    copy: () => set((state) => {
        if (state.selectedNodeIds.length === 0) return state;
        const selectedNodes = state.lines.filter(l => state.selectedNodeIds.includes(l.id));
        return { clipboard: JSON.parse(JSON.stringify(selectedNodes)) };
    }),

    paste: () => set((state) => {
        if (state.clipboard.length === 0) return state;

        useCanvasStore.getState().saveHistory();

        const newNodes = state.clipboard.map(node => ({
            ...node,
            id: `${node.tool}-${Date.now()}-${Math.random()}`,
            x: (node.x || 0) + 20,
            y: (node.y || 0) + 20
        }));

        return {
            lines: [...state.lines, ...newNodes],
            selectedNodeIds: newNodes.map(n => n.id)
        };
    }),

    bringForward: () => set((state) => {
        if (state.selectedNodeIds.length === 0) return state;

        useCanvasStore.getState().saveHistory();
        const newLines = [...state.lines];

        // Move each selected node up by 1 index if possible
        // We process from end to start to avoid overwriting moves
        const indices = state.selectedNodeIds
            .map(id => newLines.findIndex(l => l.id === id))
            .filter(idx => idx !== -1)
            .sort((a, b) => b - a);

        for (const idx of indices) {
            if (idx < newLines.length - 1) {
                [newLines[idx], newLines[idx + 1]] = [newLines[idx + 1], newLines[idx]];
            }
        }
        return { lines: newLines };
    }),

    sendBackward: () => set((state) => {
        if (state.selectedNodeIds.length === 0) return state;

        useCanvasStore.getState().saveHistory();
        const newLines = [...state.lines];

        const indices = state.selectedNodeIds
            .map(id => newLines.findIndex(l => l.id === id))
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b);

        for (const idx of indices) {
            if (idx > 0) {
                [newLines[idx], newLines[idx - 1]] = [newLines[idx - 1], newLines[idx]];
            }
        }
        return { lines: newLines };
    }),

    bringToFront: () => set((state) => {
        if (state.selectedNodeIds.length === 0) return state;

        useCanvasStore.getState().saveHistory();
        const selected = state.lines.filter(l => state.selectedNodeIds.includes(l.id));
        const remaining = state.lines.filter(l => !state.selectedNodeIds.includes(l.id));

        return { lines: [...remaining, ...selected] };
    }),

    sendToBack: () => set((state) => {
        if (state.selectedNodeIds.length === 0) return state;

        useCanvasStore.getState().saveHistory();
        const selected = state.lines.filter(l => state.selectedNodeIds.includes(l.id));
        const remaining = state.lines.filter(l => !state.selectedNodeIds.includes(l.id));

        return { lines: [...selected, ...remaining] };
    }),

    setTool: (tool) => set({ tool }),
    setColor: (color) => set({ color }),
    setFillColor: (color) => set({ fillColor: color }),
    setBrushSize: (brushSize) => set({ brushSize }),
    setSelectedNodeIds: (idsOrUpdater) => set((state) => {
        const newSelectedNodeIds = typeof idsOrUpdater === 'function' ? idsOrUpdater(state.selectedNodeIds) : idsOrUpdater;
        return {
            selectedNodeIds: newSelectedNodeIds
        };
    }),
    editingTextNodeId: null,
    setEditingTextNodeId: (id) => set({ editingTextNodeId: id }),

    replaceLineWithShape: (lineId, shapeType, bounds) => {
        let newNode = null;
        useCanvasStore.getState().saveHistory();
        set((state) => {
            const newLines = state.lines.map(line => {
                if (line.id === lineId) {
                    newNode = {
                        id: `shape-${Date.now()}-${Math.random()}`,
                        tool: 'shape',
                        shapeType: shapeType,
                        color: line.color,
                        fillColor: line.fillColor || 'transparent',
                        brushSize: line.brushSize,
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                        scaleX: 1,
                        scaleY: 1,
                        rotation: 0,
                        opacity: line.opacity !== undefined ? line.opacity : 1
                    };
                    return newNode;
                }
                return line;
            });

            return {
                lines: newLines,
                history: [...state.history, JSON.stringify(newLines)].slice(-50),
                future: []
            };
        });
        return newNode;
    },
    setShowImageModal: (show) => set({ showImageModal: show }),
    setShowStockModal: (show) => set({ showStockModal: show }),
    setStageConfig: (config) => set((state) => ({
        stageConfig: { ...state.stageConfig, ...config }
    })),

    startDrawing: (point) => {
        useCanvasStore.getState().saveHistory();
        const id = `line-${Date.now()}-${Math.random()}`;

        if (['rectangle', 'circle', 'triangle'].includes(useCanvasStore.getState().tool)) {
            set((state) => ({
                isDrawing: true,
                selectedNodeIds: [],
                lines: [...state.lines, {
                    id,
                    tool: 'shape',
                    shapeType: state.tool,
                    color: state.color,
                    fillColor: state.fillColor,
                    x: point.x,
                    y: point.y,
                    width: 0,
                    height: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                }]
            }));
        } else if (useCanvasStore.getState().tool === 'polygon') {
            set((state) => ({
                isDrawing: true,
                selectedNodeIds: [],
                lines: [...state.lines, {
                    id,
                    tool: 'polygon',
                    color: state.color,
                    fillColor: state.fillColor,
                    brushSize: state.brushSize,
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    points: [point.x, point.y, point.x, point.y], // First point locked, second is the floating cursor anchor
                    closed: false
                }]
            }));
        } else if (useCanvasStore.getState().tool === 'text') {
            set((state) => ({
                isDrawing: false,
                selectedNodeIds: [id],
                lines: [...state.lines, {
                    id,
                    tool: 'text',
                    text: 'Type here...',
                    html: 'Type here...',
                    fontSize: 32,
                    color: state.color,
                    x: point.x,
                    y: point.y,
                    width: 400, // Default width for wrapping
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                }]
            }));
        } else {
            set((state) => ({
                isDrawing: true,
                selectedNodeIds: [], // Deselect on draw start
                lines: [...state.lines, {
                    id,
                    tool: state.tool,
                    color: state.color,
                    brushSize: state.tool === 'eraser' ? state.brushSize * 4 : state.brushSize,
                    points: [point.x, point.y],
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                }]
            }));
        }
    },



    continueDrawing: (point) => set((state) => {
        if (!state.isDrawing) return state;

        const lastLineIndex = state.lines.length - 1;
        const lastLine = state.lines[lastLineIndex];

        if (lastLine.tool === 'shape') {
            lastLine.width = Math.max(5, Math.abs(point.x - lastLine.x) * 2);
            if (lastLine.shapeType === 'circle' || lastLine.shapeType === 'triangle') {
                lastLine.height = lastLine.width;
            } else {
                lastLine.height = Math.max(5, Math.abs(point.y - lastLine.y) * 2);
            }
        } else if (lastLine.tool === 'polygon') {
            // Update the very last [x,y] coordinates to follow the mouse cursor
            lastLine.points[lastLine.points.length - 2] = point.x;
            lastLine.points[lastLine.points.length - 1] = point.y;
        } else {
            // Mutate for performance (standard Konva practice)
            lastLine.points = lastLine.points.concat([point.x, point.y]);
        }

        const newLines = [...state.lines];
        newLines.splice(lastLineIndex, 1, lastLine);

        return { lines: newLines };
    }),

    updateNode: (id, newAttrs) => {
        useCanvasStore.getState().saveHistory();
        set((state) => {
            const lines = state.lines.slice();
            const nodeIndex = lines.findIndex(l => l.id === id);
            if (nodeIndex !== -1) {
                lines[nodeIndex] = { ...lines[nodeIndex], ...newAttrs };
            }
            return { lines };
        });
    },

    addPolygonPoint: (point) => set((state) => {
        if (!state.isDrawing || state.tool !== 'polygon') return state;

        const newLines = [...state.lines];
        const lastIndex = newLines.length - 1;
        const lastLine = { ...newLines[lastIndex] };

        // The current floating point becomes a fixed corner, so we append a new floating point exactly where we are
        lastLine.points = [...lastLine.points, point.x, point.y];
        newLines[lastIndex] = lastLine;

        return { lines: newLines };
    }),

    stopDrawing: () => set((state) => {
        if (!state.isDrawing) return state;

        if (state.tool === 'polygon') {
            const newLines = [...state.lines];
            const lastIndex = newLines.length - 1;
            const polLine = { ...newLines[lastIndex] };

            if (polLine.points.length >= 6) {
                polLine.points = polLine.points.slice(0, -2);
                polLine.closed = true;
                newLines[lastIndex] = polLine;
            } else {
                newLines.pop();
            }

            return {
                isDrawing: false,
                lines: newLines
            };
        }

        const isMagicEraser = state.magicEraserMode;
        const lastLineId = state.lines[state.lines.length - 1]?.id;

        return {
            isDrawing: false,
            magicEraserStrokeIds: isMagicEraser && lastLineId ? [...state.magicEraserStrokeIds, lastLineId] : state.magicEraserStrokeIds
        };
    }),

    deleteNodes: (ids) => {
        useCanvasStore.getState().saveHistory();
        set((state) => ({
            lines: state.lines.filter(l => !ids.includes(l.id)),
            selectedNodeIds: state.selectedNodeIds.filter(id => !ids.includes(id))
        }));
    },

    addNode: (node) => {
        useCanvasStore.getState().saveHistory();
        set((state) => ({
            lines: [...state.lines, { id: `node-${Date.now()}-${Math.random()}`, ...node }]
        }));
    },

    addImageNode: (src, x, y) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Fix Tainted Canvas error
            img.onload = () => {
                const maxDim = 800;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width *= ratio;
                    height *= ratio;
                }

                const newNode = {
                    tool: 'image',
                    src,
                    x: x !== undefined ? x : (window.innerWidth / 2 - width / 2),
                    y: y !== undefined ? y : (window.innerHeight / 2 - height / 2),
                    width,
                    height,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                };

                const nodeWithId = { id: `image-pexel-${Date.now()}-${Math.random()}`, ...newNode };
                useCanvasStore.getState().addNode(nodeWithId);
                resolve(nodeWithId);
            };
            img.src = src;
        });
    },

    setInitialState: (data) => {
        if (data && data.shapes) {
            set({ lines: data.shapes });
        }
    },

    cursors: {},
    updateCursor: (userId, position, userDetails) => set((state) => ({
        cursors: {
            ...state.cursors,
            [userId]: { position, userDetails }
        }
    })),
    removeCursor: (userId) => set((state) => {
        const newCursors = { ...state.cursors };
        delete newCursors[userId];
        return { cursors: newCursors };
    })
}));

export default useCanvasStore;
