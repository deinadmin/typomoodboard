import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronDown, Download, Eye, File, FileType, FolderOpen, Plus, Printer, Settings } from "lucide-react";
import type { SyncStatus } from "@/Router";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AddFontDialog } from "@/components/add-font-dialog";
import { FontBlockCard, type FontBlockCardProps } from "@/components/font-block-card";
import { useDebounce } from "@/hooks/use-debounce";
import { generateMoodboardPdf } from "@/lib/pdf";
import {
  queryLocalFonts,
  supportsLocalFonts,
  type LocalFontEntry,
} from "@/lib/fonts";
import { registerFontFile } from "@/lib/storage";
import {
  BODY_DEFAULT_LEADING,
  BODY_DEFAULT_SIZE,
  BODY_PRESET,
  BODY_SAMPLE,
  HEADING_DEFAULT_LEADING,
  HEADING_DEFAULT_SIZE,
  HEADING_PRESET,
  HEADING_SAMPLE,
  type BlockKind,
  type FontBlock,
  type FontUpload,
  type Variant,
} from "@/lib/types";
import { exportTypomoodboard, parseTypomoodboardFile } from "@/lib/typomoodboard-file";

// ── SortableBlockCard wrapper ────────────────────────────────────────────────

type SortableBlockCardProps = Omit<
  FontBlockCardProps,
  "dragHandleListeners" | "dragHandleAttributes" | "isDragging"
>;

