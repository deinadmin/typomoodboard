import { Heading1, ChevronLeft as AlignLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BlockKind } from "@/lib/types";

interface AddFontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (kind: BlockKind) => void;
}

export function AddFontDialog({ open, onOpenChange, onChoose }: AddFontDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add font block</DialogTitle>
          <DialogDescription>
            Choose a preset. You can change the font, size and leading afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => onChoose("heading")}
            className="group flex h-40 flex-col items-start justify-between rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-ring hover:bg-accent"
          >
            <Heading1 className="size-5 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                Heading
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Bold / 36 pt / 40 pt leading
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onChoose("body")}
            className="group flex h-40 flex-col items-start justify-between rounded-md border border-border bg-card p-4 text-left transition-colors hover:border-ring hover:bg-accent"
          >
            <AlignLeft className="size-5 text-muted-foreground" />
            <div>
              <div className="text-base font-normal leading-tight text-foreground">
                Body text
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Regular / 10 pt / 14 pt leading
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
