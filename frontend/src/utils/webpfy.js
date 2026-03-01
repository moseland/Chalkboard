/**
 * webpfy
 * Ported from: iamlizu/webpfy
 * Adapted for Bearded Media to support resizing constraints.
 */
export default async function webpfy({
    image,
    quality = 75,
    maxWidth = 0,
    maxHeight = 0
}) {
    try {
        // Extract the file name from the input image's name property
        const originalName = image instanceof File ? image.name : "image";
        const fileName = originalName.replace(/\.[^/.]+$/, "") + ".webp";

        // Create a new HTML Image element
        const img = new Image();

        // Create a canvas element to draw the image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Unable to obtain 2D rendering context.");
        }

        // Load the input image
        img.src = URL.createObjectURL(image);

        // Wait for the image to load
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image for WebP conversion."));
        });

        // Calculate dimensions (Resizing Logic added to original webpfy)
        let width = img.width;
        let height = img.height;

        if ( maxWidth > 0 && maxHeight > 0 ) {
            const widthScale = maxWidth / width;
            const heightScale = maxHeight / height;
            const scale = Math.min(widthScale, heightScale);

            if ( scale < 1 ) {
                width = Math.round( width * scale );
                height = Math.round( height * scale );
            }
        }

        // Set the canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw the image on the canvas
        // Use high quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert the canvas content to a WebP Blob
        const webpBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Failed to convert to WebP format."));
                    }
                },
                "image/webp",
                quality / 100
            );
        });

        // Clean up
        URL.revokeObjectURL(img.src);

        return { webpBlob, fileName };
    } catch (error) {
        throw error;
    }
}