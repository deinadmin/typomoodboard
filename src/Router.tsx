import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { getMoodboard, updateMoodboard } from "@/lib/firestore";
import { Landing } from "@/components/landing";
import { DashboardRoute } from "@/components/dashboard";
import { App } from "@/App";
import { Spinner } from "@/components/ui/spinner";
import type { FontBlock } from "@/lib/types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

const SYNC_DEBOUNCE_MS = 1200;

function SpinnerScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  return (
    <Landing
      onSignIn={() => navigate("/dashboard", { replace: true })}
      onContinueLocal={() => navigate("/local", { replace: true })}
    />
  );
}

function LocalEditorPage() {
  const navigate = useNavigate();
  const handleBack = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return <App onBack={handleBack} backLabel="Back" />;
}

function MoodboardEditorPage({ user }: { user: User }) {
  const { moodboardId } = useParams<{ moodboardId: string }>();
  const navigate = useNavigate();
  const id = moodboardId ?? "";

  const [ready, setReady] = useState(false);
  const [initialName, setInitialName] = useState("");
  const [initialBlocks, setInitialBlocks] = useState<FontBlock[]>([]);
  const [initialDefaultHeadingText, setInitialDefaultHeadingText] = useState("");
  const [initialDefaultBodyText, setInitialDefaultBodyText] = useState("");

  const latestDataRef = useRef<{
    name: string;
    blocks: FontBlock[];
    defaultHeadingText: string;
    defaultBodyText: string;
  } | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  useEffect(() => {
    if (!id) return;
    const thisId = id;
    let cancelled = false;

    latestDataRef.current = null;
    setSyncStatus("idle");
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setReady(false);

    void (async () => {
      try {
        const data = await getMoodboard(user.uid, thisId);
        if (cancelled) return;
        if (!data) {
          toast.error("Could not load moodboard");
          navigate("/dashboard", { replace: true });
          return;
        }
        setInitialName(data.name);
        setInitialBlocks(data.blocks);
        setInitialDefaultHeadingText(data.defaultHeadingText);
        setInitialDefaultBodyText(data.defaultBodyText);
        setReady(true);
      } catch {
        if (!cancelled) {
          toast.error("Could not load moodboard");
          navigate("/dashboard", { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const latest = latestDataRef.current;
      if (latest) {
        void updateMoodboard(
          user.uid,
          thisId,
          latest.name,
          latest.blocks,
          latest.defaultHeadingText,
          latest.defaultBodyText,
        ).catch(() => {});
      }
      latestDataRef.current = null;
    };
  }, [user.uid, id, navigate]);

  const handleDataChange = useCallback(
    (payload: {
      name: string;
      blocks: FontBlock[];
      defaultHeadingText: string;
      defaultBodyText: string;
    }) => {
      if (!id) return;
      latestDataRef.current = payload;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      setSyncStatus("syncing");
      syncTimerRef.current = setTimeout(async () => {
        const latest = latestDataRef.current;
        if (!latest) return;
        try {
          await updateMoodboard(
            user.uid,
            id,
            latest.name,
            latest.blocks,
            latest.defaultHeadingText,
            latest.defaultBodyText,
          );
          setSyncStatus("synced");
        } catch (err) {
          console.error("Sync failed:", err);
          setSyncStatus("error");
        }
      }, SYNC_DEBOUNCE_MS);
    },
    [user.uid, id],
  );

  const handleBack = useCallback(async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const latest = latestDataRef.current;
    if (latest && id) {
      try {
        await updateMoodboard(
          user.uid,
          id,
          latest.name,
          latest.blocks,
          latest.defaultHeadingText,
          latest.defaultBodyText,
        );
      } catch {
        // ignore on navigate-away
      }
    }
    latestDataRef.current = null;
    setSyncStatus("idle");
    navigate("/dashboard");
  }, [user.uid, id, navigate]);

  if (!id) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!ready) {
    return <SpinnerScreen />;
  }

  return (
    <App
      key={id}
      initialName={initialName}
      initialBlocks={initialBlocks}
      initialDefaultHeadingText={initialDefaultHeadingText}
      initialDefaultBodyText={initialDefaultBodyText}
      onBack={handleBack}
      emptyBackLabel="Back to Dashboard"
      onDataChange={handleDataChange}
      syncStatus={syncStatus === "idle" ? undefined : syncStatus}
    />
  );
}

function FirebaseRoutes() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleSignOut = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const sessionUser = user ?? auth?.currentUser ?? null;

  if (authLoading) {
    return <SpinnerScreen />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          sessionUser ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LandingPage />
          )
        }
      />
      <Route path="/local" element={<LocalEditorPage />} />
      <Route
        path="/dashboard"
        element={
          sessionUser ? (
            <DashboardRoute user={sessionUser} onSignOut={handleSignOut} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/p/:moodboardId"
        element={
          sessionUser ? (
            <MoodboardEditorPage user={sessionUser} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={sessionUser ? "/dashboard" : "/"} replace />
        }
      />
    </Routes>
  );
}

function OfflineLandingPage() {
  const navigate = useNavigate();
  return (
    <Landing
      onSignIn={() => navigate("/local", { replace: true })}
      onContinueLocal={() => navigate("/local", { replace: true })}
    />
  );
}

function OfflineRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OfflineLandingPage />} />
      <Route path="/local" element={<LocalEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function Router() {
  if (!isFirebaseConfigured || !auth) {
    return (
      <BrowserRouter>
        <OfflineRoutes />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <FirebaseRoutes />
    </BrowserRouter>
  );
}
