import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createQuote } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quotes/new")({
  head: () => ({
    meta: [{ title: "New quote — Quotely" }],
  }),
  component: NewQuote,
});

function NewQuote() {
  const navigate = useNavigate();
  const submit = useServerFn(createQuote);
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    service_description: "",
    price: "",
    currency: "USD",
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setBusy(true);
    try {
      const row = await submit({
        data: {
          client_name: form.client_name,
          client_email: form.client_email,
          service_description: form.service_description,
          price,
          currency: form.currency.toUpperCase(),
        },
      });
      const url = `${window.location.origin}/q/${row.share_token}`;
      setCreatedLink(url);
      toast.success("Quote created — share the link with your client.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setBusy(false);
    }
  };

  if (createdLink) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Quote ready to share</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send this link to your client. We'll automatically remind them on day 2 and day 5 if they
          haven't responded.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
          <code className="flex-1 truncate text-sm">{createdLink}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(createdLink);
              toast.success("Copied");
            }}
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copy
          </Button>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => navigate({ to: "/dashboard" })}>Back to dashboard</Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreatedLink(null);
              setForm({
                client_name: "",
                client_email: "",
                service_description: "",
                price: "",
                currency: "USD",
              });
            }}
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight">Create a quote</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in the details — you'll get a shareable link to send to your client.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="client_name">Client name</Label>
          <Input
            id="client_name"
            required
            maxLength={120}
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_email">Client email</Label>
          <Input
            id="client_email"
            type="email"
            required
            value={form.client_email}
            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="service_description">Service description</Label>
          <Textarea
            id="service_description"
            required
            rows={5}
            maxLength={5000}
            placeholder="Describe what you'll deliver…"
            value={form.service_description}
            onChange={(e) => setForm({ ...form, service_description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create quote & get link"}
        </Button>
      </form>
    </div>
  );
}
