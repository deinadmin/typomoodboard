import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_MOODBOARD_ICON_EMOJI } from "./moodboard-emojis";
import { BODY_SAMPLE, HEADING_SAMPLE, type FontBlock } from "./types";

export interface MoodboardMeta {
  id: string;
  name: string;
  /** Short label shown on the dashboard card (one emoji or ZWJ sequence). */
  iconEmoji: string;
  blockCount: number;
  updatedAt: Date;
  createdAt: Date;
}

type StoredBlock = FontBlock;

function serializeBlock(block: FontBlock): StoredBlock {
  return block;
}

function deserializeBlock(data: StoredBlock): FontBlock {
  return { ...data };
}

export async function createMoodboard(
  userId: string,
  name: string,
  iconEmoji: string,
): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const ref = await addDoc(collection(db, "users", userId, "moodboards"), {
    name,
    iconEmoji,
    blocks: [],
    blockCount: 0,
    defaultHeadingText: HEADING_SAMPLE,
    defaultBodyText: BODY_SAMPLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Create a moodboard in one write with editor-ready content (e.g. dashboard import). */
export async function createMoodboardFromImport(
  userId: string,
  name: string,
  blocks: FontBlock[],
  defaultHeadingText: string,
  defaultBodyText: string,
  iconEmoji: string,
): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const displayName = name.trim() || "Untitled Moodboard";
  const emoji =
    typeof iconEmoji === "string" && iconEmoji.trim().length > 0
      ? iconEmoji.trim()
      : DEFAULT_MOODBOARD_ICON_EMOJI;
  const ref = await addDoc(collection(db, "users", userId, "moodboards"), {
    name: displayName,
    iconEmoji: emoji,
    blocks: blocks.map(serializeBlock),
    blockCount: blocks.length,
    defaultHeadingText,
    defaultBodyText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMoodboard(
  userId: string,
  moodboardId: string,
  name: string,
  blocks: FontBlock[],
  defaultHeadingText: string,
  defaultBodyText: string,
  iconEmoji: string,
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const ref = doc(db, "users", userId, "moodboards", moodboardId);
  const emoji =
    typeof iconEmoji === "string" && iconEmoji.trim().length > 0
      ? iconEmoji.trim()
      : DEFAULT_MOODBOARD_ICON_EMOJI;
  await updateDoc(ref, {
    name,
    iconEmoji: emoji,
    blocks: blocks.map(serializeBlock),
    blockCount: blocks.length,
    defaultHeadingText,
    defaultBodyText,
    updatedAt: serverTimestamp(),
  });
}

export async function getMoodboard(
  userId: string,
  moodboardId: string,
): Promise<{
  name: string;
  iconEmoji: string;
  blocks: FontBlock[];
  defaultHeadingText: string;
  defaultBodyText: string;
} | null> {
  if (!db) return null;
  const ref = doc(db, "users", userId, "moodboards", moodboardId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const rawEmoji = data.iconEmoji;
  const iconEmoji =
    typeof rawEmoji === "string" && rawEmoji.trim().length > 0
      ? rawEmoji.trim()
      : DEFAULT_MOODBOARD_ICON_EMOJI;
  return {
    name: data.name as string,
    iconEmoji,
    blocks: ((data.blocks ?? []) as StoredBlock[]).map(deserializeBlock),
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

export async function updateMoodboardMeta(
  userId: string,
  moodboardId: string,
  fields: { name: string; iconEmoji: string },
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, "users", userId, "moodboards", moodboardId), {
    name: fields.name,
    iconEmoji: fields.iconEmoji,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMoodboard(userId: string, moodboardId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "users", userId, "moodboards", moodboardId));
}

export function subscribeMoodboards(
  userId: string,
  callback: (moodboards: MoodboardMeta[]) => void,
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "users", userId, "moodboards"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    const boards = snap.docs.map((d) => {
      const data = d.data();
      const rawEmoji = data.iconEmoji;
      const iconEmoji =
        typeof rawEmoji === "string" && rawEmoji.trim().length > 0
          ? rawEmoji.trim()
          : DEFAULT_MOODBOARD_ICON_EMOJI;
      return {
        id: d.id,
        name: data.name as string,
        iconEmoji,
        blockCount: (data.blockCount as number) ?? 0,
        updatedAt: (data.updatedAt?.toDate?.() as Date | undefined) ?? new Date(),
        createdAt: (data.createdAt?.toDate?.() as Date | undefined) ?? new Date(),
      } satisfies MoodboardMeta;
    });
    callback(boards);
  });
}
