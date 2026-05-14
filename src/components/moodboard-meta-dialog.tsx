import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MOODBOARD_ICON_EMOJI,
  getMoodboardCardAccent,
  MOODBOARD_EMOJI_CHOICES,
  pickRandomMoodboardEmoji,
} from "@/lib/moodboard-emojis";

export type MoodboardMetaDialogMode = "create" | "edit";

export interface MoodboardMetaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MoodboardMetaDialogMode;
  /** Used when `mode === "edit"` — initial values when the dialog opens. */
  initialName?: string;
  initialEmoji?: string;
  namePlaceholder?: string;
  busy?: boolean;
  onSubmit: (payload: { name: string; iconEmoji: string }) => void | Promise<void>;
}

export function MoodboardMetaDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  initialEmoji,
  namePlaceholder = "Untitled Moodboard",
  busy = false,
  onSubmit,
}: MoodboardMetaDialogProps) {
  const titleId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emojiDraft, setEmojiDraft] = useState(pickRandomMoodboardEmoji());
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmojiPickerOpen(false);
      return;
    }
    if (mode === "create") {
      setNameDraft("");
      setEmojiDraft(pickRandomMoodboardEmoji());
    } else {
      setNameDraft(initialName);
      setEmojiDraft(initialEmoji?.trim() || pickRandomMoodboardEmoji());
    }
    const id = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, mode, initialName, initialEmoji]);

  const primaryLabel = mode === "create" ? "Create" : "Save";
  const triggerEmoji = emojiDraft.trim() || DEFAULT_MOODBOARD_ICON_EMOJI;
  const triggerAccent = getMoodboardCardAccent(triggerEmoji);

  async function handleSubmit() {
    const trimmedName = nameDraft.trim();
    const iconEmoji = emojiDraft.trim() || pickRandomMoodboardEmoji();
    await onSubmit({ name: trimmedName, iconEmoji });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-labelledby={titleId}
        className={cn(
          "sm:max-w-md gap-0 overflow-visible p-8",
          "border bg-card shadow-xl",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle id={titleId} className="sr-only">
          {mode === "create" ? "New moodboard" : "Edit moodboard"}
        </DialogTitle>

        <div className="flex flex-col items-stretch gap-8">
          <div className="flex justify-center">
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className={cn(
                    "flex size-[5.5rem] shrink-0 cursor-pointer items-center justify-center rounded-full",
                    "border-2 border-border text-[2.75rem] leading-none",
                    "shadow-inner transition-[transform,box-shadow,filter,border-color]",
                    "hover:border-foreground/25 hover:brightness-[1.04] hover:shadow-md",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:pointer-events-none disabled:opacity-60",
                  )}
                  style={{
                    background: `color-mix(in srgb, ${triggerAccent} 14%, var(--card))`,
                  }}
                  aria-label="Choose emoji"
                >
                  <span className="select-none" aria-hidden>
                    {triggerEmoji}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                sideOffset={10}
                className="z-[200] w-[min(100vw-2rem,20rem)] p-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div
                  role="listbox"
                  aria-label="Emoji"
                  className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain p-1"
                >
                  {MOODBOARD_EMOJI_CHOICES.map((emoji) => {
                    const selected = emoji === emojiDraft.trim();
                    return (
                      <button
                        key={emoji}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-md text-lg leading-none",
                          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected && "bg-muted ring-1 ring-border",
                        )}
                        onClick={() => {
                          setEmojiDraft(emoji);
                          setEmojiPickerOpen(false);
                        }}
                      >
                        <span className="select-none">{emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Input
            ref={nameInputRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            disabled={busy}
            placeholder={namePlaceholder}
            autoComplete="off"
            aria-label="Moodboard name"
            className="h-11 text-base"
          />

          <div className="flex flex-row flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-w-[5.5rem]"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-w-[5.5rem]"
              onClick={() => void handleSubmit()}
              disabled={busy}
            >
              {busy ? <Spinner className="size-3.5" /> : primaryLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
