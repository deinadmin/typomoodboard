export interface LocalFontEntry {
  family: string;
  style: string;
  fullName: string;
  postscriptName: string;
}

interface FontDataLike {
  family: string;
  style: string;
  fullName: string;
  postscriptName: string;
  blob: () => Promise<Blob>;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<FontDataLike[]>;
  }
}

const bytesCache = new Map<string, ArrayBuffer>();
let cachedList: FontDataLike[] | null = null;

export function supportsLocalFonts(): boolean {
  return typeof window !== "undefined" && typeof window.queryLocalFonts === "function";
}

export async function queryLocalFonts(): Promise<LocalFontEntry[]> {
  if (!supportsLocalFonts()) return [];
  try {
    if (!cachedList) {
      cachedList = await window.queryLocalFonts!();
    }
    return cachedList.map((f) => ({
      family: f.family,
      style: f.style,
      fullName: f.fullName,
      postscriptName: f.postscriptName,
    }));
  } catch {
    return [];
  }
}

export async function getSystemFontBytes(postscriptName: string): Promise<ArrayBuffer | null> {
  const cached = bytesCache.get(`sys:${postscriptName}`);
  if (cached) return cached;
  // PDF (and other callers) may run before App’s first queryLocalFonts() finishes; load the list
  // lazily so embed can still resolve system fonts after a full page reload.
  if (supportsLocalFonts() && !cachedList) {
    await queryLocalFonts();
  }
  if (!cachedList) return null;
  const match = cachedList.find((f) => f.postscriptName === postscriptName);
  if (!match) return null;
  try {
    const blob = await match.blob();
    const buf = await blob.arrayBuffer();
    bytesCache.set(`sys:${postscriptName}`, buf);
    return buf;
  } catch {
    return null;
  }
}

export function cacheUploadBytes(uploadId: string, buf: ArrayBuffer) {
  bytesCache.set(`up:${uploadId}`, buf);
}

export function getUploadBytes(uploadId: string): ArrayBuffer | null {
  return bytesCache.get(`up:${uploadId}`) ?? null;
}
