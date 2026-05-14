import { useEffect, useRef, useState } from "react";
import { signOut, type User } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { FileType, FolderOpen, LogOut, MoreHorizontal, Pen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import {
  createMoodboard,
  createMoodboardFromImport,
  deleteMoodboard,
  updateMoodboardMeta,
  subscribeMoodboards,
  type MoodboardMeta,
} from "@/lib/firestore";
import { parseTypomoodboardFile } from "@/lib/typomoodboard-file";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { MoodboardMetaDialog } from "@/components/moodboard-meta-dialog";
import { getMoodboardCardAccent } from "@/lib/moodboard-emojis";
import { cn } from "@/lib/utils";

interface DashboardProps {
  user: User;
  moodboards: MoodboardMeta[];
  onSignOut: () => void;
}

export function DashboardRoute({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [moodboards, setMoodboards] = useState<MoodboardMeta[] | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeMoodboards(user.uid, (boards) => {
      setMoodboards(boards);
    });
    return unsub;
  }, [user.uid]);

  if (moodboards === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return <Dashboard user={user} moodboards={moodboards} onSignOut={onSignOut} />;
}

/** Placeholder and name used when the user leaves the name field empty. */
const UNTITLED_MOODBOARD_NAME = "Untitled Moodboard";

type MetaEditorState =
  | null
  | { mode: "create" }
  | { mode: "edit"; boardId: string; initialName: string; initialEmoji: string };

export function Dashboard({ user, moodboards, onSignOut }: DashboardProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [metaEditor, setMetaEditor] = useState<MetaEditorState>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreateMetaDialog() {
    setMetaEditor({ mode: "create" });
  }

  async function handleMetaSubmit(payload: { name: string; iconEmoji: string }) {
    if (!metaEditor) return;
    const trimmed = payload.name.trim();
    if (metaEditor.mode === "edit" && !trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    const name = trimmed || UNTITLED_MOODBOARD_NAME;
    setMetaBusy(true);
    try {
      if (metaEditor.mode === "create") {
        setCreating(true);
        const id = await createMoodboard(user.uid, name, payload.iconEmoji);
        setMetaEditor(null);
        navigate(`/p/${id}`);
      } else {
        await updateMoodboardMeta(user.uid, metaEditor.boardId, {
          name,
          iconEmoji: payload.iconEmoji,
        });
        toast.success("Changes saved");
        setMetaEditor(null);
      }
    } catch {
      toast.error(
        metaEditor.mode === "create" ? "Could not create moodboard" : "Could not save moodboard",
      );
    } finally {
      setMetaBusy(false);
      setCreating(false);
    }
  }

  async function handleTypomoodboardFile(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read that file.");
      return;
    }
    const parsed = parseTypomoodboardFile(text);
    if (!parsed) {
      toast.error("This file is not a valid .typomoodboard export.");
      return;
    }
    setImporting(true);
    try {
      const displayName = parsed.name.trim() || "Untitled Moodboard";
      const id = await createMoodboardFromImport(
        user.uid,
        displayName,
        parsed.blocks,
        parsed.defaultHeadingText,
        parsed.defaultBodyText,
        parsed.iconEmoji,
      );
      toast.success(`Imported “${displayName}”`);
      navigate(`/p/${id}`);
    } catch {
      toast.error("Could not create moodboard from file");
    } finally {
      setImporting(false);
    }
  }

  async function confirmDeleteMoodboard() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMoodboard(user.uid, deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete moodboard");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    if (auth) await signOut(auth);
    onSignOut();
  }

  const initials = (user.displayName ?? user.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="min-h-svh bg-background text-foreground"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-30 h-14 shrink-0 border-b border-border bg-background",
          "motion-safe:animate-[app-menubar-enter_0.38s_cubic-bezier(0.22,1,0.36,1)_both]",
        )}
      >
        <div className="container mx-auto flex h-full items-center gap-4 px-6">
          <span className="text-base font-semibold tracking-tight">Dashboard</span>

          <div className="ml-auto flex items-center gap-3">
            <input
              ref={importInputRef}
              type="file"
              accept=".typomoodboard,application/json,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleTypomoodboardFile(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="hidden md:inline-flex"
              disabled={importing || creating}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Spinner className="size-3.5" /> : <FolderOpen className="size-3.5" />}
              Import .typomoodboard file
            </Button>
            <Button
              size="sm"
              className="hidden md:inline-flex"
              onClick={openCreateMetaDialog}
              disabled={creating || importing || metaEditor !== null}
            >
              {creating ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
              New Moodboard
            </Button>

            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="size-8 rounded-full overflow-hidden ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:ring-foreground/30 transition-shadow shrink-0"
                  aria-label="Account menu"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? "Profile"}
                      className="size-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="size-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {initials}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-6">
        {moodboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <FileType className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">No moodboards yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first typographic moodboard.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {moodboards.map((board, index) => (
              <div
                key={board.id}
                className="min-w-0 animate-[landing-fade-up_0.38s_cubic-bezier(0.22,1,0.36,1)_both]"
                style={{ animationDelay: `${index * 36}ms` }}
              >
                <MoodboardCard
                  board={board}
                  onOpen={() => navigate(`/p/${board.id}`)}
                  onRequestDelete={() => setDeleteTarget({ id: board.id, name: board.name })}
                  onRequestEdit={() =>
                    setMetaEditor({
                      mode: "edit",
                      boardId: board.id,
                      initialName: board.name,
                      initialEmoji: board.iconEmoji,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <Button
        size="lg"
        className={cn(
          "fixed z-40 gap-2 rounded-full px-5 shadow-lg md:hidden",
          "bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))]",
          "motion-safe:animate-[landing-fade-up_0.38s_cubic-bezier(0.22,1,0.36,1)_both]",
        )}
        onClick={openCreateMetaDialog}
        disabled={creating || importing || metaEditor !== null}
      >
        {creating ? <Spinner className="size-4" /> : <Plus className="size-4" />}
        New Moodboard
      </Button>

      <MoodboardMetaDialog
        open={metaEditor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMetaEditor(null);
            setMetaBusy(false);
          }
        }}
        mode={metaEditor?.mode ?? "create"}
        initialName={metaEditor?.mode === "edit" ? metaEditor.initialName : undefined}
        initialEmoji={metaEditor?.mode === "edit" ? metaEditor.initialEmoji : undefined}
        namePlaceholder={UNTITLED_MOODBOARD_NAME}
        busy={metaBusy}
        onSubmit={handleMetaSubmit}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleting(false);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete moodboard?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete{" "}
                  <span className="font-medium text-foreground">“{deleteTarget.name}”</span>. This
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDeleteMoodboard()}
            >
              {deleting ? <Spinner className="size-3.5" /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MoodboardCardProps {
  board: MoodboardMeta;
  onOpen: () => void;
  onRequestDelete: () => void;
  onRequestEdit: () => void;
}

function MoodboardCard({ board, onOpen, onRequestDelete, onRequestEdit }: MoodboardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardAccent = getMoodboardCardAccent(board.iconEmoji);

  const relativeDate = formatDistanceToNow(board.updatedAt, { addSuffix: true });
  const blockLabel = board.blockCount === 1 ? "1 block" : `${board.blockCount} blocks`;

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-border bg-white text-left",
        "transition-all duration-200 hover:border-foreground/20 hover:shadow-md",
        "dark:bg-card",
      )}
    >
      {/* Full-card tint only on hover; base stays white / card */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100",
        )}
        style={{
          background: `color-mix(in srgb, ${cardAccent} 5.5%, var(--card))`,
        }}
      />
      {/* Open target: keep menu trigger outside this subtree so Radix portal + focus work reliably */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleCardKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={cn(
          "relative z-[1] cursor-pointer rounded-xl p-5 pr-14 flex flex-col gap-3",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-card",
        )}
      >
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-lg",
              "text-[1.35rem] leading-none tracking-normal transition-[filter] duration-150 group-hover:brightness-[1.03]",
            )}
            style={{
              background: `color-mix(in srgb, ${cardAccent} 28%, var(--card))`,
            }}
            aria-hidden
          >
            <span className="select-none">{board.iconEmoji}</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold truncate leading-snug">{board.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {blockLabel} · {relativeDate}
          </p>
        </div>
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-2 top-2 z-[2] size-8 rounded-md text-muted-foreground",
              "border border-border bg-card/95 shadow-sm backdrop-blur-[2px]",
              "hover:border-foreground/20 hover:bg-muted hover:text-foreground",
              "opacity-0 transition-[opacity,colors,box-shadow] group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            )}
            aria-label="Card options"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen(true);
            }}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[200]">
          <DropdownMenuItem
            onSelect={() => {
              setTimeout(() => onRequestEdit(), 0);
            }}
          >
            <Pen className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete()}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
