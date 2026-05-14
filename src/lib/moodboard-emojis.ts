/**
 * 48 curated moodboard icons — each with a hand-picked accent for dashboard cards.
 * Accents are `hsl()` and mixed in `color-mix(in srgb, …)` (see `dashboard.tsx`).
 */

export const MOODBOARD_EMOJI_THEME = [
  { emoji: "🎨", accent: "hsl(277 72% 58%)" }, // violet paint tube
  { emoji: "✨", accent: "hsl(48 100% 62%)" }, // warm gold sparkles
  { emoji: "🔤", accent: "hsl(218 28% 52%)" }, // cool concrete / type specimen
  { emoji: "🖋️", accent: "hsl(208 55% 42%)" }, // deep fountain ink
  { emoji: "📐", accent: "hsl(172 48% 44%)" }, // drafting teal
  { emoji: "📎", accent: "hsl(214 22% 54%)" }, // brushed steel
  { emoji: "🗂️", accent: "hsl(38 72% 58%)" }, // manila / tab folder
  { emoji: "💡", accent: "hsl(46 100% 58%)" }, // lit filament
  { emoji: "🌙", accent: "hsl(248 42% 48%)" }, // night indigo
  { emoji: "☀️", accent: "hsl(42 100% 58%)" }, // clear daylight
  { emoji: "🌿", accent: "hsl(142 52% 42%)" }, // fresh leaf
  { emoji: "🪴", accent: "hsl(128 38% 44%)" }, // potted plant / moss
  { emoji: "🌊", accent: "hsl(198 82% 50%)" }, // seafoam surf
  { emoji: "🔥", accent: "hsl(18 92% 56%)" }, // ember orange
  { emoji: "💎", accent: "hsl(188 72% 48%)" }, // aquamarine facet
  { emoji: "🎯", accent: "hsl(352 78% 54%)" }, // target crimson
  { emoji: "🎭", accent: "hsl(292 58% 52%)" }, // stage velvet
  { emoji: "🎬", accent: "hsl(36 92% 56%)" }, // clapperboard gold
  { emoji: "📷", accent: "hsl(220 12% 46%)" }, // lens graphite
  { emoji: "🖼️", accent: "hsl(28 48% 52%)" }, // gilded frame
  { emoji: "🌆", accent: "hsl(330 58% 58%)" }, // neon dusk magenta
  { emoji: "☕", accent: "hsl(26 44% 40%)" }, // espresso crema
  { emoji: "🍵", accent: "hsl(138 36% 44%)" }, // matcha bowl
  { emoji: "⚡", accent: "hsl(54 100% 56%)" }, // electric yellow
  { emoji: "🌈", accent: "hsl(268 70% 60%)" }, // arc after rain
  { emoji: "📚", accent: "hsl(30 52% 42%)" }, // bound leather spines
  { emoji: "📖", accent: "hsl(44 78% 58%)" }, // cream paper + gilt
  { emoji: "✉️", accent: "hsl(210 68% 56%)" }, // airmail blue
  { emoji: "💌", accent: "hsl(343 72% 58%)" }, // sealed wax rose
  { emoji: "🔮", accent: "hsl(276 62% 52%)" }, // orb violet smoke
  { emoji: "🎵", accent: "hsl(262 58% 55%)" }, // violet staff lines
  { emoji: "🎹", accent: "hsl(258 14% 36%)" }, // ebony & ivory keys
  { emoji: "🎸", accent: "hsl(22 88% 54%)" }, // sunburst lacquer
  { emoji: "💜", accent: "hsl(288 64% 56%)" }, // heart purple
  { emoji: "💙", accent: "hsl(218 86% 58%)" }, // heart azure
  { emoji: "💚", accent: "hsl(148 58% 46%)" }, // heart jade
  { emoji: "🌟", accent: "hsl(212 72% 58%)" }, // cool stellar highlight (vs warm ✨)
  { emoji: "🧩", accent: "hsl(154 52% 44%)" }, // toy puzzle spring green
  { emoji: "🔑", accent: "hsl(40 82% 54%)" }, // brass & patina
  { emoji: "🌐", accent: "hsl(204 82% 52%)" }, // meridian blue
  { emoji: "🧠", accent: "hsl(332 58% 62%)" }, // synapse blush
  { emoji: "💭", accent: "hsl(206 28% 62%)" }, // cartoon cloud mist
  { emoji: "🫶", accent: "hsl(348 72% 62%)" }, // skin-warm rose quartz
  { emoji: "👁️", accent: "hsl(44 52% 58%)" }, // warm hazel / light golden brown
  { emoji: "🪩", accent: "hsl(318 70% 58%)" }, // mirrorball magenta
  { emoji: "🧱", accent: "hsl(16 72% 52%)" }, // terracotta brick
  { emoji: "🪟", accent: "hsl(202 76% 58%)" }, // daylight glass cyan
  { emoji: "🌸", accent: "hsl(338 64% 60%)" }, // sakura pink (readable on white cards)
] as const;

/** Picker / random selection — emoji strings only. */
export const MOODBOARD_EMOJI_CHOICES: readonly string[] = MOODBOARD_EMOJI_THEME.map((r) => r.emoji);

export const DEFAULT_MOODBOARD_ICON_EMOJI = "🎨";

function expandEmojiKeys(s: string): string[] {
  const t = s.trim();
  const out = new Set<string>([t]);
  try {
    out.add(t.normalize("NFC"));
    out.add(t.normalize("NFD"));
  } catch {
    /* ignore */
  }
  const stripped = t.replace(/\uFE0F/g, "");
  if (stripped !== t) out.add(stripped);
  if (stripped.length > 0) out.add(stripped + "\uFE0F");
  return [...out];
}

const ACCENT_BY_EMOJI = new Map<string, string>();
for (const row of MOODBOARD_EMOJI_THEME) {
  for (const k of expandEmojiKeys(row.emoji)) {
    ACCENT_BY_EMOJI.set(k, row.accent);
  }
}

const IMPORT_INBOX_ACCENT = "hsl(210 52% 48%)";

const EXTRA_EMOJI_ACCENTS: Record<string, string> = {
  "📥": IMPORT_INBOX_ACCENT,
};

function accentFromStringHash(s: string): string {
  let x = 0;
  for (let i = 0; i < s.length; i++) {
    x = (x * 33 + s.charCodeAt(i)) >>> 0;
  }
  const h = x % 360;
  return `hsl(${h} 56% 52%)`;
}

export function pickRandomMoodboardEmoji(): string {
  const list = MOODBOARD_EMOJI_CHOICES;
  return list[Math.floor(Math.random() * list.length)] ?? DEFAULT_MOODBOARD_ICON_EMOJI;
}

/** CSS color for `color-mix(in srgb, …)` on dashboard cards. */
export function getMoodboardCardAccent(emoji: string): string {
  const raw = emoji.trim();
  for (const k of expandEmojiKeys(raw)) {
    const hit = ACCENT_BY_EMOJI.get(k);
    if (hit) return hit;
  }
  const extra = EXTRA_EMOJI_ACCENTS[raw];
  if (extra) return extra;
  return accentFromStringHash(raw);
}
