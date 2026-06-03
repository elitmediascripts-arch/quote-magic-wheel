import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientTag = "new" | "repeat" | "ghosted";

export interface ClientBookEntry {
  email: string;
  name: string;
  quoteCount: number;
  totalQuoted: number;
  currency: string;
  lastQuoteAt: string;
  acceptedCount: number;
  tag: ClientTag;
}

const GHOST_DAYS = 7;

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientBookEntry[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "client_name, client_email, price, currency, status, created_at, responded_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const now = Date.now();
    const ghostMs = GHOST_DAYS * 24 * 60 * 60 * 1000;
    const byEmail = new Map<string, ClientBookEntry & { anyResponded: boolean }>();

    for (const q of data ?? []) {
      const key = (q.client_email ?? "").toLowerCase().trim();
      if (!key) continue;
      const existing = byEmail.get(key);
      const created = new Date(q.created_at).getTime();
      const price = Number(q.price ?? 0);
      const responded = q.status === "accepted" || q.status === "declined";
      if (!existing) {
        byEmail.set(key, {
          email: key,
          name: q.client_name,
          quoteCount: 1,
          totalQuoted: price,
          currency: q.currency ?? "USD",
          lastQuoteAt: q.created_at,
          acceptedCount: q.status === "accepted" ? 1 : 0,
          anyResponded: responded,
          tag: "new",
        });
      } else {
        existing.quoteCount += 1;
        existing.totalQuoted += price;
        if (q.status === "accepted") existing.acceptedCount += 1;
        if (responded) existing.anyResponded = true;
        if (new Date(q.created_at).getTime() > new Date(existing.lastQuoteAt).getTime()) {
          existing.lastQuoteAt = q.created_at;
          existing.name = q.client_name;
        }
      }
    }

    const result: ClientBookEntry[] = [];
    for (const c of byEmail.values()) {
      let tag: ClientTag = "new";
      if (c.acceptedCount >= 2 || (c.quoteCount >= 2 && c.acceptedCount >= 1)) {
        tag = "repeat";
      } else if (
        !c.anyResponded &&
        now - new Date(c.lastQuoteAt).getTime() > ghostMs
      ) {
        tag = "ghosted";
      } else if (c.quoteCount >= 2) {
        tag = "repeat";
      }
      const { anyResponded: _a, ...rest } = c;
      result.push({ ...rest, tag });
    }

    result.sort(
      (a, b) => new Date(b.lastQuoteAt).getTime() - new Date(a.lastQuoteAt).getTime(),
    );
    return result;
  });
