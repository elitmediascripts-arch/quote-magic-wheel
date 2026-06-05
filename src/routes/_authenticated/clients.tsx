import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients, type ClientTag } from "@/lib/clients.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Client Book — Quotely" }] }),
  component: ClientsPage,
});

const tagStyles: Record<ClientTag, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  repeat: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  ghosted: "bg-red-500/15 text-red-400 border-red-500/20",
};

const tagLabel: Record<ClientTag, string> = {
  new: "New",
  repeat: "Repeat",
  ghosted: "Ghosted",
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function ClientsPage() {
  const fetchClients = useServerFn(listClients);
  const [search, setSearch] = useState("");
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const filtered = useMemo(() => {
    if (!clients || !search.trim()) return clients ?? [];
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)),
    );
  }, [clients, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="h-6 w-6 text-primary" /> Client Book
          </h1>
          <p className="text-sm text-muted-foreground">
            Everyone you&apos;ve quoted, all in one place.
          </p>
        </div>
        <Link to="/quotes/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New quote
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-sm text-muted-foreground">
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full rounded-xl border border-border/60 bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? "No clients match your search."
                : "No clients yet. Send your first quote to start building your book."}
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <Card
              key={c.email}
              className="border-border/60 bg-card transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-4 p-5">
                {/* Top row: name + tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
                      {c.name}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 border ${tagStyles[c.tag]}`}
                  >
                    {tagLabel[c.tag]}
                  </Badge>
                </div>

                {/* Phone */}
                {c.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{c.phone}</span>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total quoted</p>
                    <p className="mt-0.5 text-lg font-semibold text-foreground">
                      {formatMoney(c.totalQuoted, c.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quotes sent</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      {c.quoteCount}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <p className="text-xs text-muted-foreground">
                  Last quote{" "}
                  {formatDistanceToNow(new Date(c.lastQuoteAt), {
                    addSuffix: true,
                  })}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Bottom CTA */}
      <div className="flex justify-center pt-4">
        <Link to="/quotes/new">
          <Button
            size="lg"
            className="gap-2 rounded-full px-6 shadow-lg"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <Plus className="h-5 w-5" /> Add New Client
          </Button>
        </Link>
      </div>
    </div>
  );
}
