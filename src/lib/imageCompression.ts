/**
 * Client-side Automatic Image Compression Utility
 * Compresses images in browser memory using HTML5 Canvas before uploading to storage/CDN
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

/**
 * Compresses an image File or Blob in the browser
 * @param file Input image File or Blob
 * @param options Compression configuration (maxWidth, maxHeight, quality, mimeType)
 * @returns Promise resolving to compressed Blob
 */
export async function compressImage(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    mimeType = 'image/webp',
  } = options;

  // Passthrough for formats that shouldn't be canvas-compressed (SVG, GIF)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Maintain aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Solid background for JPEG if transparent
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            // Keep original if compressed size wasn't smaller
            resolve(file);
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Convenience helper to compress a File and return a new File object with correct extension and mime type
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const targetMime = options.mimeType || 'image/webp';
  const compressedBlob = await compressImage(file, { ...options, mimeType: targetMime });
  
  const ext = targetMime === 'image/jpeg' ? 'jpg' : targetMime === 'image/png' ? 'png' : 'webp';
  const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const fileName = `${originalName}.${ext}`;

  return new File([compressedBlob], fileName, {
    type: targetMime,
    lastModified: Date.now(),
  });
}
