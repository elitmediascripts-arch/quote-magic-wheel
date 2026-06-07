import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquareText, Zap, Share2, Bell } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quote Snap — Create. Share. Close." },
      {
        name: "description",
        content:
          "The modern way to send quotes, track responses and get paid. Auto follow-ups on day 2 and 5.",
      },
      { property: "og:title", content: "Quote Snap — Create. Share. Close." },
      {
        property: "og:description",
        content:
          "The modern way to send quotes, track responses and get paid.",
      },
    ],
  }),
  component: Landing,
});

function Logo({ className = "h-9 w-9" }: { className?: string }) {
  // Prefer a repo-hosted brand file at /logo.png. If not present, fall back
  // to the original inline icon so the header remains consistent.
  return (
    <div
      className={`${className} flex items-center justify-center rounded-2xl overflow-hidden`}
      style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
    >
      <img
        src="/logo.png"
        alt="QuoteSnap"
        className="h-full w-full object-contain"
        onError={(e) => {
          // Hide broken image and leave the SVG icon as fallback
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-primary-foreground">
        <MessageSquareText className="h-1/2 w-1/2" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <Logo className="h-8 w-8" />
          Quote<span className="text-primary">Snap</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/login">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Create. Share. Close.
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          The modern way to send quotes,
          <br />
          track responses and{" "}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
            get paid
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Build a clean quote in seconds, share a link, and let Quote Snap nudge your
          client automatically if they go quiet.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login">
            <Button size="lg" className="shadow-lg" style={{ boxShadow: "var(--shadow-glow)" }}>
              Start free
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-6 text-left sm:grid-cols-3">
          <Feature
            icon={<Zap className="h-5 w-5" />}
            title="Fast to create"
            text="Client, service, price — done. Generate a quote in under a minute."
          />
          <Feature
            icon={<Share2 className="h-5 w-5" />}
            title="Shareable link"
            text="Every quote gets a clean URL your client can open and respond to."
          />
          <Feature
            icon={<Bell className="h-5 w-5" />}
            title="Auto follow-ups"
            text="If they don't respond, we send a gentle nudge on day 2 and day 5."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/40">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        {icon}
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
