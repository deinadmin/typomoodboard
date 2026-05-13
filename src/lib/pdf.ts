import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, setCharacterSpacing } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FontBlock } from "./types";
import { getSystemFontBytes, getUploadBytes } from "./fonts";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 48;
const LABEL_SIZE = 8;
const LABEL_GAP = 6;
const BLOCK_GAP = 24;
const SIZE_GAP = 10;
const PARA_GAP_FACTOR = 0.75;
const COL_GAP = 20; // gap between the two size columns

async function embedBlockFont(
  pdf: PDFDocument,
  block: FontBlock,
  fallback: PDFFont
): Promise<PDFFont> {
  try {
    let bytes: ArrayBuffer | null = null;
    if (block.source === "system" && block.postscriptName) {
      bytes = await getSystemFontBytes(block.postscriptName);
    } else if (block.source === "upload" && block.uploadId) {
      bytes = getUploadBytes(block.uploadId);
    }
    if (!bytes) return fallback;
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return fallback;
  }
}

function newPage(pdf: PDFDocument): { page: PDFPage; y: number } {
  return { page: pdf.addPage([A4_WIDTH, A4_HEIGHT]), y: A4_HEIGHT - MARGIN_TOP };
}

function ensureSpace(
  pdf: PDFDocument,
  page: PDFPage,
  y: number,
  needed: number
): { page: PDFPage; y: number } {
  if (y - needed < MARGIN_BOTTOM) return newPage(pdf);
  return { page, y };
}

function variantHeight(
  paragraphs: string[][],
  sizePt: number,
  leading: number,
  paraGap: number
): number {
  // Distance from variant top to first baseline: label area + sizePt advance.
  let h = LABEL_SIZE + 6 + sizePt;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    // Spacing between baselines within this paragraph.
    h += leading * (paragraphs[pi].length - 1);
    if (pi < paragraphs.length - 1) {
      // After the last line the renderer decrements lineY by `leading` (not
      // sizePt), then by paraGap before the first baseline of the next para.
      h += leading + paraGap;
    }
  }
  return h + SIZE_GAP;
}

function textWidth(
  text: string,
  font: PDFFont,
  size: number,
  charSpacing: number
): number {
  const n = text.length;
  return font.widthOfTextAtSize(text, size) + charSpacing * Math.max(0, n - 1);
}

/**
 * Breaks a single word into hyphenated fragments each fitting within maxWidth.
 * Searches from the right to find the longest prefix that fits with a trailing
 * '-', which is the same greedy strategy InDesign uses for emergency hyphenation.
 *
 * Proof that fragments never share a line: each fragment's width ≈ maxWidth,
 * so fragment + space + next-fragment > maxWidth always holds.
 */
function hyphenateWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  charSpacing: number
): string[] {
  const frags: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    if (textWidth(rest, font, size, charSpacing) <= maxWidth) {
      frags.push(rest);
      break;
    }
    // Search from right: longest prefix such that prefix + '-' fits maxWidth.
    let cut = rest.length - 1;
    while (cut >= 1 && textWidth(rest.slice(0, cut) + "-", font, size, charSpacing) > maxWidth) {
      cut--;
    }
    if (cut < 1) {
      // Pathological: even 1 char + '-' doesn't fit — force-push one character.
      frags.push(rest.slice(0, 1));
      rest = rest.slice(1);
    } else {
      frags.push(rest.slice(0, cut) + "-");
      rest = rest.slice(cut);
    }
  }
  return frags;
}

function wrapParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  charSpacing: number
): string[] {
  const rawWords = text.trim().split(/\s+/);

  // Pre-expand any word wider than maxWidth into hyphenated fragments.
  const words: string[] = [];
  for (const w of rawWords) {
    if (textWidth(w, font, size, charSpacing) > maxWidth) {
      words.push(...hyphenateWord(w, font, size, maxWidth, charSpacing));
    } else {
      words.push(w);
    }
  }

  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (textWidth(candidate, font, size, charSpacing) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text.trim()];
}

function wrapTextToParagraphs(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  charSpacing: number
): string[][] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => wrapParagraph(p, font, size, maxWidth, charSpacing));
}

