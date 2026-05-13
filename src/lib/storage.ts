import { cacheUploadBytes } from "./fonts";
import type { FontUpload } from "./types";

export async function registerFontFile(
  file: File,
  family: string,
  style: string
): Promise<FontUpload> {
  const id = crypto.randomUUID();
  const buf = await file.arrayBuffer();
  cacheUploadBytes(id, buf);
  return { id, family, style };
}
