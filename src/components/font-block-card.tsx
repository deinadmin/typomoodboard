import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  CopyPlus,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FontPicker, getStylesForFamily } from "@/components/font-picker";
import type { FontBlock, FontUpload, Variant } from "@/lib/types";
import type { LocalFontEntry } from "@/lib/fonts";

export interface FontBlockCardProps {
  block: FontBlock;
  collapsed: boolean;
  /** dnd-kit drag attributes/listeners/ref forwarded from parent SortableContext */
  dragHandleListeners: React.HTMLAttributes<HTMLElement>;
  dragHandleAttributes: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
  systemFonts: LocalFontEntry[];
  uploads: FontUpload[];
  onChange: (patch: Partial<FontBlock>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFileUpload: (file: File) => void;
  onVariantsChange: (variants: Variant[]) => void;
  onToggleCollapse: () => void;
}

interface SortableVariantRowProps {
  variant: Variant;
  index: number;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<Variant>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

function SortableVariantRow({
  variant: v,
  index,
  canRemove,
  onUpdate,
  onDuplicate,
  onRemove,
}: SortableVariantRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: v.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-3.5" />
      </button>

      <span className="w-4 shrink-0 text-[10px] text-muted-foreground text-right select-none">
        {index + 1}
      </span>

      <div className="flex-1 grid grid-cols-2 gap-1.5">
        <div className="relative">
          <Input
            type="number"
            min={1}
            step={0.5}
            value={v.sizePt}
            onChange={(e) =>
              onUpdate(v.id, { sizePt: Number(e.target.value) || 0 })
            }
            className="h-7 pr-6 text-xs"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            pt
          </span>
        </div>
        <div className="relative">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={v.leadingPt}
            onChange={(e) =>
              onUpdate(v.id, { leadingPt: Number(e.target.value) || 0 })
            }
            className="h-7 pr-5 text-xs"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            ld
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(v.id)}
              aria-label="Duplicate size"
            >
              <CopyPlus className="size-2.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate size</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(v.id)}
              aria-label="Remove size"
              disabled={!canRemove}
            >
              <Trash2 className="size-2.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove size</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function FontBlockCard({
  block,
  collapsed,
  dragHandleListeners,
  dragHandleAttributes,
  isDragging,
  systemFonts,
  uploads,
  onChange,
  onDuplicate,
  onDelete,
  onFileUpload,
  onVariantsChange,
  onToggleCollapse,
}: FontBlockCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [draftText, setDraftText] = useState("");

