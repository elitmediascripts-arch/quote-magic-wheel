import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateQuoteSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  client_email: z.string().trim().email().max(255),
  service_description: z.string().trim().min(1).max(5000),
  price: z.number().nonnegative().max(10_000_000),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
});

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateQuoteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("quotes")
      .insert({ ...data, user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: fetch a quote by share token (no auth)
export const getQuoteByToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("quotes")
      .select(
        "id, client_name, client_email, service_description, price, currency, status, created_at",
      )
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Quote not found");
    return row;
  });

// Public: mark as viewed (idempotent — only if currently 'sent')
export const markQuoteViewed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(8).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("quotes")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("share_token", data.token)
      .eq("status", "sent");
    return { ok: true };
  });

// Public: respond (accept/decline)
export const respondToQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(8).max(64),
        response: z.enum(["accepted", "declined"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { data: row, error: readErr } = await supabaseAdmin
      .from("quotes")
      .select("status")
      .eq("share_token", data.token)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Quote not found");
    if (row.status === "accepted" || row.status === "declined") {
      throw new Error("This quote has already been responded to.");
    }
    const { error } = await supabaseAdmin
      .from("quotes")
      .update({
        status: data.response,
        responded_at: new Date().toISOString(),
      })
      .eq("share_token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
