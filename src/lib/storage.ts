import { cacheUploadBytes } from "./fonts";
import type { FontUpload } from "./types";

const FONT_DB = "typomoodboard-font-db";
const FONT_STORE = "fontUploads";
const FONT_DB_VERSION = 1;

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FONT_DB, FONT_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FONT_STORE)) {
        db.createObjectStore(FONT_STORE);
      }
    };
  });
}

/** Persist uploaded font bytes so PDF preview can reload them after a full page refresh. */
export async function persistUploadFont(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openFontDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONT_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(FONT_STORE).put(buffer, id);
  });
}

export async function loadUploadFont(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openFontDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FONT_STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
      const r = tx.objectStore(FONT_STORE).get(id);
      r.onsuccess = () => resolve((r.result as ArrayBuffer | undefined) ?? null);
    });
  } catch {
    return null;
  }
}

export async function registerFontFile(
  file: File,
  family: string,
  style: string
): Promise<FontUpload> {
  const id = crypto.randomUUID();
  const buf = await file.arrayBuffer();
  cacheUploadBytes(id, buf);
  void persistUploadFont(id, buf).catch(() => {
    /* offline / private mode — PDF still works this session */
  });
  return { id, family, style };
}
