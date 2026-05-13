export type BlockKind = "heading" | "body";

export type FontSource = "system" | "upload";

export interface Variant {
  id: string;
  sizePt: number;
  leadingPt: number;
}

export interface FontBlock {
  id: string;
  kind: BlockKind;
  source: FontSource;
  family: string;
  style: string;
  postscriptName?: string;
  uploadId?: string;
  /** Tracking in InDesign units: 1/1000 em. 0 = no extra spacing (InDesign default). */
  trackingPerMille: number;
  variants: Variant[];
  sampleText: string;
  /** When true, size variants for this block are laid out in 2 columns in the PDF. */
  twoColumnSizes?: boolean;
}

export interface FontUpload {
  id: string;
  family: string;
  style: string;
}

export const HEADING_SAMPLE =
  "Sphinx of black quartz, judge my vow. Die Vogelperspektive birgt grossen Charme.";

export const BODY_SAMPLE =
  "Typography is the art and technique of arranging type to make written language legible, readable and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing, and letter-spacing.\n\nGood typography guides the reader through the text hierarchy. It establishes rhythm and texture on the page, creates contrast between different levels of information, and gives the reader visual cues about where to start, where to pause, and where to stop. The relationship between type size and leading is central to all of this.\n\nWhen setting body text, a leading value of 120 – 145 % of the type size is generally comfortable for sustained reading. Tighter leading can feel dense and fatiguing; looser leading can feel airy but disconnected. Fine-tuning these values for each typeface and context is part of the craft of typography.";

export const HEADING_PRESET: Omit<FontBlock, "id"> = {
  kind: "heading",
  source: "system",
  family: "Helvetica",
  style: "Bold",
  trackingPerMille: 0,
  variants: [],
  sampleText: HEADING_SAMPLE,
};

export const BODY_PRESET: Omit<FontBlock, "id"> = {
  kind: "body",
  source: "system",
  family: "Helvetica",
  style: "Regular",
  trackingPerMille: 0,
  variants: [],
  sampleText: BODY_SAMPLE,
};

export const HEADING_DEFAULT_SIZE = 36;
export const HEADING_DEFAULT_LEADING = 40;
export const BODY_DEFAULT_SIZE = 10;
export const BODY_DEFAULT_LEADING = 14;
