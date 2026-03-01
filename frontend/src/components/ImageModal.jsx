import { useState } from 'react';
import useCanvasStore from '../store/canvasStore';

const MODELS = [
    { label: 'Stable Image Core', provider: 'stability', model: 'core' },
    { label: 'SDXL 1.0', provider: 'stability', model: 'stable-diffusion-xl-1024-v1-0' },
    { label: 'Stable Diffusion 3.5 Flash', provider: 'stability', model: 'sd3-large-turbo' },
    { label: 'Stable Diffusion 3.5 Medium', provider: 'stability', model: 'sd3-medium' },
    { label: 'Stable Diffusion 3.5 Large', provider: 'stability', model: 'sd3-large' },
    { label: 'Stable Image Ultra', provider: 'stability', model: 'ultra' },
    { label: 'Gemini 3.1 Flash Image', provider: 'openrouter', model: 'google/gemini-3.1-flash-image-preview' },
    { label: 'Gemini 3 Pro Image', provider: 'openrouter', model: 'google/gemini-3-pro-image-preview' },
    { label: 'Seedream 4.5', provider: 'openrouter', model: 'bytedance-seed/seedream-4.5' },
    { label: 'FLUX.2 Max', provider: 'openrouter', model: 'black-forest-labs/flux.2-max' },
    { label: 'FLUX.2 Flex', provider: 'openrouter', model: 'black-forest-labs/flux.2-flex' },
    { label: 'FLUX.2 Klein 4b', provider: 'openrouter', model: 'black-forest-labs/flux.2-klein-4b' },
    { label: 'FLUX.2 Pro', provider: 'openrouter', model: 'black-forest-labs/flux.2-pro' },
    { label: 'GPT-5 Image Mini', provider: 'openrouter', model: 'openai/gpt-5-image-mini' },
    { label: 'GPT-5 Image', provider: 'openrouter', model: 'openai/gpt-5-image' }
];

export default function ImageModal({ onImageAdded }) {
    const showModal = useCanvasStore((state) => state.showImageModal);
    const setShowModal = useCanvasStore((state) => state.setShowImageModal);
    const addNode = useCanvasStore((state) => state.addNode);

    const [prompt, setPrompt] = useState('');
    const [selectedModelIdx, setSelectedModelIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!showModal) return null;

    const generateImage = async (e) => {
        e.preventDefault();
        if (!prompt) return;

        setLoading(true);
        setError('');

        const selectedModel = MODELS[selectedModelIdx];

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/images/generate' : 'http://localhost:8000/api/v1/images/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prompt,
                    provider: selectedModel.provider,
                    model: selectedModel.model
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Image generation failed');
            }

            const data = await res.json();

            const newNode = {
                id: `img-${Date.now()}`,
                tool: 'image',
                src: data.image,
                x: window.innerWidth / 2 - 256,
                y: window.innerHeight / 2 - 256,
                width: 512,
                height: 512,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                opacity: 1
            };

            addNode(newNode);
            setShowModal(false);
            if (onImageAdded) {
                onImageAdded(newNode);
            }
            setPrompt('');

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tw-modal-overlay">
            <div className="tw-modal-content">
                <h3>Generate AI Image</h3>
                <form onSubmit={generateImage}>

                    <div style={{ marginBottom: '1rem' }}>
                        <select
                            className="tw-modal-textarea"
                            style={{ minHeight: 'auto', marginBottom: 0, padding: '0.5rem' }}
                            value={selectedModelIdx}
                            onChange={(e) => setSelectedModelIdx(Number(e.target.value))}
                            disabled={loading}
                        >
                            {MODELS.map((m, idx) => (
                                <option key={m.model} value={idx}>
                                    {m.label} ({m.provider === 'stability' ? 'Stability AI' : 'OpenRouter'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <textarea
                        className="tw-modal-textarea"
                        placeholder="A cute cat drinking coffee..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                    />

                    {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}

                    <div className="tw-modal-actions">
                        <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading || !prompt}>
                            {loading ? 'Generating...' : 'Generate Image'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
