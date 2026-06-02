import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyQuotes, deleteQuote } from "@/lib/quotes.functions";
import { createPaymentLink } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Plus, Trash2, ExternalLink, FileText, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Quotely" }],
  }),
  component: Dashboard,
});

const statusStyles: Record<string, string> = {
  sent: "bg-secondary text-secondary-foreground",
  viewed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

function Dashboard() {
  const fetchQuotes = useServerFn(listMyQuotes);
  const removeQuote = useServerFn(deleteQuote);
  const qc = useQueryClient();

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

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/q/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const formatPrice = (n: number, c: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every quote you've sent and follow up automatically.
          </p>
        </div>
        <Link to="/quotes/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> New quote
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          Loading…
        </div>
      ) : !quotes || quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No quotes yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first quote and share it with a client.
          </p>
          <Link to="/quotes/new" className="mt-4 inline-block">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Create quote
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <div className="font-medium">{q.client_name}</div>
                    <div className="text-xs text-muted-foreground">{q.client_email}</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {q.service_description}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(Number(q.price), q.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusStyles[q.status] ?? ""} variant="secondary">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(q.share_token)}
                        title="Copy share link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <a
                        href={`/q/${q.share_token}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open share link"
                      >
                        <Button variant="ghost" size="icon">
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
        </div>
      )}
    </div>
  );
}
