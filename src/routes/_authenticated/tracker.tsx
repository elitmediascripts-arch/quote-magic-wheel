import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyQuotes, nudgeQuote } from "@/lib/quotes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Bell, Send, Eye, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, addDays, isAfter } from "date-fns";

type FollowupTemplates = {
  followup_day2_subject: string;
  followup_day2_body: string;
  followup_day5_subject: string;
  followup_day5_body: string;
};

const DEFAULT_FOLLOWUP_TEMPLATES: FollowupTemplates = {
  followup_day2_subject: "Quick follow-up on your quote",
  followup_day2_body:
    "Hi {{client_name}},\n\nJust checking in on the quote I sent over a couple of days ago. Let me know if you have any questions!\n\nYou can review it here: {{quote_link}}\n\nThanks!",
  followup_day5_subject: "Still interested?",
  followup_day5_body:
    "Hi {{client_name}},\n\nWanted to circle back one more time on the quote. Happy to adjust anything if needed.\n\nReview here: {{quote_link}}\n\nThanks!",
};

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({ meta: [{ title: "Quote Tracker — Quotely" }] }),
  component: Tracker,
});

type FilterTab = "all" | "sent" | "viewed" | "accepted" | "declined";

type DisplayStatus = "Sent" | "Unseen" | "Seen" | "Accepted" | "Declined" | "Expired";

type TrackerQuote = {
  id: string;
  status: "sent" | "viewed" | "accepted" | "declined";
  created_at: string;
  service_description: string;
  client_name: string;
  client_email: string;
  price: number;
  currency: string;
  share_token: string;
  reminder_count?: number | null;
  last_reminder_sent_at?: string | null;
  displayStatus: DisplayStatus;
};

const tabLabels: Record<FilterTab, string> = {
  all: "All",
  sent: "Sent",
  viewed: "Seen",
  accepted: "Accepted",
  declined: "Declined",
};

const badgeStyles: Record<DisplayStatus, string> = {
  Sent: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Unseen: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  Seen: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Declined: "bg-red-500/15 text-red-300 border-red-500/20",
  Expired: "bg-red-500/15 text-red-300 border-red-500/20",
};

function deriveDisplayStatus(q: {
  status: string;
  created_at: string;
  service_description: string;
}): DisplayStatus {
  const base = q.status as "sent" | "viewed" | "accepted" | "declined";
  if (base === "accepted") return "Accepted";
  if (base === "declined") return "Declined";

  // Try to parse expiry from description (Valid until: ...)
  let expiry: Date | null = null;
  const match = q.service_description.match(/Valid until:\s*([A-Za-z0-9,\s]+)/);
  if (match) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) expiry = parsed;
  }
  // Fallback: 14 days from creation
  if (!expiry) {
    expiry = addDays(new Date(q.created_at), 14);
  }

  if (isAfter(new Date(), expiry)) return "Expired";
  if (base === "viewed") return "Seen";

  const sentThreshold = addDays(new Date(q.created_at), 1);
  return isAfter(new Date(), sentThreshold) ? "Unseen" : "Sent";
}

