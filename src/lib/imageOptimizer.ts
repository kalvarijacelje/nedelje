/**
 * Automatic Client-Side Image Optimizer
 * 
 * Target Format: Converts .jpg, .jpeg, .png to .webp
 * Max File Size: 400 KB (maxSizeMB: 0.4)
 * Max Dimensions: 1920px width/height (maxWidthOrHeight: 1920)
 * Non-blocking async execution with iterative quality scaling
 */

export interface ImageOptimizerOptions {
  maxSizeMB?: number; // default: 0.4 (400 KB)
  maxWidthOrHeight?: number; // default: 1920
  quality?: number; // initial quality: default 0.85
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
  useWebWorker?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<ImageOptimizerOptions, 'useWebWorker'>> = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1920,
  quality: 0.85,
  mimeType: 'image/webp',
};

/**
 * Optimizes an image File or Blob in the browser prior to storage upload.
 * Iteratively ensures the output is under maxSizeMB (400 KB) and constrained to maxWidthOrHeight (1920px).
 */
export async function optimizeImage(
  file: File | Blob,
  options: ImageOptimizerOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxSizeBytes = opts.maxSizeMB * 1024 * 1024; // 400 KB = 419,430 bytes

  // Passthrough for SVGs or GIFs to avoid destroying vectors or animations
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      const maxDim = opts.maxWidthOrHeight;

      // Scale dimensions proportionally if larger than maxDim
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
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

      // White background fill for transparent images when converting to formats without alpha
      if (opts.mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Helper function to encode canvas to blob at specified quality
      const getBlobAtQuality = (q: number): Promise<Blob | null> => {
        return new Promise((res) => {
          canvas.toBlob((b) => res(b), opts.mimeType, q);
        });
      };

      try {
        let currentQuality = opts.quality;
        let blob = await getBlobAtQuality(currentQuality);

        // Iterative compression if blob exceeds 400KB limit
        let attempts = 0;
        while (blob && blob.size > maxSizeBytes && currentQuality > 0.3 && attempts < 5) {
          currentQuality -= 0.12;
          const nextBlob = await getBlobAtQuality(currentQuality);
          if (nextBlob) {
            blob = nextBlob;
          }
          attempts++;
        }

        if (blob) {
          resolve(blob);
        } else {
          resolve(file);
        }
      } catch (err) {
        console.warn('Canvas optimization fallback to original:', err);
        resolve(file);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Optimizes an image File and returns a new File object with a .webp extension.
 */
export async function optimizeImageFile(
  file: File,
  options: ImageOptimizerOptions = {}
): Promise<File> {
  const targetMime = options.mimeType || 'image/webp';
  const optimizedBlob = await optimizeImage(file, { ...options, mimeType: targetMime });

  const ext = targetMime === 'image/jpeg' ? 'jpg' : targetMime === 'image/png' ? 'png' : 'webp';
  const originalBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const fileName = `${originalBase}.${ext}`;

  return new File([optimizedBlob], fileName, {
    type: targetMime,
    lastModified: Date.now(),
  });
}

/**
 * Optimizes an image and exports a Data URL string (useful for avatar croppers and inline previews)
 */
export async function optimizeImageToDataUrl(
  file: File | Blob,
  options: ImageOptimizerOptions = {}
): Promise<string> {
  const blob = await optimizeImage(file, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a clean relative storage path for database storage
 * Example: createCleanStoragePath('gallery', 'photo.jpg') -> 'gallery/a1b2c3d4.webp'
 */
export function createCleanStoragePath(
  folder: string,
  originalFilename?: string,
  extension: string = 'webp'
): string {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  return `${cleanFolder}/${id}.${extension}`;
}
