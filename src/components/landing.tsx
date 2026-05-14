import { useState } from "react";
import { signInWithPopup, type User } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LandingProps {
  onSignIn: (user: User) => void;
  onContinueLocal: () => void;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const fadeUp =
  "animate-[landing-fade-up_0.55s_cubic-bezier(0.22,1,0.36,1)_both]";

export function Landing({ onSignIn, onContinueLocal }: LandingProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSignIn(result.user);
    } catch (err) {
      console.error(err);
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_45%,var(--color-muted-foreground)_/_0.06,transparent_65%)]"
      />

      <div
        className={cn(
          "relative flex w-full max-w-[400px] flex-col rounded-[20px] border border-border bg-card p-10 pb-8 text-card-foreground shadow-xl",
          fadeUp,
        )}
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <h1
            className={cn(
              "text-[clamp(1.75rem,6vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-foreground",
              fadeUp,
              "[animation-delay:60ms]",
            )}
          >
            Typo Moodboard
          </h1>
          <p
            className={cn(
              "max-w-[28ch] text-sm leading-relaxed text-muted-foreground",
              fadeUp,
              "[animation-delay:110ms]",
            )}
          >
            Create Typo Moodboards with 100% InDesign accuracy to
            find the perfect Typography for your next project!
          </p>
        </div>

        <div
          className={cn(
            "mb-8 h-px w-full shrink-0 bg-border",
            fadeUp,
            "[animation-delay:140ms]",
          )}
        />

        <div className={cn("flex flex-col gap-3", fadeUp, "[animation-delay:180ms]")}>
          {isFirebaseConfigured && (
            <Button
              type="button"
              size="lg"
              className="h-11 w-full rounded-[10px] gap-2.5 text-[0.875rem] font-medium tracking-tight"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Spinner className="size-[18px] text-muted-foreground" />
              ) : (
                <GoogleIcon />
              )}
              {loading ? "Signing in…" : "Sign in with Google"}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-[10px] text-[0.8125rem] font-normal tracking-tight"
            onClick={onContinueLocal}
          >
            Continue without login
          </Button>

          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
