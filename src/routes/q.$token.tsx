import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQuoteByToken,
  markQuoteViewed,
  respondToQuote,
} from "@/lib/quotes.functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MessageSquareText, Copy, Share2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/q/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Your quote — Quote Snap" },
      { name: "description", content: `Review and respond to your quote.` },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your quote" },
      { property: "og:description", content: `Review and respond to your quote ${params.token.slice(0, 6)}` },
    ],
  }),
  component: PublicQuote,
});

function PublicQuote() {
  const { token } = Route.useParams();
  const fetchQuote = useServerFn(getQuoteByToken);
  const markViewed = useServerFn(markQuoteViewed);
  const respond = useServerFn(respondToQuote);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => fetchQuote({ data: { token } }),
    retry: false,
  });

  const [viewSent, setViewSent] = useState(false);
  useEffect(() => {
    if (data && !viewSent) {
      setViewSent(true);
      markViewed({ data: { token } }).catch(() => {});
    }
  }, [data, viewSent, markViewed, token]);

  const mutate = useMutation({
    mutationFn: (response: "accepted" | "declined") =>
      respond({ data: { token, response } }),
    onSuccess: (_r, response) => {
      toast.success(response === "accepted" ? "Quote accepted!" : "Quote declined.");
      qc.invalidateQueries({ queryKey: ["public-quote", token] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Quote not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  const responded = data.status === "accepted" || data.status === "declined";
  const formatPrice = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: data.currency,
  }).format(Number(data.price));

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2 text-sm font-medium">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          Quote<span className="text-primary">Snap</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="border-b border-border bg-gradient-to-br from-primary/10 to-transparent p-8">
            <p className="text-sm font-medium text-muted-foreground">Quote for</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.client_name}</h1>
          </div>
          <div className="space-y-6 p-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Service
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                {data.service_description}
              </p>
            </div>
            <div className="flex items-end justify-between border-t border-border pt-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">{formatPrice}</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {data.status}
              </Badge>
            </div>
          </div>
          {responded ? (
            data.status === "accepted" ? (
              <AcceptedSuccess
                clientName={data.client_name}
                quoteId={data.id}
                amount={formatPrice}
                paymentLinkUrl={data.payment_link_url ?? null}
                token={token}
              />
            ) : (
              <div className="border-t border-border bg-muted/30 p-8 text-center">
                <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">You declined this quote.</span>
                </div>
              </div>
            )
          ) : (
            <div className="border-t border-border bg-muted/30 p-8">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Ready to move forward?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  size="lg"
                  className="gap-2"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate("accepted")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Accept quote
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate("declined")}
                >
                  <XCircle className="h-4 w-4" /> Decline
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function invoiceNumberFor(quoteId: string) {
  // Deterministic INV-XXXXX from quote uuid (uppercase alphanumeric, length 5)
  const hex = quoteId.replace(/-/g, "").toUpperCase();
  return `INV-${hex.slice(0, 5)}`;
}

function AcceptedSuccess({
  clientName,
  quoteId,
  amount,
  paymentLinkUrl,
  token,
}: {
  clientName: string;
  quoteId: string;
  amount: string;
  paymentLinkUrl: string | null;
  token: string;
}) {
  const qc = useQueryClient();
  const invoiceNo = invoiceNumberFor(quoteId);
  const [showInvoice, setShowInvoice] = useState(false);

  // Poll briefly for the payment link if it hasn't appeared yet.
  useEffect(() => {
    if (paymentLinkUrl) return;
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      qc.invalidateQueries({ queryKey: ["public-quote", token] });
      if (attempts < 8) setTimeout(tick, 1500);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paymentLinkUrl, qc, token]);

  const copyLink = async () => {
    if (!paymentLinkUrl) return;
    try {
      await navigator.clipboard.writeText(paymentLinkUrl);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareLink = async () => {
    if (!paymentLinkUrl) return;
    const shareData = {
      title: `Invoice ${invoiceNo}`,
      text: `Invoice ${invoiceNo} — ${amount}`,
      url: paymentLinkUrl,
    };
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share(shareData);
        return;
      } catch {
        // fall through to copy
      }
    }
    copyLink();
  };

  return (
    <div className="border-t border-border bg-muted/30 p-8">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-9 w-9 text-emerald-400" strokeWidth={2.25} />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Quote Accepted!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks, <span className="font-medium text-foreground">{clientName}</span>.
        </p>

        <div className="mt-6 w-full rounded-xl border border-border bg-background/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Invoice
            </span>
            <span className="font-mono text-sm font-medium">{invoiceNo}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </span>
            <span className="text-2xl font-semibold text-emerald-400">{amount}</span>
          </div>
        </div>

        {!showInvoice ? (
          <Button
            size="lg"
            className="mt-6 w-full gap-2"
            onClick={() => setShowInvoice(true)}
          >
            View Invoice & Payment Link
          </Button>
        ) : (
          <div className="mt-6 w-full space-y-3">
            {paymentLinkUrl ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
                  <input
                    readOnly
                    value={paymentLinkUrl}
                    className="min-w-0 flex-1 truncate bg-transparent text-sm outline-none"
                  />
                  <Button size="sm" variant="ghost" onClick={copyLink} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={paymentLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button size="lg" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" /> Pay {amount}
                    </Button>
                  </a>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    onClick={shareLink}
                  >
                    <Share2 className="h-4 w-4" /> Share Link
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating payment link…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
