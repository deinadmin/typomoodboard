import type { ReactNode } from "react";
import { ArrowLeft, FileType, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const fadeUp =
  "animate-[landing-fade-up_0.55s_cubic-bezier(0.22,1,0.36,1)_both]";

export interface NewMoodboardEmptyStateProps {
  onAddBlock: () => void;
  onImportClick: () => void;
  /** Hidden file input + handlers (rendered inside the actions column). */
  importSlot: ReactNode;
  onBack?: () => void;
  emptyBackLabel: string;
  className?: string;
}

export function NewMoodboardEmptyState({
  onAddBlock,
  onImportClick,
  importSlot,
  onBack,
  emptyBackLabel,
  className,
}: NewMoodboardEmptyStateProps) {
  return (
    <Empty className={cn("max-w-sm", className)}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className={cn(fadeUp, "[animation-delay:0ms]")}
        >
          <FileType />
        </EmptyMedia>
        <EmptyTitle
          className={cn(fadeUp, "[animation-delay:60ms]")}
        >
          Welcome to your new moodboard!
        </EmptyTitle>
        <EmptyDescription
          className={cn(fadeUp, "[animation-delay:110ms]")}
        >
          Add a heading or body block to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex w-full flex-col gap-2">
          <Button
            type="button"
            className={cn("w-full", fadeUp, "[animation-delay:160ms]")}
            onClick={onAddBlock}
          >
            <Plus className="size-4" />
            Add font block
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full", fadeUp, "[animation-delay:210ms]")}
            onClick={onImportClick}
          >
            <FolderOpen className="size-4" />
            Import .typomoodboard file
          </Button>
          {onBack && (
            <Button
              type="button"
              variant="outline"
              className={cn("w-full", fadeUp, "[animation-delay:260ms]")}
              onClick={onBack}
            >
              <ArrowLeft className="size-4" />
              {emptyBackLabel}
            </Button>
          )}
          {importSlot}
        </div>
      </EmptyContent>
    </Empty>
  );
}
