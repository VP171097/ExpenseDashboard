# Tally: money made simple

A friendly budget dashboard built for people with **no finance or tech background**. It answers one question first, "How much can I safely spend?", then helps with bills, saving and debts in plain language.

Built with **React 18 + TypeScript**, **Vite**, **Tailwind CSS**, **Framer Motion** (animations), **three.js / React Three Fiber** (3D scenes, loaded only when shown), **Recharts** (charts), **Zustand + immer** (state) and **canvas-confetti** (celebrations).

**Local-first and private:** no sign-up, no bank login, no server. Data is kept in this browser's IndexedDB (falling back to localStorage) and is never sent anywhere. It is **not encrypted**, so anyone with access to this browser profile can read it. Make regular backups from Settings.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build         # type-check + split, lazy-loaded build in dist/ (host on any static server)
npm run build:single  # one self-contained file: dist-single/index.html (double-click to open)
```

The split build is the fast one: screens, charts, Excel export and three.js download only when needed. The single file inlines everything (about 2.3 MB, 670 KB gzipped) for offline sharing.

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

## Project layout

```
src/
  lib/          dates, money formatting, calculations, sample data, import/export, store, storage (IndexedDB)
  components/   UI kit (cards, sheets, sliders, rings, jars), Pager, charts, all forms, three/ (3D scenes)
  screens/      Onboarding, Home, Activity, Plan, Bills, Goals, Debts, Worth, Settings
```
