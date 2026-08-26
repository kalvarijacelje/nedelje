/**
 * Storage & CDN Configuration for Cloudflare R2 Endpoints
 */

export function getAudioUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_AUDIO_CDN_URL || 'https://pub-ec35d0a2dae148b985f8d79f80639764.r2.dev';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.VITE_MEDIA_CDN_URL || 'https://pub-38b5d7ad707f4398a808e413bb3620c8.r2.dev';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
