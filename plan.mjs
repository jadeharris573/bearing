// GET /api/plan?session_id=cs_...
// Returns the order details and the plan as written so far. The page polls
// this every couple of seconds while the plan is being written.
import { getStore } from "@netlify/blobs";
import { TIERS, MAX_GENERATIONS, json } from "../../lib/plans.mjs";

export default async (req) => {
  const sessionId = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ error: "Invalid order reference." }, 400);

  const orders = getStore({ name: "orders", consistency: "strong" });
  const plans = getStore({ name: "plans", consistency: "strong" });

  const order = await orders.get(sessionId, { type: "json" });
  if (!order) return json({ error: "We couldn't find this order." }, 404);
  const plan = (await plans.get(sessionId, { type: "json" })) || { status: "none", text: "" };

  return json({
    status: plan.status,           // none | queued | writing | done | error
    text: plan.text || "",
    truncated: !!plan.truncated,
    error: plan.error || null,
    tier: order.tier,
    tierName: TIERS[order.tier]?.name,
    generationsLeft: Math.max(0, MAX_GENERATIONS - order.generations),
    business: {
      bizName: order.answers.bizName,
      location: order.answers.location,
      budget: order.answers.budget,
      horizon: order.answers.horizon,
    },
  });
};

export const config = { path: "/api/plan" };
