import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyQuotes, deleteQuote } from "@/lib/quotes.functions";
import { createPaymentLink } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  Copy,
  ExternalLink,
  Trash2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, startOfWeek, addDays, isSameDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Quotely" }] }),
  component: Dashboard,
});

const statusStyles: Record<string, string> = {
  sent: "bg-secondary text-secondary-foreground",
  viewed: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  declined: "bg-red-500/15 text-red-300 border-red-500/20",
};

function Dashboard() {
  const fetchQuotes = useServerFn(listMyQuotes);
  const removeQuote = useServerFn(deleteQuote);
  const makeLink = useServerFn(createPaymentLink);
  const qc = useQueryClient();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const display =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (u.email ? u.email.split("@")[0] : "");
      setName(display);
    });
  }, []);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchQuotes(),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeQuote({ data: { id } }),
    onSuccess: () => {
      toast.success("Quote deleted");
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const invoice = useMutation({
    mutationFn: (id: string) => makeLink({ data: { quoteId: id } }),
    onSuccess: (res) => {
      navigator.clipboard.writeText(res.url).catch(() => {});
      toast.success("Payment link created and copied");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      window.open(res.url, "_blank", "noopener");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const stats = useMemo(() => {
    const base = { sent: 0, viewed: 0, accepted: 0, declined: 0 };
    (quotes ?? []).forEach((q) => {
      if (q.status === "sent") base.sent += 1;
      else if (q.status === "viewed") base.viewed += 1;
      else if (q.status === "accepted") base.accepted += 1;
      else if (q.status === "declined") base.declined += 1;
    });
    return base;
  }, [quotes]);

  const pipelineTotal = useMemo(
    () =>
      (quotes ?? [])
        .filter((q) => q.status === "sent" || q.status === "viewed" || q.status === "accepted")
        .reduce((sum, q) => sum + Number(q.price ?? 0), 0),
    [quotes],
  );

  const pipelineCurrency = (quotes ?? [])[0]?.currency ?? "USD";

  const weekly = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return days.map((d) => {
      const total = (quotes ?? [])
        .filter((q) => isSameDay(new Date(q.created_at), d))
        .reduce((sum, q) => sum + Number(q.price ?? 0), 0);
      return { day: format(d, "EEE"), value: total };
    });
  }, [quotes]);

  const followUps = useMemo(() => {
    return (quotes ?? [])
      .filter((q) => q.status === "sent" || q.status === "viewed")
      .slice(0, 8);
  }, [quotes]);

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/q/${token}`);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {name ? `Welcome back, ${name}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's how your quotes are performing today.
        </p>
      </div>

      {/* Active Quotes Summary */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Active Quotes
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Sent" value={stats.sent} icon={<Send className="h-4 w-4" />} tone="primary" />
          <StatCard label="Viewed" value={stats.viewed} icon={<Eye className="h-4 w-4" />} tone="blue" />
          <StatCard label="Accepted" value={stats.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
          <StatCard label="Declined" value={stats.declined} icon={<XCircle className="h-4 w-4" />} tone="red" />
        </div>
      </section>

      {/* Revenue Pipeline */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Revenue Pipeline
            </CardTitle>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-foreground">
                {fmt(pipelineTotal, pipelineCurrency)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <TrendingUp className="h-3 w-3" /> this week
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-56 pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--primary-glow)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--foreground)",
                }}
                formatter={(v: number) => fmt(v, pipelineCurrency)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#lineGrad)"
                strokeWidth={3}
                dot={{ fill: "var(--primary)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Follow up today */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Follow up today
        </h2>
        <Card className="overflow-hidden border-border/60">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading…</div>
          ) : followUps.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No quotes awaiting follow-up. Nice work.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {followUps.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{q.client_name}</div>
                      <div className="text-xs text-muted-foreground">{q.client_email}</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {q.service_description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[q.status] ?? ""}>
                        {q.status === "viewed" ? "Seen" : "Unseen"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {q.status === "accepted" &&
                          (q.payment_link_url ? (
                            <a href={q.payment_link_url} target="_blank" rel="noreferrer">
                              <Button variant="secondary" size="sm" className="gap-1.5">
                                <CreditCard className="h-3.5 w-3.5" /> Payment link
                              </Button>
                            </a>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={invoice.isPending}
                              onClick={() => invoice.mutate(q.id)}
                            >
                              <CreditCard className="h-3.5 w-3.5" /> Invoice
                            </Button>
                          ))}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(q.share_token)}
                          title="Copy link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <a href={`/q/${q.share_token}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" title="Open">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this quote?")) del.mutate(q.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      {/* Floating + New Quote */}
      <div className="fixed bottom-6 right-6 z-40">
        <Link to="/quotes/new">
          <Button
            size="lg"
            className="gap-2 rounded-full px-6 shadow-lg"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <Plus className="h-5 w-5" /> New Quote
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "blue" | "emerald" | "red";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    blue: "bg-blue-500/15 text-blue-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
