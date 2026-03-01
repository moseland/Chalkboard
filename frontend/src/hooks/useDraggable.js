import { useState, useRef } from 'react';

export default function useDraggable(initialPosition = { x: 0, y: 0 }) {
    const [position, setPosition] = useState(initialPosition);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e) => {
        // Only trigger drag on main mouse button
        if (e.button !== 0 && e.type !== 'touchstart') return;

        e.preventDefault();
        e.stopPropagation();

        isDragging.current = true;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        dragStart.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };

        const handlePointerMove = (e) => {
            if (!isDragging.current) return;
            const moveX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const moveY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            setPosition({
                x: moveX - dragStart.current.x,
                y: moveY - dragStart.current.y
            });
        };

        const handlePointerUp = () => {
            isDragging.current = false;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('touchmove', handlePointerMove);
            window.removeEventListener('touchend', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('touchmove', handlePointerMove, { passive: false });
        window.addEventListener('touchend', handlePointerUp);
    };

    return { position, handlePointerDown };
}
