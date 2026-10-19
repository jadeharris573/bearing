# Bearing Marketing Plans: setup guide

Customers answer a questionnaire, pay through Stripe, and get a marketing plan
written by Claude. This folder is the whole website, ready to deploy on Netlify.

## How it fits together

```
Questionnaire (in the browser)
  → /api/checkout          saves answers, creates a Stripe payment page
  → Stripe Checkout        customer pays (card, Apple Pay, Google Pay)
  → back to your site with ?session_id=cs_...
  → /api/start             checks Stripe says "paid", then starts the plan
  → generate (background)  calls the Claude API, saves the plan as it's written
  → /api/plan              the page checks this every 2 seconds and shows progress
```

The plan is written in a background function because longer plans can take
more than 60 seconds, which is the limit for a normal Netlify function.

| File | What it does |
|---|---|
| `public/index.html` | The website: landing page, pricing, questionnaire, plan page |
| `lib/plans.mjs` | Prices, plan sections per tier, which Claude model each tier uses, the AI prompt |
| `netlify/functions/checkout.mjs` | Creates the Stripe payment page |
| `netlify/functions/start.mjs` | Confirms payment, limits each order to 3 generations |
| `netlify/functions/generate.mjs` | Writes the plan with the Claude API |
| `netlify/functions/plan.mjs` | Returns the plan so the page can display it |

Orders and plans are stored in Netlify Blobs (built in, nothing to set up).

## Setup (about 30–45 minutes)

### 1. Claude API key
1. Go to platform.claude.com and create an account.
2. Billing: add prepaid credit. US$10 covers roughly 150–200 Growth plans.
3. API keys → Create key. Copy it (starts `sk-ant-`). You only see it once.

### 2. Stripe
1. Create an account at stripe.com. You'll need your ABN and bank details to go live,
   but test mode works straight away.
2. Make sure **Test mode** is on (toggle top right).
3. Developers → API keys → copy the **Secret key** (starts `sk_test_`).
4. Settings → Payment methods: turn on Apple Pay and Google Pay if you want them.
5. Settings → Emails: turn on "Successful payments" so customers get receipts.

### 3. Put the code on GitHub
1. Create a free GitHub account and a new **private** repository called `bearing`.
2. Upload every file in this folder, keeping the folder structure.
   (On the repository page: Add file → Upload files, then drag the folder contents in.)
   Don't upload a `.env` file containing real keys.

### 4. Deploy on Netlify
1. Create a Netlify account and choose "Import from Git" → GitHub → `bearing`.
2. Leave the build settings as Netlify detects them (this folder's `netlify.toml` sets them).
3. Before the first deploy, or straight after, go to
   Site configuration → Environment variables and add the three values from `.env.example`:
   - `ANTHROPIC_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `INTERNAL_SECRET`: any long random string, 32+ characters
4. Deploys → Trigger deploy. Your site is live at `something.netlify.app`.

### 5. Test it end to end
1. Open the site, start a plan, and use "Fill with example answers".
2. At Stripe's checkout, pay with the test card `4242 4242 4242 4242`,
   any future expiry, any CVC and any postcode.
3. You should land back on your site and see the plan being written.
4. Check Stripe (test mode) → Payments to see the order, and the Claude Console → Usage
   to see what it cost.

If something fails, Netlify → Logs → Functions shows the error for each function.

## Going live checklist

- [ ] ABN on your Stripe account, and Stripe account activated
- [ ] Swap `STRIPE_SECRET_KEY` for the **live** key (`sk_live_...`), then redeploy
- [ ] Custom domain (Netlify → Domain management), e.g. bearingplans.com.au
- [ ] Add pages Stripe and Australian law expect: contact details, terms of sale,
      refund policy and privacy policy (you collect business details in the questionnaire).
      The refund policy can't exclude Australian Consumer Law guarantees.
- [ ] Set a monthly spend limit in the Claude Console so a bug can't run up a bill
- [ ] Decide on GST: prices are set as GST-inclusive. If you're registered, Stripe
      receipts can show it (Stripe Dashboard → Settings → Tax), or issue tax invoices separately.

## Changing things

- **Prices:** edit `priceCents` in `lib/plans.mjs` (that's what Stripe charges),
  and the `price` numbers near the top of the script in `public/index.html` (what's displayed).
- **What's in each plan:** edit the `sections` lists in `lib/plans.mjs`.
- **Which AI model:** edit `model` per tier in `lib/plans.mjs`.
  `claude-sonnet-5-5` is the balanced choice; `claude-opus-5-5` is the most capable and costs more.
- **The AI's instructions:** edit `buildPrompt` in `lib/plans.mjs`.
- **Number of free regenerations:** `MAX_GENERATIONS` in `lib/plans.mjs`.

## Running costs (per plan, approximate)

| Tier | Model | Claude API cost |
|---|---|---|
| Essentials | Sonnet 5.5 | ~A$0.04 |
| Growth | Sonnet 5.5 | ~A$0.08 |
| Full Strategy | Opus 5.5 | ~A$0.28 |

Plus Stripe's 1.65% + A$0.30 per payment. Netlify's free plan covers early traffic.
Each saved plan records its token usage, so you can check real costs against these estimates.

## Known limits of this first version

- If a customer pays and closes the tab before returning to your site, their plan
  isn't started until they come back via the link. Stripe's receipt doesn't include that link;
  if this happens, find the session ID in Stripe (Payments → the payment → Checkout session)
  and send them `https://yoursite/?session_id=THAT_ID`.
  A future improvement: a Stripe webhook that starts the plan and emails the link.
- Package versions in `package.json` are known-good older releases; you can update them later.
