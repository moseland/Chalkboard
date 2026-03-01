import useCanvasStore from '../store/canvasStore';
import { Loader2 } from 'lucide-react';

export default function CanvasStatus() {
    const isProcessing = useCanvasStore((state) => state.isProcessing);
    const message = useCanvasStore((state) => state.processingMessage);

    if (!isProcessing) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            padding: '8px 16px',
            borderRadius: '100px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 1001,
            pointerEvents: 'none', // Don't block clicking through
            animation: 'tw-fade-in 0.3s ease-out'
        }}>
            <Loader2 size={16} className="tw-spin" style={{ color: '#3b82f6' }} />
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{message || 'AI is thinking...'}</span>

            <style>{`
                @keyframes tw-fade-in {
                    from { opacity: 0; transform: translate(-50%, -10px); }
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
