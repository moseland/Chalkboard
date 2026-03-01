import { toPng } from 'html-to-image';

/**
 * Utility to render HTML strings into PNG data URLs for use in Konva Image nodes.
 * This allows for rich text (bold, italic, mixed sizes) and automatic wrapping without brittle SVG foreignObjects.
 */
export const renderRichTextToSVG = async ({ html, width, color, fontSize, fontFamily }) => {
    const renderWidth = width || 400;

    // Create an off-screen container matching the exact styles of the rich text editor
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.zIndex = '-9999'; // Render underneath the UI so it doesn't flash
    container.style.pointerEvents = 'none';
    container.style.width = renderWidth + 'px';
    container.style.fontFamily = fontFamily || 'sans-serif';
    container.style.fontSize = (fontSize || 32) + 'px';
    container.style.lineHeight = '1.4';
    container.style.wordWrap = 'break-word';
    container.style.whiteSpace = 'pre-wrap';
    container.style.color = color || 'white';
    container.style.margin = '10px 0'; // Add margin to prevent clipping
    container.style.padding = '10px 0'; // Add padding for descenders
    // Match the internal styles of the editor so it renders accurately
    container.innerHTML = html;

    document.body.appendChild(container);

    // Wait for any potential font loading (optional, but good practice for web fonts)
    await document.fonts.ready;

    try {
        // html-to-image works best when we render the node as it physically exists in the DOM
        const dataUrl = await toPng(container, {
            backgroundColor: 'transparent',
            pixelRatio: 2,
            fontEmbedCSS: '' // Fix for SecurityError: Cannot access rules
        });

        const height = container.scrollHeight;
        document.body.removeChild(container);

        return {
            dataUrl,
            height
        };
    } catch (error) {
        console.error('Failed to render rich text to image', error);
        document.body.removeChild(container);
        return { dataUrl: null, height: 100 };
    }
};
