# Tally: money made simple

A friendly budget dashboard built for people with **no finance or tech background**. It answers one question first, "How much can I safely spend?", then helps with bills, saving and debts in plain language.

Built with **React 18 + TypeScript**, **Vite**, **Tailwind CSS**, **Framer Motion** (animations), **three.js / React Three Fiber** (3D scenes, loaded only when shown), **Recharts** (charts), **Zustand + immer** (state), **canvas-confetti** (celebrations), and optionally **Supabase** (accounts and sync) and **Claude** (Ask Tally).

**Local-first and private:** accounts are optional and there is no bank login. Without an account, data is kept in this browser's IndexedDB (falling back to localStorage) and never leaves the device. It is **not encrypted** by Tally, so anyone with access to this browser profile can read it. Make regular backups from Settings.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build         # type-check + split, lazy-loaded build in dist/ (host on any static server)
npm run build:single  # one self-contained file: dist-single/index.html (double-click to open)
```

The split build is the fast one: screens, charts, Excel export, three.js, the landing page, Supabase and the Anthropic SDK download only when needed. The single file inlines everything, including the landing-page photos, for offline sharing.

## Accounts, sync and Ask Tally (optional)

Without any setup, Tally runs fully on the device and the landing page's "Log in" explains that accounts aren't switched on. To switch them on:

1. **Create a Supabase project** (free tier is fine) at supabase.com.
2. **Create the table and rules.** In the SQL editor, run `supabase/migrations/20261014000000_tally_data.sql`, or `supabase db push` with the Supabase CLI. It creates one private row per user (`tally_data`), row-level security so each login can only read and change its own row, and `tally_save()`, which refuses a save if another device saved in between.
3. **Turn on sign-in methods** under Authentication → Providers: Email (password sign-up, confirmation emails and password reset) and, if you like, Google (needs a Google OAuth client ID and secret). Add your site's address under Authentication → URL Configuration so email links and Google return to it.
4. **Point Tally at the project.** Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API), then build. The anon key is meant to be public; row-level security protects the data. Alternatively, enter the URL and key in Settings → Account & sync on any copy of Tally.
5. **Ask Tally through your accounts (optional).** Deploy the function and give it an Anthropic API key:
   ```bash
   supabase functions deploy ask-tally
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # optional: supabase secrets set TALLY_AI_MODEL=claude-haiku-5-5   (default claude-opus-5-5)
   ```
   No command line? In the Supabase dashboard go to **Edge Functions → Deploy a new function → Via editor**, name it `ask-tally`, paste all of `supabase/dashboard/ask-tally.ts` (the same function in one file), and deploy. Then add `ANTHROPIC_API_KEY` under **Edge Functions → Secrets**.
   The function only answers signed-in users of your project, keeps the key on the server, and logs nothing about the question. Without it, people can still use Ask Tally with their own Anthropic API key, kept only in their browser.

**How sync behaves.** Changes save on the device first and upload a few seconds later (or when the app is hidden or comes back online). If two devices both changed, Tally asks which copy to keep and sets the other aside on that device, where Settings can bring it back. Example data is never uploaded. The cloud copy is protected by row-level security but is not end-to-end encrypted.

**What Ask Tally sends.** Only when a question is asked: a summary of the dashboard (this month's totals, plan vs spending, the health score and its checks, bills, accounts, goals, debts, trips, and up to 40 recent entries, with or without their descriptions). Settings shows the exact text. It is sent to Claude by Anthropic; Ask Tally can't change any data.

## What it does

Everything from popular spreadsheet budget planners, as a friendly app:

| Area | Features |
|---|---|
| **Setup** | 2-minute guided setup (pay, bills, a goal) that builds your plan, or explore with example data. A guided tour shows the key parts. |
| **Home** | "Safe to spend" with a per-day amount, money health score, money in / out / put aside, spending pace vs plan, where your money went, bills coming up, tips, savings jars, a mini month calendar, year-so-far totals and a 12-month chart. |
| **Activity** | Recurring and one-off entries together, grouped by day. Search, filter by type, category, **sub-category**, person, account, paid/upcoming, essentials/extras/future, month or whole year, and sort. Totals by sub-category, **duplicate-entry alerts**, CSV import. |
| **Calendar** | Month grid with spending shading, colour-coded category dots, bills and pay on their dates, **show/hide** spending, bills or income, choose the week's start day, **weekly and running totals**, **daily balance** and a month snapshot (start, now, in, out). |
| **Bills & pay** | Set once with 7 frequencies, start and end dates, tick-to-pay, **change the amount or date of a single payment**, skip one, subscriptions check-up. |
| **My plan** | Spending pots with sliders and "use what I usually spend", sub-category breakdown, fresh-each-month or **roll over leftovers**, zero-based "give every bit a job", 50/30/20 healthy balance with custom ratios. |
| **Paycheck** | Weekly, every 2 weeks, twice a month, monthly or **custom** cycles. Pay, bills, everyday spending and savings per pay period, plan vs real, charts. |
| **My year** | Annual totals, month-by-month table, savings over the year, category-by-month heat table, automatic year-end facts and your own reflection notes. **Download an Excel workbook** (opens in Google Sheets too). |
| **Trips** | Create a trip or holiday with dates, a picture and an optional budget. Tag expenses to it from any Add button (refunds can be tagged too). The trip page shows spent vs budget, what's left per day, day-by-day and by-category spending, bookings made before leaving, and who paid against an even share. Tagged expenses still count in Activity, the month and the plan, with the trip's name shown next to them. You can filter and search Activity by trip, and the trip appears in CSV/Excel exports and imports. |
| **Goals** | Savings jars (sinking funds) with monthly amount needed and on-track status, plus a no-spend challenge with streaks and a yearly overview. |
| **Debts** | Up to as many debts as you like with **Cheapest way (avalanche), Quick wins (snowball) or your own order**, extra-payment slider, debt-free date, per-debt interest and total paid, log extra payments. |
| **Accounts** | Every bank account, card and cash pot with starting vs current balance, money in/out, a distribution chart, balance trend, **transfers** and **pay off credit card**. |
| **What I'm worth** | Own minus owe, 12-month trend, assets vs liabilities, how your wealth is spread, investment forecast. |
| **Household** | Up to 6 people: each person's money in, out and saved, spend-to-income ratio, who pays for which category, full distribution table. |
| **Everywhere** | Plain-language `?` explainers, Help page, undo on every change, light and dark themes, phone layout, works in any currency, backups, reusable year after year. |

## v3: premium look and performance

- **Design:** new dark/light palette, glass cards, Manrope + Inter, tabular numbers. Light/dark/system themes are applied before first paint, so there is no flicker.
- **3D and motion:** a 3D allocation ring on Home (renders on demand and leans towards the pointer), a 3D coin scene during setup, a tilting Safe-to-spend card with a "How is this worked out?" breakdown, glass savings jars with liquid and bubbles, coin bursts and confetti when goals are reached. With **Reduced effects** (Settings), reduced motion in the OS, or no WebGL, flat SVG versions are shown instead. Phones get the flat versions so three.js is never downloaded there.
- **Goals:** status (on track / behind / late / done), amount left and needed per month, an estimated finish date based on the last 3 months, and recent contributions.
- **Pagination:** Activity (25 per page by default; 10/25/50/100), bill payment history, debt repayments and transfers. The order is search → filters → sort → totals over *all* matches → page. Changing a filter returns to page 1, and the page is clamped after deletions.
- **Speed:** money is added in whole cents, calculations are cached per month, and saves are batched and serialised in idle time. Tested with 10,000 transactions.
- **Safer data:** CSV import with validation, a preview (good / possible duplicates / unreadable rows) and batched progress. Backups are validated, and you see what a backup contains before it replaces anything (with undo). The quick-add form ignores double clicks.

## Landing page and sign-in

New visitors see a landing page (log in in the top corner) explaining every feature, with photos from Unsplash and real screenshots of the app showing example data. Every section is interactive: a step-by-step "month with Tally", before/after, an Ask Tally demo with example answers, a what-if calculator, feature tiles, a paycheck planner, shared-money tabs, playable habit challenges, privacy details and an FAQ. From there people can create an account, log in (email and password, password reset, Google), or continue without an account.

## Project layout

```
src/
  lib/          dates, money formatting, calculations, sample data, import/export, store, storage (IndexedDB)
  lib/cloud/    Supabase client, sign-in, sync engine
  lib/ai/       dashboard summary and the Ask Tally client
  components/   UI kit (cards, sheets, sliders, rings, jars), Pager, charts, all forms, three/ (3D scenes)
  screens/      Landing, Auth, Onboarding, Home, Activity, Plan, Bills, Goals, Trips, Debts, Worth, Settings and more
supabase/       database migration and the ask-tally Edge Function
```