interface VariantData {
  sizePt: number;
  leading: number;
  charSpacing: number;
  paragraphs: string[][];
  paraGap: number;
  tracking: number;
}

function computeVariantData(block: FontBlock, font: PDFFont, maxWidth: number): VariantData[] {
  const tracking = block.trackingPerMille ?? 0;
  return block.variants.map((item) => {
    const sizePt = item.sizePt;
    const leading = item.leadingPt > 0 ? item.leadingPt : sizePt * 1.2;
    const charSpacing = (tracking / 1000) * sizePt;
    const paragraphs = wrapTextToParagraphs(block.sampleText, font, sizePt, maxWidth, charSpacing);
    const paraGap = leading * PARA_GAP_FACTOR;
    return { sizePt, leading, charSpacing, paragraphs, paraGap, tracking };
  });
}

interface DrawColors {
  muted: ReturnType<typeof rgb>;
  ink: ReturnType<typeof rgb>;
  hair: ReturnType<typeof rgb>;
}

/**
 * Draws a single size variant at a fixed position. No page-break handling —
 * caller must ensure there is enough space before calling.
 */
function drawVariantAt(
  page: PDFPage,
  startY: number,
  vd: VariantData,
  font: PDFFont,
  labelFont: PDFFont,
  originX: number,
  colors: DrawColors
): void {
  const { sizePt, leading, charSpacing, paragraphs, paraGap, tracking } = vd;
  let y = startY;

  const trackingLabel = tracking !== 0 ? ` / ${tracking} tk` : "";
  page.drawText(`${sizePt} pt size / ${leading} pt leading${trackingLabel}`, {
    x: originX,
    y: y - LABEL_SIZE,
    size: LABEL_SIZE,
    font: labelFont,
    color: colors.muted,
  });
  y -= LABEL_SIZE + 6;

  if (charSpacing !== 0) page.pushOperators(setCharacterSpacing(charSpacing));

  let lineY = y - sizePt;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    for (const line of paragraphs[pi]) {
      page.drawText(line, { x: originX, y: lineY, size: sizePt, font, color: colors.ink });
      lineY -= leading;
    }
    if (pi < paragraphs.length - 1) lineY -= paraGap;
  }

  if (charSpacing !== 0) page.pushOperators(setCharacterSpacing(0));
}