function SortableBlockCard(props: SortableBlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.block.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FontBlockCard
        {...props}
        isDragging={isDragging}
        dragHandleListeners={listeners ?? {}}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

function useReorderBlocks(setBlocks: React.Dispatch<React.SetStateAction<FontBlock[]>>) {
  return useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setBlocks((bs) => {
        const oldIdx = bs.findIndex((b) => b.id === active.id);
        const newIdx = bs.findIndex((b) => b.id === over.id);
        return arrayMove(bs, oldIdx, newIdx);
      });
    },
    [setBlocks]
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────

export interface AppProps {
  initialName?: string;
  initialBlocks?: FontBlock[];
  initialDefaultHeadingText?: string;
  initialDefaultBodyText?: string;
  onBack?: () => void;
  onDataChange?: (data: {
    name: string;
    blocks: FontBlock[];
    defaultHeadingText: string;
    defaultBodyText: string;
  }) => void;
  syncStatus?: Exclude<SyncStatus, "idle">;
  backLabel?: string;
  emptyBackLabel?: string;
}

export function App({
  initialName = "My first Typo Moodboard",
  initialBlocks = [],
  initialDefaultHeadingText,
  initialDefaultBodyText,
  onBack,
  onDataChange,
  syncStatus,
  backLabel = "Dashboard",
  emptyBackLabel = "Back to Start",
}: AppProps = {}) {
  const [name, setName] = useState(initialName);
  const [blocks, setBlocks] = useState<FontBlock[]>(initialBlocks);
  const [uploads, setUploads] = useState<FontUpload[]>([]);
  const [systemFonts, setSystemFonts] = useState<LocalFontEntry[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultHeadingText, setDefaultHeadingText] = useState(
    initialDefaultHeadingText ?? HEADING_SAMPLE,
  );
  const [defaultBodyText, setDefaultBodyText] = useState(initialDefaultBodyText ?? BODY_SAMPLE);
  const [settingsHeadingDraft, setSettingsHeadingDraft] = useState(
    initialDefaultHeadingText ?? HEADING_SAMPLE,
  );
  const [settingsBodyDraft, setSettingsBodyDraft] = useState(initialDefaultBodyText ?? BODY_SAMPLE);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const prevUrlRef = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const skipSyncRef = useRef(true);

  // Notify parent of changes for cloud sync (skip initial render)
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    onDataChange?.({
      name,
      blocks,
      defaultHeadingText,
      defaultBodyText,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, blocks, defaultHeadingText, defaultBodyText]);

  useEffect(() => {
    if (supportsLocalFonts()) {
      queryLocalFonts().then(setSystemFonts);
    }
  }, []);

  const debouncedBlocks = useDebounce(blocks, 350);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const bytes = await generateMoodboardPdf(debouncedBlocks);
        if (cancelled) return;
        const arr = new Uint8Array(bytes);
        const blob = new Blob([arr], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        console.error(err);
        toast.error("Failed to render PDF");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedBlocks]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const addBlock = useCallback(
    (kind: BlockKind) => {
      const preset = kind === "heading" ? HEADING_PRESET : BODY_PRESET;
      const defaultSize = kind === "heading" ? HEADING_DEFAULT_SIZE : BODY_DEFAULT_SIZE;

      let source: "system" | "upload" = "system";
      let family = preset.family;
      let style = preset.style;
      let postscriptName: string | undefined;

      if (systemFonts.length) {
        const preferred = systemFonts.find(
          (f) =>
            (f.family === "Helvetica" || f.family === "Arial") &&
            (kind === "heading"
              ? /bold/i.test(f.style)
              : /regular|roman|book/i.test(f.style))
        );
        const pick = preferred ?? systemFonts[0];
        family = pick.family;
        style = pick.style;
        postscriptName = pick.postscriptName;
      }

      const defaultLeading = kind === "heading" ? HEADING_DEFAULT_LEADING : BODY_DEFAULT_LEADING;

      const newBlock: FontBlock = {
        ...preset,
        source,
        family,
        style,
        postscriptName,
        trackingPerMille: 0,
        sampleText: kind === "heading" ? defaultHeadingText : defaultBodyText,
        id: crypto.randomUUID(),
        variants: [
          { id: crypto.randomUUID(), sizePt: defaultSize, leadingPt: defaultLeading },
        ],
      };
      setBlocks((b) => {
        setCollapsedIds(new Set(b.map((block) => block.id)));
        return [...b, newBlock];
      });
      setDialogOpen(false);
    },
    [systemFonts, defaultHeadingText, defaultBodyText]
  );

  const updateBlock = useCallback((id: string, patch: Partial<FontBlock>) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks((bs) => {
      const idx = bs.findIndex((b) => b.id === id);
      if (idx < 0) return bs;
      const copy: FontBlock = {
        ...bs[idx],
        id: crypto.randomUUID(),
        variants: bs[idx].variants.map((v) => ({ ...v, id: crypto.randomUUID() })),
      };
      const next = [...bs];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }, []);

  const setBlockVariants = useCallback((id: string, variants: Variant[]) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, variants } : b)));
  }, []);

  const reorderBlocks = useReorderBlocks(setBlocks);
  const blockSensors = useSensors(useSensor(PointerSensor));

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function onUploadFont(blockId: string, file: File) {
    const family = file.name.replace(/\.(otf|ttf)$/i, "").trim();
    const style = "Regular";
    const upload = await registerFontFile(file, family, style);
    setUploads((u) => [...u, upload]);
    updateBlock(blockId, {
      source: "upload",
      family: upload.family,
      style: upload.style,
      uploadId: upload.id,
      postscriptName: undefined,
    });
    toast.success(`Loaded ${upload.family}`);
  }

  function downloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${name || "moodboard"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function printPdf() {
    if (!pdfUrl) return;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;";
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 60_000);
    };
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseTypomoodboardFile(text);
      if (!parsed) {
        toast.error("Invalid .typomoodboard file");
        return;
      }
      setName(parsed.name);
      setBlocks(parsed.blocks);
      setDefaultHeadingText(parsed.defaultHeadingText);
      setDefaultBodyText(parsed.defaultBodyText);
      setSettingsHeadingDraft(parsed.defaultHeadingText);
      setSettingsBodyDraft(parsed.defaultBodyText);
      setCollapsedIds(new Set(parsed.blocks.slice(0, -1).map((b) => b.id)));
      toast.success(`Imported "${parsed.name}" — ${parsed.blocks.length} block${parsed.blocks.length === 1 ? "" : "s"}`);
    };
    reader.readAsText(file);
  }

  const sidebarStyle = useMemo(
    () => ({ "--sidebar-width": "340px" }) as React.CSSProperties,
    []
  );

  return (
    <SidebarProvider defaultOpen={false} style={sidebarStyle}>
      <AppShell
        name={name}
        setName={setName}
        blocks={blocks}
        uploads={uploads}
        systemFonts={systemFonts}
        collapsedIds={collapsedIds}
        blockSensors={blockSensors}
        reorderBlocks={reorderBlocks}
        updateBlock={updateBlock}
        duplicateBlock={duplicateBlock}
        deleteBlock={deleteBlock}
        setBlockVariants={setBlockVariants}
        toggleCollapse={toggleCollapse}
        onUploadFont={onUploadFont}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsHeadingDraft={settingsHeadingDraft}
        setSettingsHeadingDraft={setSettingsHeadingDraft}
        settingsBodyDraft={settingsBodyDraft}
        setSettingsBodyDraft={setSettingsBodyDraft}
        defaultHeadingText={defaultHeadingText}
        defaultBodyText={defaultBodyText}
        setDefaultHeadingText={setDefaultHeadingText}
        setDefaultBodyText={setDefaultBodyText}
        pdfUrl={pdfUrl}
        rendering={rendering}
        importInputRef={importInputRef}
        onImport={onImport}
        downloadPdf={downloadPdf}
        printPdf={printPdf}
        addBlock={addBlock}
        onBack={onBack}
        backLabel={backLabel}
        emptyBackLabel={emptyBackLabel}
        syncStatus={syncStatus}
      />
    </SidebarProvider>
  );
}

