import React from 'react';
import useCanvasStore from '../store/canvasStore';
import { Settings } from 'lucide-react';

export default function PreferencesModal() {
    const showModal = useCanvasStore((state) => state.showPreferencesModal);
    const setShowModal = useCanvasStore((state) => state.setShowPreferencesModal);
    const preferences = useCanvasStore((state) => state.preferences);
    const updatePreferences = useCanvasStore((state) => state.updatePreferences);

    if (!showModal) return null;

    return (
        <div className="tw-modal-overlay">
            <div className="tw-modal-content" style={{ maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Settings size={20} />
                    <h3 style={{ margin: 0 }}>Preferences</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={preferences.shapeRecognition}
                            onChange={(e) => updatePreferences({ shapeRecognition: e.target.checked })}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>Geometric Auto-Complete</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Automatically convert rough strokes into perfect shapes (rectangles, circles, triangles).</span>
                        </div>
                    </label>
                </div>

                <div className="tw-modal-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-primary" onClick={() => setShowModal(false)}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
