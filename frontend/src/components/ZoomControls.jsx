import useCanvasStore from '../store/canvasStore';
import { Plus, Minus, Search } from 'lucide-react';

export default function ZoomControls() {
    const stageConfig = useCanvasStore((state) => state.stageConfig);
    const setStageConfig = useCanvasStore((state) => state.setStageConfig);

    const handleZoom = (delta) => {
        const stage = window.__stageRef;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = delta > 0 ? oldScale * 1.1 : oldScale / 1.1;

        if (newScale < 0.1 || newScale > 10) return;

        setStageConfig({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    const handleResetZoom = () => {
        const stage = window.__stageRef;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = 1;

        setStageConfig({
            scale: newScale,
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        });
    };

    const zoomPercent = Math.round(stageConfig.scale * 100);

    return (
        <div className="tw-zoom-controls">
            <button
                className="tw-zoom-btn"
                onClick={() => handleZoom(-1)}
                title="Zoom Out"
            >
                <Minus size={16} />
            </button>
            <button
                className="tw-zoom-info"
                onClick={handleResetZoom}
                title="Reset Zoom to 100%"
            >
                {zoomPercent}%
            </button>
            <button
                className="tw-zoom-btn"
                onClick={() => handleZoom(1)}
                title="Zoom In"
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
