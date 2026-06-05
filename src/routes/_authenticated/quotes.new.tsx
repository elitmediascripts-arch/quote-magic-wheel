import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createQuote } from "@/lib/quotes.functions";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
} from "@/lib/templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  BookmarkPlus,
  Trash2,
  MessageCircle,
  Smartphone,
  Plus,
  X,
  ImagePlus,
  Link2,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/quotes/new")({
  head: () => ({ meta: [{ title: "New quote — Quotely" }] }),
  component: NewQuote,
});

type Item = { id: string; label: string; amount: string };

function NewQuote() {
  const navigate = useNavigate();
  const submit = useServerFn(createQuote);
  const fetchTemplates = useServerFn(listTemplates);
  const saveTemplate = useServerFn(createTemplate);
  const removeTemplate = useServerFn(deleteTemplate);
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    service_description: "",
    currency: "USD",
    flat_price: "",
    template_id: "",
  });
  const [mode, setMode] = useState<"flat" | "itemized">("flat");
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), label: "", amount: "" },
  ]);
  const [validDays, setValidDays] = useState<number>(14);
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => fetchTemplates(),
  });

  const itemizedTotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [items],
  );
  const totalPrice = mode === "flat" ? Number(form.flat_price) || 0 : itemizedTotal;
  const expiryDate = useMemo(() => addDays(new Date(), validDays), [validDays]);

  const saveTpl = useMutation({
    mutationFn: () => {
      if (!form.service_description.trim() || totalPrice <= 0) {
        throw new Error("Add a description and price first");
      }
      const name = form.service_description.split("\n")[0].slice(0, 60).trim() || "Service";
      return saveTemplate({
        data: {
          name,
          description: form.service_description,
          price: totalPrice,
          currency: form.currency.toUpperCase(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved to your services");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delTpl = useMutation({
    mutationFn: (id: string) => removeTemplate({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const applyTemplate = (id: string) => {
    const t = templates?.find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({
      ...f,
      template_id: id,
      service_description: t.description,
      flat_price: String(t.price),
      currency: t.currency,
    }));
    setMode("flat");
  };

  const addItem = () =>
    setItems((arr) => [...arr, { id: crypto.randomUUID(), label: "", amount: "" }]);
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) =>
    setItems((arr) => (arr.length > 1 ? arr.filter((i) => i.id !== id) : arr));

  const onPhotosSelected = (files: FileList | null) => {
    if (!files) return;
    const next: { name: string; url: string }[] = [];
    Array.from(files)
      .slice(0, 6)
      .forEach((f) => next.push({ name: f.name, url: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next].slice(0, 6));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (totalPrice <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setBusy(true);
    try {
      const extras: string[] = [];
      if (mode === "itemized") {
        const lines = items
          .filter((i) => i.label.trim() || i.amount)
          .map(
            (i) =>
              `• ${i.label || "Item"} — ${new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: form.currency,
              }).format(Number(i.amount) || 0)}`,
          );
        if (lines.length) extras.push("Items:\n" + lines.join("\n"));
      }
      if (form.client_phone) extras.push(`Phone: ${form.client_phone}`);
      extras.push(`Valid until: ${format(expiryDate, "PPP")}`);
      if (photos.length) extras.push(`Attached photos: ${photos.map((p) => p.name).join(", ")}`);

      const fullDesc = [form.service_description.trim(), ...extras].filter(Boolean).join("\n\n");

      const row = await submit({
        data: {
          client_name: form.client_name,
          client_email: form.client_email,
          client_phone: form.client_phone || undefined,
          service_description: fullDesc,
          price: totalPrice,
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
    const shareText = encodeURIComponent(`Here's your quote: ${createdLink}`);
    const whatsappUrl = `https://wa.me/${
      form.client_phone ? encodeURIComponent(form.client_phone.replace(/\D/g, "")) : ""
    }?text=${shareText}`;
    const smsUrl = `sms:${form.client_phone || ""}?body=${shareText}`;
    return (
      <div className="mx-auto max-w-xl">
        <Card className="border-border/60">
          <CardContent className="p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Quote ready to share
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send this link to your client. Auto-reminders go out on day 2 and day 5.
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full gap-2">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
              <a href={smsUrl}>
                <Button variant="outline" className="w-full gap-2">
                  <Smartphone className="h-4 w-4" /> SMS
                </Button>
              </a>
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
                    client_phone: "",
                    service_description: "",
                    currency: "USD",
                    flat_price: "",
                    template_id: "",
                  });
                  setItems([{ id: crypto.randomUUID(), label: "", amount: "" }]);
                  setPhotos([]);
                }}
              >
                Create another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create a quote</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill in the details — we'll generate a shareable link for your client.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {/* Client */}
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <SectionTitle>Client</SectionTitle>
            <div className="space-y-1.5">
              <Label htmlFor="client_name">Name</Label>
              <Input
                id="client_name"
                required
                maxLength={120}
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  required
                  value={form.client_email}
                  onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client_phone">Phone</Label>
                <Input
                  id="client_phone"
                  type="tel"
                  placeholder="+1 555 555 5555"
                  maxLength={32}
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service */}
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <SectionTitle>Service</SectionTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={saveTpl.isPending}
                onClick={() => saveTpl.mutate()}
              >
                <BookmarkPlus className="h-3.5 w-3.5" /> Save as template
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Use a saved template</Label>
              <Select value={form.template_id} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      templates && templates.length
                        ? "Pick a template…"
                        : "No saved templates yet"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: t.currency,
                          }).format(Number(t.price))}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.template_id && (
                <button
                  type="button"
                  onClick={() => delTpl.mutate(form.template_id)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Delete selected template
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service_description">Description</Label>
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
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <SectionTitle>Pricing</SectionTitle>
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setMode("flat")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  mode === "flat"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Flat rate
              </button>
              <button
                type="button"
                onClick={() => setMode("itemized")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  mode === "itemized"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Itemized
              </button>
            </div>

            {mode === "flat" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.flat_price}
                    onChange={(e) => setForm({ ...form, flat_price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex gap-2">
                    <Input
                      placeholder="Item name"
                      value={it.label}
                      onChange={(e) => updateItem(it.id, { label: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={it.amount}
                      onChange={(e) => updateItem(it.id, { amount: e.target.value })}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(it.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add item
                </Button>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: form.currency,
                    }).format(itemizedTotal)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiry */}
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-6">
            <SectionTitle>Expiry</SectionTitle>
            <div className="flex items-center gap-3">
              <Label htmlFor="valid_days" className="shrink-0 text-sm text-muted-foreground">
                Valid for
              </Label>
              <Input
                id="valid_days"
                type="number"
                min={1}
                max={365}
                value={validDays}
                onChange={(e) => setValidDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Expires on</span>
              <span className="font-medium text-foreground">{format(expiryDate, "PPP")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-6">
            <SectionTitle>Photos (optional)</SectionTitle>
            <label
              htmlFor="photos"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition hover:border-primary/50 hover:bg-muted/40"
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to attach photos (up to 6)
              </span>
              <input
                id="photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPhotosSelected(e.target.files)}
              />
            </label>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.map((p, idx) => (
                  <div
                    key={p.url}
                    className="group relative aspect-square overflow-hidden rounded-md border border-border"
                  >
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((arr) => arr.filter((_, i) => i !== idx))}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="w-full gap-2"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          <Link2 className="h-4 w-4" />
          {busy ? "Generating…" : "Generate Quote Link"}
        </Button>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}
