// POST /api/start  {sessionId, regenerate?}
// Checks the Stripe payment, enforces the generation limit, then hands the
// work to the background function (plans can take longer than a normal
// function is allowed to run).
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { MAX_GENERATIONS, json } from "../../lib/plans.mjs";

const stripe = new Stripe(Netlify.env.get("STRIPE_SECRET_KEY"));

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const sessionId = String(body.sessionId || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ error: "Invalid order reference." }, 400);

  const orders = getStore({ name: "orders", consistency: "strong" });
  const plans = getStore({ name: "plans", consistency: "strong" });

  const order = await orders.get(sessionId, { type: "json" });
  if (!order) return json({ error: "We couldn't find this order." }, 404);

  // A page reload shouldn't start a second generation.
  const current = await plans.get(sessionId, { type: "json" });
  if (current && ["queued", "writing"].includes(current.status)) return json({ ok: true, status: current.status });
  if (current && current.status === "done" && !body.regenerate) return json({ ok: true, status: "done" });

  // Trust Stripe, not the browser, for whether it's paid.
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return json({ error: "Payment hasn't been completed for this order." }, 402);

  if (order.generations >= MAX_GENERATIONS) {
    return json({ error: `This order has used all ${MAX_GENERATIONS} plan generations.` }, 429);
  }

  order.generations += 1;
  order.email = session.customer_details?.email || order.email || null;
  await orders.setJSON(sessionId, order);
  await plans.setJSON(sessionId, { status: "queued", text: "", updatedAt: Date.now() });

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/generate-internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": Netlify.env.get("INTERNAL_SECRET") || "" },
    body: JSON.stringify({ sessionId }),
  });
  if (res.status !== 202) {
    order.generations -= 1;
    await orders.setJSON(sessionId, order);
    await plans.setJSON(sessionId, { status: "error", text: "", error: "Couldn't start writing your plan. Try again.", updatedAt: Date.now() });
    return json({ error: "Couldn't start writing your plan. Try again in a moment." }, 502);
  }

  return json({ ok: true, status: "queued" });
};

export const config = { path: "/api/start" };
