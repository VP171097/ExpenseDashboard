# Tally: money made simple

A friendly budget dashboard built for people with **no finance or tech background**. It answers one question first, "How much can I safely spend?", then helps with bills, saving and debts in plain language.

Built with **React 18 + TypeScript**, **Vite**, **Tailwind CSS**, **Framer Motion** (animations), **Recharts** (charts), **Zustand** (saved state) and **canvas-confetti** (celebrations). Everything is stored in the browser. Nothing is sent to a server.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + build one self-contained file: dist/index.html
```

`dist/index.html` works on its own: double-click it, or host it anywhere (GitHub Pages, Netlify, a USB stick).

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

## Project layout

```
src/
  lib/          dates, money formatting, calculations, sample data, import/export, store
  components/   UI kit (cards, sheets, sliders, rings, jars), charts, all forms
  screens/      Onboarding, Home, Activity, Plan, Bills, Goals, Debts, Worth, Settings
```