// ── AppShell — uses useSidebar which requires SidebarProvider above ──────────

interface AppShellProps {
  name: string;
  setName: (v: string) => void;
  blocks: FontBlock[];
  uploads: FontUpload[];
  systemFonts: LocalFontEntry[];
  collapsedIds: Set<string>;
  blockSensors: ReturnType<typeof useSensors>;
  reorderBlocks: (e: DragEndEvent) => void;
  updateBlock: (id: string, patch: Partial<FontBlock>) => void;
  duplicateBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  setBlockVariants: (id: string, variants: Variant[]) => void;
  toggleCollapse: (id: string) => void;
  onUploadFont: (blockId: string, file: File) => void;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  settingsHeadingDraft: string;
  setSettingsHeadingDraft: (v: string) => void;
  settingsBodyDraft: string;
  setSettingsBodyDraft: (v: string) => void;
  defaultHeadingText: string;
  defaultBodyText: string;
  setDefaultHeadingText: (v: string) => void;
  setDefaultBodyText: (v: string) => void;
  pdfUrl: string | null;
  rendering: boolean;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  onImport: (file: File) => void;
  downloadPdf: () => void;
  printPdf: () => void;
  addBlock: (kind: BlockKind) => void;
  onBack?: () => void;
  backLabel: string;
  emptyBackLabel: string;
  syncStatus?: Exclude<SyncStatus, "idle">;
}

