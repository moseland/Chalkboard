import { useState } from 'react';
import useCanvasStore from '../store/canvasStore';
import { images } from '../api';

export default function SketchModal({ onImageAdded, onDeleteNodes }) {
    const showModal = useCanvasStore((state) => state.showSketchModal);
    const setShowModal = useCanvasStore((state) => state.setShowSketchModal);
    const sketchPayload = useCanvasStore((state) => state.sketchPayload);
    const lines = useCanvasStore((state) => state.lines);

    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!showModal || !sketchPayload) return null;

    const generateRender = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await images.edit({
                image: sketchPayload.image,
                task: 'sketch',
                prompt: prompt || 'Refine this sketch'
            });

            if (res.data && res.data.image) {
                // 1. Delete original sketch strokes (synced)
                if (onDeleteNodes) onDeleteNodes(sketchPayload.nodeIds);

                // 2. Prepare the new image node
                const newNode = {
                    id: `img-${Date.now()}-${Math.random()}`,
                    tool: 'image',
                    src: res.data.image,
                    x: sketchPayload.box.x,
                    y: sketchPayload.box.y,
                    width: sketchPayload.box.width,
                    height: sketchPayload.box.height,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0
                };

                // 3. Add locally and broadcast (synced)
                useCanvasStore.getState().addNode(newNode);
                if (onImageAdded) onImageAdded(newNode);

                // 4. Cleanup modal state
                setShowModal(false);
                useCanvasStore.setState({
                    sketchPayload: null,
                    selectedNodeIds: [] // clear selection
                });
                setPrompt('');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || err.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setShowModal(false);
        useCanvasStore.setState({ sketchPayload: null });
        setPrompt('');
        setError('');
    };

    return (
        <div className="tw-modal-overlay">
            <div className="tw-modal-content">
                <h3>Sketch to Render</h3>

                <div style={{
                    width: '100%',
                    height: '200px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundImage: `url(${sketchPayload.image})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }} />

                <form onSubmit={generateRender}>
                    <textarea
                        className="tw-modal-textarea"
                        placeholder="Describe the final image (e.g. A modern beachfront house with large glass windows)..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                    />

                    {error && <div style={{ color: '#ef4444', marginTop: '10px', fontSize: '14px' }}>{error}</div>}

                    <div className="tw-modal-actions">
                        <button type="button" className="btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Rendering...' : 'Render Image'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
