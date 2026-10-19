// Shared plan logic: tiers, prices, answer validation and the prompt.
// The server is the source of truth for prices. The prices shown on the
// website (public/index.html) are for display only and must match these.

export const TIERS = {
  starter: {
    name: "Essentials",
    priceCents: 7900,
    model: "claude-sonnet-5-5",
    sections: [
      "Executive summary",
      "Positioning and core message",
      "Ideal customer profile",
      "Recommended channels (top 3, with what to skip)",
      "30-day action list",
      "KPIs and targets (as a table)",
    ],
  },
  growth: {
    name: "Growth",
    priceCents: 14900,
    model: "claude-sonnet-5-5",
    sections: [
      "Executive summary",
      "Positioning and core message",
      "Ideal customer profile",
      "Channel strategy (what to use, what to skip)",
      "Monthly budget allocation (as a table, in AUD)",
      "Messaging by channel",
      "Content pillars with 10 specific post ideas",
      "90-day calendar (week by week, as a table)",
      "KPIs and targets (as a table)",
    ],
  },
  pro: {
    name: "Full Strategy",
    priceCents: 29900,
    model: "claude-opus-5-5",
    sections: [
      "Executive summary",
      "Positioning and core message",
      "Competitor angles and gaps to exploit",
      "Ideal customer profile and buying objections",
      "Channel strategy (what to use, what to skip)",
      "Monthly budget allocation (as a table, in AUD)",
      "Funnel and conversion improvements",
      "Messaging by channel",
      "Content pillars with 10 specific post ideas",
      "Email nurture sequence (5 emails, subject and purpose)",
      "90-day calendar (week by week, as a table)",
      "12-month roadmap by quarter",
      "KPIs and targets (as a table)",
      "Risks, and what to cut first if budget gets tight",
    ],
  },
};

// How many times one payment can generate a plan (first plan + 2 new versions).
export const MAX_GENERATIONS = 3;

// The questionnaire fields, in order, with the label the AI sees.
export const FIELDS = [
  ["bizName", "Business name", true],
  ["industry", "Industry", true],
  ["location", "Where they trade", true],
  ["stage", "How long they've been trading", true],
  ["website", "Website or main social link", false],
  ["offer", "Main products or services", true],
  ["price", "Typical sale value", true],
  ["usp", "Why customers choose them over others", true],
  ["competitors", "Main competitors", false],
  ["custType", "Who they sell to", true],
  ["customer", "Best customer", true],
  ["hangouts", "Where customers spend their time", false],
  ["objections", "What stops people buying", false],
  ["current", "Marketing they do now", false],
  ["working", "What's working and what isn't", false],
  ["budget", "Monthly marketing budget", true],
  ["hours", "Time available for marketing each week", true],
  ["goal", "Main goal", true],
  ["target", "Specific target", false],
  ["horizon", "Timeframe", true],
  ["tone", "Brand voice", true],
  ["notes", "Anything else", false],
];

// Keep only known fields, trim and cap lengths. Returns {answers} or {error}.
export function cleanAnswers(raw) {
  if (!raw || typeof raw !== "object") return { error: "Missing questionnaire answers." };
  const answers = {};
  for (const [id, label, required] of FIELDS) {
    let v = raw[id];
    if (Array.isArray(v)) v = v.map(x => String(x).slice(0, 60)).slice(0, 20);
    else v = (v == null ? "" : String(v)).trim().slice(0, 2000);
    const empty = Array.isArray(v) ? v.length === 0 : v === "";
    if (required && empty) return { error: `Please answer: ${label}.` };
    answers[id] = v;
  }
  return { answers };
}

export function buildPrompt(tierKey, answers) {
  const t = TIERS[tierKey];
  const lines = FIELDS.map(([id, label]) => {
    const v = answers[id];
    const val = Array.isArray(v) ? v.join(", ") : v;
    return `- ${label}: ${val || "(not provided)"}`;
  }).join("\n");

  return `You are a senior marketing strategist who writes practical plans for Australian small businesses.

Write a tailored marketing plan for the business below, based only on its answers.

BUSINESS ANSWERS
${lines}

RULES
- Use exactly these sections, as Markdown "## " headings, in this order:
${t.sections.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
- Be specific to this business: name actual channels, post formats, offers, partners to approach and numbers. No generic advice that would fit any business.
- Any spending must fit inside the stated monthly budget (use AUD and show dollar amounts). Weekly tasks must fit the stated hours.
- KPI targets must be realistic for the stated timeframe and stage of business.
- Write in the stated brand voice where you give example copy.
- When you make an assumption, state it in one short line.
- Use Australian English. Use Markdown tables where a section asks for one; otherwise short paragraphs and bullet lists.
- Start directly with the first heading. No preamble, no sign-off.`;
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
