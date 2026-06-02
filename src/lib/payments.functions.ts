import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ quoteId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe is not configured.");

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.quoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "accepted")
      throw new Error("Quote must be accepted before creating a payment link.");
    if (quote.payment_link_url) return { url: quote.payment_link_url };

    const currency = (quote.currency || "USD").toLowerCase();
    const unitAmount = Math.round(Number(quote.price) * 100);

    // 1. Create product
    const productRes = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        name: `Quote for ${quote.client_name}`,
        description: quote.service_description.slice(0, 500),
      }),
    });
    if (!productRes.ok) throw new Error(`Stripe product error: ${await productRes.text()}`);
    const product = (await productRes.json()) as { id: string };

    // 2. Create price
    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        product: product.id,
        currency,
        unit_amount: String(unitAmount),
      }),
    });
    if (!priceRes.ok) throw new Error(`Stripe price error: ${await priceRes.text()}`);
    const price = (await priceRes.json()) as { id: string };

    // 3. Create payment link
    const linkBody = new URLSearchParams();
    linkBody.append("line_items[0][price]", price.id);
    linkBody.append("line_items[0][quantity]", "1");
    linkBody.append("metadata[quote_id]", quote.id);

    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkBody,
    });
    if (!linkRes.ok) throw new Error(`Stripe link error: ${await linkRes.text()}`);
    const link = (await linkRes.json()) as { url: string };

    const { error: updateErr } = await supabase
      .from("quotes")
      .update({ payment_link_url: link.url })
      .eq("id", quote.id);
    if (updateErr) throw new Error(updateErr.message);

    return { url: link.url };
  });
