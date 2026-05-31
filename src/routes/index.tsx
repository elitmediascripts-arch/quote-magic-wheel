import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Zap, Share2, Bell } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quotely — Send and track client quotes" },
      {
        name: "description",
        content:
          "Create quotes in seconds, share a link, and auto-follow-up if your client goes quiet.",
      },
      { property: "og:title", content: "Quotely — Send and track client quotes" },
      {
        property: "og:description",
        content:
          "Create quotes in seconds, share a link, and auto-follow-up if your client goes quiet.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          Quotely
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

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Send quotes that <span className="text-primary">close</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Create a quote in seconds, share a clean link, and let Quotely follow up automatically
          when your client goes quiet.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login">
            <Button size="lg">Start free</Button>
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
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