export async function generateMoodboardPdf(blocks: FontBlock[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
  const fallback = await pdf.embedFont(StandardFonts.Helvetica);

  const colors: DrawColors = {
    muted: rgb(0.45, 0.45, 0.45),
    ink: rgb(0.09, 0.09, 0.09),
    hair: rgb(0.88, 0.88, 0.88),
  };

  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - MARGIN_TOP;
  const maxWidth = A4_WIDTH - MARGIN_X * 2;
  const usablePage = A4_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

  if (blocks.length === 0) {
    page.drawText("Add a font block in the sidebar to preview your moodboard.", {
      x: MARGIN_X,
      y: A4_HEIGHT / 2,
      size: 11,
      font: labelFont,
      color: colors.muted,
    });
    return await pdf.save();
  }

  for (const block of blocks) {
    const font = await embedBlockFont(pdf, block, fallback);
    const twoCol = block.twoColumnSizes ?? false;
    const colWidth = twoCol ? (maxWidth - COL_GAP) / 2 : maxWidth;

    const variantData = computeVariantData(block, font, colWidth);

    // ── Compute total block height for page-break pre-check ──────────────────
    const headerHeight = LABEL_SIZE + LABEL_GAP + 10;

    let variantsHeight = 0;
    if (twoCol) {
      for (let vi = 0; vi < variantData.length; vi += 2) {
        const lh = variantHeight(variantData[vi].paragraphs, variantData[vi].sizePt, variantData[vi].leading, variantData[vi].paraGap);
        const rh = vi + 1 < variantData.length
          ? variantHeight(variantData[vi + 1].paragraphs, variantData[vi + 1].sizePt, variantData[vi + 1].leading, variantData[vi + 1].paraGap)
          : 0;
        variantsHeight += Math.max(lh, rh);
      }
    } else {
      variantsHeight = variantData.reduce(
        (sum, v) => sum + variantHeight(v.paragraphs, v.sizePt, v.leading, v.paraGap),
        0
      );
    }

    const totalBlockHeight = headerHeight + variantsHeight + BLOCK_GAP;

    if (totalBlockHeight <= usablePage) {
      ({ page, y } = ensureSpace(pdf, page, y, totalBlockHeight));
    } else {
      ({ page, y } = ensureSpace(pdf, page, y, headerHeight));
    }

    // ── Block header ─────────────────────────────────────────────────────────
    page.drawText(`${block.family} ${block.style}`.toUpperCase(), {
      x: MARGIN_X,
      y: y - LABEL_SIZE,
      size: LABEL_SIZE,
      font: labelFont,
      color: colors.muted,
    });
    y -= LABEL_SIZE + LABEL_GAP;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: A4_WIDTH - MARGIN_X, y },
      thickness: 0.5,
      color: colors.hair,
    });
    y -= 10;

    // ── Variants ─────────────────────────────────────────────────────────────
    if (twoCol) {
      // Two-column: pair up variants, render them side-by-side
      for (let vi = 0; vi < variantData.length; vi += 2) {
        const leftVD = variantData[vi];
        const rightVD = vi + 1 < variantData.length ? variantData[vi + 1] : null;

        const lh = variantHeight(leftVD.paragraphs, leftVD.sizePt, leftVD.leading, leftVD.paraGap);
        const rh = rightVD
          ? variantHeight(rightVD.paragraphs, rightVD.sizePt, rightVD.leading, rightVD.paraGap)
          : 0;
        const rowH = Math.max(lh, rh);

        if (rowH <= usablePage) {
          ({ page, y } = ensureSpace(pdf, page, y, rowH));
        }

        const rowY = y;
        drawVariantAt(page, rowY, leftVD, font, labelFont, MARGIN_X, colors);
        if (rightVD) {
          drawVariantAt(page, rowY, rightVD, font, labelFont, MARGIN_X + colWidth + COL_GAP, colors);
        }

        y = rowY - rowH;
      }
    } else {
      // Single-column: render variants one below the other, with mid-block page breaks
      const tracking = block.trackingPerMille ?? 0;
      for (const { sizePt, leading, charSpacing, paragraphs, paraGap } of variantData) {
        const vHeight = variantHeight(paragraphs, sizePt, leading, paraGap);

        if (vHeight <= usablePage) {
          ({ page, y } = ensureSpace(pdf, page, y, vHeight));
        }

        const trackingLabel = tracking !== 0 ? ` / ${tracking} tk` : "";
        page.drawText(`${sizePt} pt size / ${leading} pt leading${trackingLabel}`, {
          x: MARGIN_X,
          y: y - LABEL_SIZE,
          size: LABEL_SIZE,
          font: labelFont,
          color: colors.muted,
        });
        y -= LABEL_SIZE + 6;

        if (charSpacing !== 0) page.pushOperators(setCharacterSpacing(charSpacing));

        let lineY = y - sizePt;
        for (let pi = 0; pi < paragraphs.length; pi++) {
          for (const line of paragraphs[pi]) {
            if (lineY < MARGIN_BOTTOM) {
              ({ page, y } = newPage(pdf));
              lineY = y - sizePt;
              if (charSpacing !== 0) page.pushOperators(setCharacterSpacing(charSpacing));
            }
            page.drawText(line, { x: MARGIN_X, y: lineY, size: sizePt, font, color: colors.ink });
            lineY -= leading;
          }
          if (pi < paragraphs.length - 1) lineY -= paraGap;
        }
        y = lineY + leading - SIZE_GAP;

        if (charSpacing !== 0) page.pushOperators(setCharacterSpacing(0));
      }
    }

    y -= BLOCK_GAP;
  }

  const footnoteText = "This Typo Moodboard was generated by https://typomoodboard.designedbycarl.de";
  for (const p of pdf.getPages()) {
    p.drawText(footnoteText, {
      x: MARGIN_X,
      y: 22,
      size: 6.5,
      font: labelFont,
      color: colors.muted,
    });
  }

  return await pdf.save();
}
