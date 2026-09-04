import { optimizeImageFile } from "./imageOptimizer";
import { getMediaUrl } from "./cdn";
import { directUploadToR2 } from "./r2DirectUpload";

export type MediaFolder = "profiles" | "events" | "roster" | "uploads";

export async function uploadMedia(
  file: File | Blob,
  folder: MediaFolder = "profiles",
  onProgress?: (status: string) => void
): Promise<string> {
  let fileToUpload: File | Blob = file;

  onProgress?.("Shrinking and optimizing...");
  if (file instanceof File && file.type.startsWith("image/") && !file.type.includes("svg") && !file.type.includes("gif")) {
    try {
      fileToUpload = await optimizeImageFile(file, {
        maxWidthOrHeight: 1920,
        maxSizeMB: 0.4,
        mimeType: "image/webp",
      });
    } catch (err) {
      console.warn("Client-side optimization fallback to original:", err);
      fileToUpload = file;
    }
  }

  const ext = fileToUpload instanceof File ? (fileToUpload.name.split(".").pop()?.toLowerCase() || "webp") : "webp";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const contentType = fileToUpload.type || "image/webp";

  onProgress?.("Uploading to Cloudflare R2...");
  try {
    const r2Ok = await directUploadToR2(fileToUpload, path, contentType);
    if (r2Ok) {
      await directUploadToR2(fileToUpload, `media/${path}`, contentType);
    }
  } catch (r2Err) {
    console.warn("Direct R2 upload background warning:", r2Err);
  }

  return path;
}

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/") || path.startsWith("data:")) {
    return path;
  }
  return getMediaUrl(path);
}