function Tracker() {
  const fetchQuotes = useServerFn(listMyQuotes);
  const sendNudge = useServerFn(nudgeQuote);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchQuotes(),
  });

  const nudge = useMutation({
    mutationFn: (id: string) => sendNudge({ data: { id } }),
    onSuccess: () => {
      toast.success("Nudge sent");
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<TrackerQuote | null>(null);
  const [followupTemplates, setFollowupTemplates] = useState<FollowupTemplates | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_settings")
        .select(
          "followup_day2_subject,followup_day2_body,followup_day5_subject,followup_day5_body",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setFollowupTemplates({
          followup_day2_subject: data.followup_day2_subject,
          followup_day2_body: data.followup_day2_body,
          followup_day5_subject: data.followup_day5_subject,
          followup_day5_body: data.followup_day5_body,
        });
      }
    })();
  }, []);

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);

  const isNudgeEligible = (q: TrackerQuote) => {
    if (q.displayStatus !== "Unseen" && q.displayStatus !== "Seen") return false;
    return isAfter(new Date(), addDays(new Date(q.created_at), 1));
  };

  const getFollowupPreview = (q: TrackerQuote) => {
    const templates = followupTemplates ?? DEFAULT_FOLLOWUP_TEMPLATES;
    const isDay5 = isAfter(new Date(), addDays(new Date(q.created_at), 5));
    const subject = isDay5 ? templates.followup_day5_subject : templates.followup_day2_subject;
    const body = isDay5 ? templates.followup_day5_body : templates.followup_day2_body;
    const link = origin ? `${origin}/q/${q.share_token}` : "{{quote_link}}";
    const message = body
      .replace(/{{client_name}}/g, q.client_name)
      .replace(/{{quote_link}}/g, link);

    return { subject, message, type: isDay5 ? "Day 5" : "Day 2" };
  };

  const handleManualNudge = () => {
    if (!activeQuote) return;
    nudge.mutate(activeQuote.id, {
      onSuccess: () => {
        setDialogOpen(false);
        setActiveQuote(null);
      },
    });
  };

  const filtered = useMemo(() => {
    let list = (quotes ?? []).map((q) => ({
      ...q,
      displayStatus: deriveDisplayStatus(q),
    }));

    if (filter !== "all") {
      list = list.filter((q) => q.status === filter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (q) =>
          q.client_name.toLowerCase().includes(term) ||
          q.service_description.toLowerCase().includes(term) ||
          q.client_email.toLowerCase().includes(term),
      );
    }

    return list;
  }, [quotes, filter, search]);

  const counts = useMemo(() => {
    const base = { all: 0, sent: 0, viewed: 0, accepted: 0, declined: 0 };
    (quotes ?? []).forEach((q) => {
      base.all += 1;
      if (q.status === "sent") base.sent += 1;
      else if (q.status === "viewed") base.viewed += 1;
      else if (q.status === "accepted") base.accepted += 1;
      else if (q.status === "declined") base.declined += 1;
    });
    return base;
  }, [quotes]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Quote Tracker
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, filter, and follow up on every quote you’ve sent.
        </p>
      </div>

      {/* Search + Filter tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(tabLabels) as FilterTab[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabLabels[key]} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      {/* Quote list */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading quotes…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No quotes match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card
              key={q.id}
              className="border-border/60 transition hover:border-primary/30"
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: client info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {q.client_name}
                    </span>
                    <Badge variant="outline" className={badgeStyles[q.displayStatus]}>
                      {q.displayStatus}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {q.service_description.split("\n")[0].slice(0, 120)}
                    {q.service_description.length > 120 ? "…" : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                    </span>
                    <span>{q.client_email}</span>
                    <span className="font-medium text-foreground">
                      {fmt(Number(q.price), q.currency)}
                    </span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2">
                  {isNudgeEligible(q) && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
                      disabled={nudge.isPending}
                      onClick={() => {
                        setActiveQuote(q);
                        setDialogOpen(true);
                      }}
                    >
                      <Bell className="h-3.5 w-3.5" /> Nudge
                    </Button>
                  )}
                  <a href={`/q/${q.share_token}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          setActiveQuote(null);
        }
        setDialogOpen(open);
      }}>
        <DialogContent className="space-y-6">
          <DialogHeader>
            <DialogTitle>Send Manual Nudge Now</DialogTitle>
            <DialogDescription>
              Preview the exact follow-up message that will be sent to {activeQuote?.client_name || "your client"}.
            </DialogDescription>
          </DialogHeader>

          {activeQuote ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{getFollowupPreview(activeQuote).type} template</p>
                <p className="mt-2 text-sm font-medium">{getFollowupPreview(activeQuote).subject}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">
                {getFollowupPreview(activeQuote).message}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              Select a quote to preview the nudge message.
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleManualNudge} disabled={!activeQuote || nudge.isPending}>
              Send Manual Nudge Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
