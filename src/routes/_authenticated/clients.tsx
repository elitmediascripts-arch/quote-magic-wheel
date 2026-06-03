import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClients, type ClientTag } from "@/lib/clients.functions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Client Book — Quotely" }] }),
  component: ClientsPage,
});

const tagStyles: Record<ClientTag, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  repeat: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  ghosted: "bg-muted text-muted-foreground",
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
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="h-6 w-6" /> Client Book
          </h1>
          <p className="text-sm text-muted-foreground">
            Everyone you've quoted, all in one place.
          </p>
        </div>
        <Link to="/quotes/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New quote
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading clients…
          </div>
        ) : !clients || clients.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No clients yet. Send your first quote to start building your book.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Total quoted</TableHead>
                <TableHead>Last quote</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.email}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <a
                      href={`mailto:${c.email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {c.email}
                    </a>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.quoteCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(c.totalQuoted, c.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(c.lastQuoteAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge className={tagStyles[c.tag]} variant="secondary">
                      {tagLabel[c.tag]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
