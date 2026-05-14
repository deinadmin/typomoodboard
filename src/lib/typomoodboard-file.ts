import type { BlockKind, FontBlock, FontSource } from "./types";
import { BODY_SAMPLE, HEADING_SAMPLE } from "./types";
import { DEFAULT_MOODBOARD_ICON_EMOJI } from "./moodboard-emojis";

/** On-disk / export shape for `.typomoodboard` JSON (version 1). */
interface TypomoodboardFileV1 {
  version: 1;
  name: string;
  /** Dashboard card icon; optional on legacy exports. */
  iconEmoji?: string;
  defaultHeadingText?: string;
  defaultBodyText?: string;
  blocks: Array<{
    kind: BlockKind;
    family: string;
    style: string;
    source: FontSource;
    sampleText: string;
    trackingPerMille?: number;
    twoColumnSizes?: boolean;
    variants: Array<{ sizePt: number; leadingPt: number }>;
  }>;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * Parse and validate a `.typomoodboard` JSON file.
 * Returns `null` if the file is not a valid v1 export (reject before creating a moodboard).
 */
export function parseTypomoodboardFile(json: string): {
  name: string;
  iconEmoji: string;
  blocks: FontBlock[];
  defaultHeadingText: string;
  defaultBodyText: string;
} | null {
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(root)) return null;
  if (root.version !== 1) return null;
  if (typeof root.name !== "string") return null;
  if (!Array.isArray(root.blocks)) return null;
  if (root.defaultHeadingText !== undefined && typeof root.defaultHeadingText !== "string") {
    return null;
  }
  if (root.defaultBodyText !== undefined && typeof root.defaultBodyText !== "string") {
    return null;
  }
  if (root.iconEmoji !== undefined && typeof root.iconEmoji !== "string") {
    return null;
  }
  if (
    typeof root.iconEmoji === "string" &&
    root.iconEmoji.trim().length > 32
  ) {
    return null;
  }

  for (const raw of root.blocks) {
    if (!isRecord(raw)) return null;
    if (raw.kind !== "heading" && raw.kind !== "body") return null;
    if (typeof raw.family !== "string" || typeof raw.style !== "string") return null;
    if (raw.source !== "system" && raw.source !== "upload") return null;
    if (typeof raw.sampleText !== "string") return null;
    if (
      raw.trackingPerMille !== undefined &&
      (typeof raw.trackingPerMille !== "number" || !Number.isFinite(raw.trackingPerMille))
    ) {
      return null;
    }
    if (raw.twoColumnSizes !== undefined && typeof raw.twoColumnSizes !== "boolean") {
      return null;
    }
    if (!Array.isArray(raw.variants)) return null;
    for (const rv of raw.variants) {
      if (!isRecord(rv)) return null;
      if (typeof rv.sizePt !== "number" || !Number.isFinite(rv.sizePt) || rv.sizePt <= 0) {
        return null;
      }
      if (
        typeof rv.leadingPt !== "number" ||
        !Number.isFinite(rv.leadingPt) ||
        rv.leadingPt <= 0
      ) {
        return null;
      }
    }
  }

  const data = root as unknown as TypomoodboardFileV1;
  const rawIcon =
    typeof data.iconEmoji === "string" && data.iconEmoji.trim().length > 0
      ? data.iconEmoji.trim()
      : DEFAULT_MOODBOARD_ICON_EMOJI;

  const blocks: FontBlock[] = data.blocks.map((b) => ({
    id: crypto.randomUUID(),
    kind: b.kind,
    family: b.family,
    style: b.style,
    source: b.source === "upload" ? "system" : b.source,
    sampleText: b.sampleText,
    trackingPerMille: typeof b.trackingPerMille === "number" ? b.trackingPerMille : 0,
    twoColumnSizes: b.twoColumnSizes === true,
    variants: b.variants.map((v) => ({
      id: crypto.randomUUID(),
      sizePt: v.sizePt,
      leadingPt: v.leadingPt,
    })),
  }));

  return {
    name: data.name,
    iconEmoji: rawIcon,
    blocks,
    defaultHeadingText:
      typeof data.defaultHeadingText === "string" && data.defaultHeadingText.length > 0
        ? data.defaultHeadingText
        : HEADING_SAMPLE,
    defaultBodyText:
      typeof data.defaultBodyText === "string" && data.defaultBodyText.length > 0
        ? data.defaultBodyText
        : BODY_SAMPLE,
  };
}

export function exportTypomoodboard(
  name: string,
  blocks: FontBlock[],
  defaultHeadingText: string,
  defaultBodyText: string,
  iconEmoji: string,
) {
  const data: TypomoodboardFileV1 = {
    version: 1,
    name,
    iconEmoji: iconEmoji.trim() || DEFAULT_MOODBOARD_ICON_EMOJI,
    defaultHeadingText,
    defaultBodyText,
    blocks: blocks.map((b) => ({
      kind: b.kind,
      family: b.family,
      style: b.style,
      source: b.source,
      sampleText: b.sampleText,
      trackingPerMille: b.trackingPerMille,
      twoColumnSizes: b.twoColumnSizes || undefined,
      variants: b.variants.map((v) => ({ sizePt: v.sizePt, leadingPt: v.leadingPt })),
    })),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "moodboard"}.typomoodboard`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