function AppShell({
  name, setName, blocks, uploads, systemFonts, collapsedIds,
  blockSensors, reorderBlocks, updateBlock, duplicateBlock, deleteBlock,
  setBlockVariants, toggleCollapse, onUploadFont,
  dialogOpen, setDialogOpen, settingsOpen, setSettingsOpen,
  settingsHeadingDraft, setSettingsHeadingDraft,
  settingsBodyDraft, setSettingsBodyDraft,
  defaultHeadingText, defaultBodyText,
  setDefaultHeadingText, setDefaultBodyText,
  pdfUrl, rendering, importInputRef, onImport,
  downloadPdf, printPdf, addBlock,
  onBack, backLabel, emptyBackLabel, syncStatus,
}: AppShellProps) {
  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile } = useSidebar();
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const isEmpty = blocks.length === 0;

  useEffect(() => {
    if (!isMobile) setSidebarOpen(!isEmpty);
  }, [isEmpty, isMobile, setSidebarOpen]);

  useEffect(() => {
    if (!isMobile || isEmpty) setMobilePreviewOpen(false);
  }, [isEmpty, isMobile]);

  useEffect(() => {
    if (!isMobile) setMobileSettingsOpen(false);
    else setSettingsOpen(false);
  }, [isMobile, setSettingsOpen]);

  const openSettings = () => {
    setSettingsHeadingDraft(defaultHeadingText);
    setSettingsBodyDraft(defaultBodyText);
    if (isMobile) {
      setMobilePreviewOpen(false);
      setMobileSettingsOpen(true);
    } else {
      setSettingsOpen(true);
    }
  };

  const closeSettings = () => {
    if (isMobile) setMobileSettingsOpen(false);
    else setSettingsOpen(false);
  };

  const saveSettings = () => {
    setDefaultHeadingText(settingsHeadingDraft);
    setDefaultBodyText(settingsBodyDraft);
    closeSettings();
  };

  const exportMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" />
          Export
          <ChevronDown className="size-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadPdf} disabled={!pdfUrl}>
          <Download className="size-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportTypomoodboard(name, blocks, defaultHeadingText, defaultBodyText)}
        >
          <File className="size-4" />
          Export .typomoodboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={printPdf} disabled={!pdfUrl}>
          <Printer className="size-4" />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const importInput = (
    <input
      ref={importInputRef}
      type="file"
      accept=".typomoodboard,application/json,text/plain"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onImport(file);
        e.target.value = "";
      }}
    />
  );

  const fontManager = (
    <>
      <SidebarHeader className="flex h-14 shrink-0 flex-row items-center gap-2 border-b border-sidebar-border px-3 py-0">
        <div className="flex min-h-0 w-full min-w-0 items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              className="h-9 shrink-0 gap-2 px-2 font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={onBack}
            >
              <ArrowLeft className="size-4 shrink-0 opacity-80" aria-hidden />
              {backLabel}
            </Button>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                disabled={isEmpty || !pdfUrl}
                onClick={() => setMobilePreviewOpen(true)}
              >
                <Eye className="size-3.5" />
                Preview
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={openSettings}
            >
              <Settings className="size-3.5" />
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0 relative">
        <ScrollArea className="h-full">
          {isEmpty ? (
            isMobile ? (
              <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
                <Empty className="max-w-sm">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileType />
                    </EmptyMedia>
                    <EmptyTitle>Welcome to your new moodboard!</EmptyTitle>
                    <EmptyDescription>
                      Add a heading or body block to get started.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <div className="flex w-full flex-col gap-2">
                      <Button
                        className="w-full"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                        Add font block
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => importInputRef.current?.click()}
                      >
                        <FolderOpen className="size-4" />
                        Import .typomoodboard file
                      </Button>
                      {onBack && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={onBack}
                        >
                          <ArrowLeft className="size-4" />
                          {emptyBackLabel}
                        </Button>
                      )}
                      {importInput}
                    </div>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">No font blocks yet.</p>
              </div>
            )
          ) : (
            <DndContext
              sensors={blockSensors}
              collisionDetection={closestCenter}
              onDragEnd={reorderBlocks}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {blocks.map((b) => (
                    <SortableBlockCard
                      key={b.id}
                      block={b}
                      collapsed={collapsedIds.has(b.id)}
                      systemFonts={systemFonts}
                      uploads={uploads}
                      onChange={(patch) => updateBlock(b.id, patch)}
                      onDuplicate={() => duplicateBlock(b.id)}
                      onDelete={() => deleteBlock(b.id)}
                      onFileUpload={(file) => onUploadFont(b.id, file)}
                      onVariantsChange={(variants) => setBlockVariants(b.id, variants)}
                      onToggleCollapse={() => toggleCollapse(b.id)}
                    />
                  ))}
                  <div className="h-16" />
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>

        {/* Floating add button */}
        {(!isMobile || !isEmpty) && (
          <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-6 bg-gradient-to-t from-sidebar to-transparent pointer-events-none">
            <Button
              onClick={() => setDialogOpen(true)}
              variant="default"
              className="w-full pointer-events-auto shadow-sm"
            >
              <Plus className="size-3.5" />
              Add font block
            </Button>
          </div>
        )}
      </SidebarContent>
    </>
  );

  const previewFrame = isEmpty ? (
    <div className="flex h-full items-center justify-center">
      <Empty className="max-w-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileType />
          </EmptyMedia>
          <EmptyTitle>Welcome to your new moodboard!</EmptyTitle>
          <EmptyDescription>
            Add a heading or body block to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex w-full flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-4" />
              Add font block
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => importInputRef.current?.click()}
            >
              <FolderOpen className="size-4" />
              Import .typomoodboard file
            </Button>
            {onBack && (
              <Button
                variant="outline"
                className="w-full"
                onClick={onBack}
              >
                <ArrowLeft className="size-4" />
                {emptyBackLabel}
              </Button>
            )}
            {importInput}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  ) : (
    <iframe
      key={pdfUrl ?? "empty"}
      src={pdfUrl ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0` : undefined}
      title="Moodboard PDF"
      className="block h-full w-full"
    />
  );

  const settingsForm = (
    <div className={isMobile ? "flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-4" : "flex flex-col gap-5 py-2"}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-heading">Heading</Label>
        <Textarea
          id="settings-heading"
          rows={3}
          value={settingsHeadingDraft}
          onChange={(e) => setSettingsHeadingDraft(e.target.value)}
          className="resize-none"
        />
      </div>
      <div className={isMobile ? "flex min-h-0 flex-1 flex-col gap-2" : "flex flex-col gap-2"}>
        <Label htmlFor="settings-body">Body</Label>
        <Textarea
          id="settings-body"
          rows={6}
          value={settingsBodyDraft}
          onChange={(e) => setSettingsBodyDraft(e.target.value)}
          className={isMobile ? "min-h-48 flex-1 resize-none" : "resize-none"}
        />
      </div>
    </div>
  );

  const settingsActions = (
    <>
      <Button
        variant="outline"
        onClick={closeSettings}
      >
        Cancel
      </Button>
      <Button onClick={saveSettings}>
        Save
      </Button>
    </>
  );

  return (
    <>
      {!isMobile && <Sidebar>{fontManager}</Sidebar>}

      <SidebarInset className={isMobile ? "bg-sidebar" : "bg-muted/40"}>
        {isMobile ? (
          mobileSettingsOpen ? (
            <>
              <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setMobileSettingsOpen(false)}
                >
                  <ArrowLeft className="size-5" />
                  <span className="sr-only">Back to font management</span>
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">Default sample text</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    Typo Moodboard settings
                  </div>
                </div>
              </header>
              <main className="flex min-h-0 flex-1 flex-col bg-background">
                {settingsForm}
                <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
                  {settingsActions}
                </div>
              </main>
            </>
          ) : mobilePreviewOpen ? (
            <>
              <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setMobilePreviewOpen(false)}
                >
                  <ArrowLeft className="size-5" />
                  <span className="sr-only">Back to font management</span>
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {rendering ? (
                      <>
                        <Spinner className="size-3" /> Rendering PDF...
                      </>
                    ) : (
                      <>A4 / {blocks.length} block{blocks.length === 1 ? "" : "s"}</>
                    )}
                  </div>
                </div>
                {!isEmpty && exportMenu}
              </header>
              <main className="flex-1 overflow-hidden bg-muted/40">
                {previewFrame}
              </main>
            </>
          ) : (
            <section className="flex h-svh min-h-0 flex-col bg-sidebar text-sidebar-foreground">
              {fontManager}
            </section>
          )
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 max-w-xs ml-[-6px] mr-[-2px] border-transparent bg-transparent px-3 text-sm font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
              />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {rendering ? (
                  <>
                    <Spinner className="size-3" /> Rendering PDF...
                  </>
                ) : (
                  <>A4 / {blocks.length} block{blocks.length === 1 ? "" : "s"}</>
                )}
                {syncStatus === "syncing" && (
                  <span className="flex items-center gap-1 text-muted-foreground/70">
                    <span className="mx-1 opacity-40">·</span>
                    <Spinner className="size-3" /> Syncing
                  </span>
                )}
                {syncStatus === "synced" && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span className="mx-1 opacity-40">·</span>
                    <Check className="size-3" /> Saved
                  </span>
                )}
                {syncStatus === "error" && (
                  <span className="flex items-center gap-1 text-destructive">
                    <span className="mx-1 opacity-40">·</span>
                    <AlertCircle className="size-3" /> Sync failed
                  </span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {isEmpty ? (
                  !sidebarOpen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={openSettings}
                    >
                      <Settings className="size-4" />
                    </Button>
                  )
                ) : (
                  exportMenu
                )}
              </div>
            </header>
            <main className="flex-1 overflow-hidden">
              {previewFrame}
            </main>
          </>
        )}
      </SidebarInset>

      <AddFontDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChoose={addBlock}
      />

      {!isMobile && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Default sample text</DialogTitle>
            </DialogHeader>
            {settingsForm}
            <DialogFooter>
              {settingsActions}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default App;
