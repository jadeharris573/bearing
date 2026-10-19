// POST /api/checkout  {tier, answers}
// Saves the questionnaire answers, creates a Stripe Checkout session and
// returns the URL of Stripe's payment page.
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { TIERS, cleanAnswers, json } from "../../lib/plans.mjs";

const stripe = new Stripe(Netlify.env.get("STRIPE_SECRET_KEY"));

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

  const tierKey = body.tier;
  const tier = TIERS[tierKey];
  if (!tier) return json({ error: "Choose a plan." }, 400);

  const { answers, error } = cleanAnswers(body.answers);
  if (error) return json({ error }, 400);

  const origin = new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "aud",
        unit_amount: tier.priceCents, // GST inclusive
        product_data: {
          name: `Bearing ${tier.name} marketing plan`,
          description: `Tailored marketing plan for ${answers.bizName}`,
        },
      },
    }],
    metadata: { tier: tierKey, business: answers.bizName.slice(0, 100) },
    allow_promotion_codes: true,
    // No payment_method_types: Stripe shows whatever you've switched on in
    // Dashboard > Settings > Payment methods (cards, Apple Pay, Google Pay...).
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?cancelled=1`,
  });

  // Keep the answers server-side, keyed by the Stripe session ID.
  const orders = getStore({ name: "orders", consistency: "strong" });
  await orders.setJSON(session.id, {
    tier: tierKey,
    answers,
    generations: 0,
    createdAt: new Date().toISOString(),
  });

  return json({ url: session.url });
};

export const config = { path: "/api/checkout" };