  const styles = useMemo(
    () =>
      getStylesForFamily(systemFonts, uploads, block.family, block.source),
    [systemFonts, uploads, block.family, block.source]
  );

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = block.variants.findIndex((v) => v.id === active.id);
      const newIdx = block.variants.findIndex((v) => v.id === over.id);
      onVariantsChange(arrayMove(block.variants, oldIdx, newIdx));
    }
  }

  function updateVariant(id: string, patch: Partial<Variant>) {
    onVariantsChange(
      block.variants.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  }

  function addVariant() {
    const last = block.variants[block.variants.length - 1];
    const sizePt = last
      ? last.sizePt
      : block.kind === "heading"
        ? 36
        : 10;
    const leadingPt = last
      ? last.leadingPt
      : block.kind === "heading"
        ? 40
        : 14;
    onVariantsChange([
      ...block.variants,
      { id: crypto.randomUUID(), sizePt, leadingPt },
    ]);
  }

  function duplicateVariant(id: string) {
    const idx = block.variants.findIndex((v) => v.id === id);
    if (idx < 0) return;
    const copy: Variant = {
      ...block.variants[idx],
      id: crypto.randomUUID(),
    };
    const next = [...block.variants];
    next.splice(idx + 1, 0, copy);
    onVariantsChange(next);
  }

  function removeVariant(id: string) {
    onVariantsChange(block.variants.filter((v) => v.id !== id));
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div style={{ opacity: isDragging ? 0.4 : 1 }}>
        {/* ── Header row — always visible, drag handle lives here ── */}
        <div
          className={
            "flex items-center justify-between px-4 py-3" +
            (collapsed ? " cursor-grab active:cursor-grabbing" : "")
          }
          /* When collapsed the whole header row is the drag target */
          {...(collapsed ? dragHandleListeners : {})}
          {...(collapsed ? dragHandleAttributes : {})}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Drag handle — always visible; when collapsed the whole row also acts as drag target */}
            <button
              {...(!collapsed ? dragHandleListeners : {})}
              {...(!collapsed ? dragHandleAttributes : {})}
              className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              aria-label="Drag to reorder block"
            >
              <GripVertical className="size-3.5" />
            </button>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground select-none">
              {block.kind === "heading" ? "Heading" : "Body"}
            </span>
          </div>

          {/* Action buttons — order: edit sample | duplicate | trash | chevron */}
          <div
            className="flex items-center gap-0.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDraftText(block.sampleText);
                    setEditDialogOpen(true);
                  }}
                  aria-label="Edit sample text"
                >
                  <Pencil className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit sample text</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={onDuplicate}
                  aria-label="Duplicate block"
                >
                  <CopyPlus className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate block</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  aria-label="Delete block"
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete block</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={onToggleCollapse}
                  aria-label={collapsed ? "Expand block" : "Collapse block"}
                >
                  {collapsed ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronUp className="size-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {collapsed ? "Expand block" : "Collapse block"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Animated collapsible body ── */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{
            gridTemplateRows: collapsed ? "0fr" : "1fr",
          }}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-3 space-y-3">
              {/* Font family picker */}
              <FontPicker
                value={{
                  source: block.source,
                  family: block.family,
                  style: block.style,
                  postscriptName: block.postscriptName,
                  uploadId: block.uploadId,
                }}
                uploads={uploads}
                onChange={(s) => onChange(s)}
              />

              {/* Style + tracking + upload row */}
              <div className="flex items-center gap-2">
                <Select
                  value={block.style}
                  onValueChange={(v) => {
                    if (block.source === "system") {
                      const match = systemFonts.find(
                        (f) =>
                          f.family === block.family && f.style === v
                      );
                      onChange({
                        style: v,
                        postscriptName: match?.postscriptName,
                      });
                    } else {
                      const match = uploads.find(
                        (u) =>
                          u.family === block.family && u.style === v
                      );
                      onChange({ style: v, uploadId: match?.id });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent>
                    {(styles.length ? styles : [block.style]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative shrink-0">
                      <Input
                        type="number"
                        step={1}
                        value={block.trackingPerMille}
                        onChange={(e) =>
                          onChange({ trackingPerMille: Number(e.target.value) || 0 })
                        }
                        className="h-8 w-20 pr-6 text-xs"
                        aria-label="Tracking (Zeichenabstand)"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        tk
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Tracking</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload font file"
                    >
                      <Upload className="size-3" />
                      Upload
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload .otf / .ttf font file</TooltipContent>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".otf,.ttf,font/otf,font/ttf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>

              <Separator className="my-1" />

              {/* Variants */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Sizes
                  </Label>
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-5 w-5 p-0 rounded border transition-all ${
                            block.twoColumnSizes
                              ? "border-border bg-accent text-foreground hover:bg-accent hover:text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => onChange({ twoColumnSizes: !block.twoColumnSizes })}
                          aria-label={block.twoColumnSizes ? "Switch to single-column sizes" : "Switch to two-column sizes"}
                          aria-pressed={block.twoColumnSizes}
                        >
                          <Columns2 className="size-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {block.twoColumnSizes ? "Disable two-column view" : "Enable two-column view"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                          onClick={addVariant}
                          aria-label="Add size"
                        >
                          <Plus className="size-2.5" />
                          Add
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add size variant</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={block.variants.map((v) => v.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {block.variants.map((v, idx) => (
                        <SortableVariantRow
                          key={v.id}
                          variant={v}
                          index={idx}
                          canRemove={block.variants.length > 1}
                          onUpdate={updateVariant}
                          onDuplicate={duplicateVariant}
                          onRemove={removeVariant}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        </div>

        {/* Always-present bottom divider */}
        <Separator className="bg-sidebar-border" />
      </div>

      {/* ── Edit sample text dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit sample text</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-36 resize-y text-sm"
            placeholder="Type sample text…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange({ sampleText: draftText });
                setEditDialogOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
