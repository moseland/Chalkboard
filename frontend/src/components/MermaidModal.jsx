import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { X, Check } from 'lucide-react';
import useCanvasStore from '../store/canvasStore';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
});

export default function MermaidModal({ onClose, onImageAdded }) {
    const [code, setCode] = useState('graph TD\nA[Start] --> B{Is it working?}\nB -- Yes --> C[Great!]\nB -- No --> D[Debug]');
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');
    const previewRef = useRef(null);

    const addNode = useCanvasStore((state) => state.addNode);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!code.trim()) {
                setSvg('');
                setError('');
                return;
            }
            try {
                // Clear any potential previous error
                setError('');
                const id = `mermaid-${Date.now()}`;

                // We need to catch errors from mermaid.render
                try {
                    const { svg: renderedSvg } = await mermaid.render(id, code);
                    setSvg(renderedSvg);
                } catch (renderErr) {
                    console.error("Mermaid render error inner:", renderErr);
                    setError('Invalid Mermaid syntax');
                }
            } catch (err) {
                console.error("Mermaid render error outer:", err);
                setError('Invalid Mermaid syntax');
            }
        };

        const timeout = setTimeout(renderDiagram, 500);
        return () => clearTimeout(timeout);
    }, [code]);

    const handleInsert = () => {
        if (!svg) return;

        // Convert SVG to data URL for Konva
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = async () => {
            const newNode = {
                id: `mermaid-${Date.now()}-${Math.random()}`,
                tool: 'image',
                src: url,
                x: window.innerWidth / 2 - img.width / 2,
                y: window.innerHeight / 2 - img.height / 2,
                width: img.width,
                height: img.height,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                opacity: 1
            };

            // Add to store
            useCanvasStore.getState().addNode(newNode);

            // Broadcast
            if (onImageAdded) {
                onImageAdded(newNode);
            }

            onClose();
        };
        img.src = url;
    };

    return (
        <div className="tw-modal-overlay">
            <div className="tw-modal-content mermaid-modal" style={{ width: '80%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="tw-modal-header">
                    <h3>Insert Diagram (Mermaid)</h3>
                    <button className="tw-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flex: 1, gap: '1rem', minHeight: 0, padding: '1rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '12px', color: '#94a3b8' }}>Mermaid Syntax</label>
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            style={{
                                flex: 1,
                                background: '#0f172a',
                                color: '#e2e8f0',
                                border: '1px solid #334155',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                fontFamily: 'monospace',
                                resize: 'none'
                            }}
                        />
                        {error && <span style={{ color: '#ef4444', fontSize: '12px' }}>{error}</span>}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '12px', color: '#94a3b8' }}>Preview</label>
                        <div
                            ref={previewRef}
                            style={{
                                flex: 1,
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                overflow: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    </div>
                </div>

                <div className="tw-modal-footer">
                    <button className="tw-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="tw-btn-primary" onClick={handleInsert} disabled={!!error || !svg}>
                        <Check size={18} style={{ marginRight: '8px' }} /> Insert Diagram
                    </button>
                </div>
            </div>
        </div>
    );
}
