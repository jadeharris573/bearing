// Background function (runs up to 15 minutes). Called only by /api/start.
// Streams the plan from the Claude API and saves progress as it goes, so the
// customer's page can show the plan being written.
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { TIERS, buildPrompt } from "../../lib/plans.mjs";

const anthropic = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });

export default async (req) => {
  if (req.headers.get("x-internal-secret") !== Netlify.env.get("INTERNAL_SECRET") || !Netlify.env.get("INTERNAL_SECRET")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { sessionId } = await req.json();
  const orders = getStore({ name: "orders", consistency: "strong" });
  const plans = getStore({ name: "plans", consistency: "strong" });

  const order = await orders.get(sessionId, { type: "json" });
  if (!order) return;
  const tier = TIERS[order.tier];

  let text = "";
  let lastSave = 0;
  const save = (status, extra = {}) =>
    plans.setJSON(sessionId, { status, text, updatedAt: Date.now(), ...extra });

  try {
    await save("writing");
    const stream = anthropic.messages.stream({
      model: tier.model,
      max_tokens: 16000,
      messages: [{ role: "user", content: buildPrompt(order.tier, order.answers) }],
    });

    stream.on("text", (delta) => {
      text += delta;
      const now = Date.now();
      if (now - lastSave > 1500) { lastSave = now; save("writing").catch(() => {}); }
    });

    const final = await stream.finalMessage();
    await save("done", {
      truncated: final.stop_reason === "max_tokens",
      usage: final.usage, // input/output tokens, for tracking your costs
    });
  } catch (err) {
    console.error("Plan generation failed", sessionId, err);
    // Give the customer their attempt back.
    order.generations = Math.max(0, order.generations - 1);
    await orders.setJSON(sessionId, order);
    await save("error", { error: "Something interrupted your plan. Generate it again; this attempt hasn't counted." });
  }
};

export const config = { background: true, path: "/api/generate-internal" };
