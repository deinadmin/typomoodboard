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
  renameMoodboard,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

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

export function Dashboard({ user, moodboards, onSignOut }: DashboardProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreateNew() {
    setCreating(true);
    try {
      const id = await createMoodboard(user.uid, "Untitled Moodboard");
      navigate(`/p/${id}`);
    } catch {
      toast.error("Could not create moodboard");
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

  async function handleRename(boardId: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return false;
    }
    try {
      await renameMoodboard(user.uid, boardId, trimmed);
      toast.success("Moodboard renamed");
      return true;
    } catch {
      toast.error("Could not rename moodboard");
      return false;
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
      <header className="h-14 border-b border-border">
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
              disabled={importing || creating}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Spinner className="size-3.5" /> : <FolderOpen className="size-3.5" />}
              Import .typomoodboard file
            </Button>
            <Button size="sm" onClick={handleCreateNew} disabled={creating || importing}>
              {creating ? (
                <Spinner className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
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
            <Button size="sm" onClick={handleCreateNew} disabled={creating || importing}>
              {creating ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
              New Moodboard
            </Button>
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
                  onRename={(name) => handleRename(board.id, name)}
                />
              </div>
            ))}
          </div>
        )}
      </main>

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
  onRename: (newName: string) => Promise<boolean>;
}

function MoodboardCard({ board, onOpen, onRequestDelete, onRename }: MoodboardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(board.name);
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const relativeDate = formatDistanceToNow(board.updatedAt, { addSuffix: true });
  const blockLabel = board.blockCount === 1 ? "1 block" : `${board.blockCount} blocks`;

  useEffect(() => {
    if (!renameOpen) return;
    const id = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [renameOpen]);

  async function submitRename() {
    if (renameDraft.trim() === board.name.trim()) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const ok = await onRename(renameDraft);
      if (ok) setRenameOpen(false);
    } finally {
      setRenaming(false);
    }
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <>
      <div className="group relative w-full rounded-xl border border-border bg-card text-left transition-all duration-150 hover:border-foreground/20 hover:shadow-md">
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
          className="cursor-pointer rounded-xl p-5 pr-14 flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <div className="flex items-start gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-foreground/8 transition-colors">
              <FileType className="size-4" />
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
              className="absolute right-2 top-2 z-10 size-8 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
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
                setRenameDraft(board.name);
                setTimeout(() => setRenameOpen(true), 0);
              }}
            >
              <Pen className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete()}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setRenameDraft(board.name);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename moodboard</DialogTitle>
            <DialogDescription>Choose a new name for this moodboard.</DialogDescription>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitRename();
            }}
            disabled={renaming}
            aria-label="Moodboard name"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitRename()} disabled={renaming}>
              {renaming ? <Spinner className="size-3.5" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
