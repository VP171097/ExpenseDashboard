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

- **2-minute setup.** Asks for your pay, your usual bills and a savings goal, then builds a sensible plan for you. Or explore with example data first.
- **Home.** A big "Safe to spend" number with "about X a day", a money health score out of 100 with reasons, money in / out / put aside, a spending-pace chart, where your money went, bills coming up, personal tips, savings jars and a 12-month view.
- **Quick add.** Tap +, pick what it was, type the amount on a big keypad, done. Works with the keyboard too (press `N`).
- **Activity.** Grouped by day, with search, filters, a calendar heat map and CSV import from your bank.
- **My plan.** Spending "pots" with sliders, a "use what I usually spend" button, a healthy balance check (essentials / extras / future you), a per-paycheck view and optional carry-over of leftovers.
- **Bills & pay.** Set once, show up every month, tick when paid (with a little celebration). Includes a subscriptions check-up.
- **Goals.** Animated savings jars, the monthly amount needed, and a no-spend challenge with streaks.
- **Debts.** "Cheapest way" vs "Quick wins", an extra-payment slider and your debt-free date.
- **What I'm worth.** Own minus owe, a 12-month trend and a "what if I invest regularly" calculator.
- **Help everywhere.** A `?` next to every number explains it in plain words, plus a Help page with simple answers.
- Light and dark themes, phone layout with a bottom tab bar, undo on every change, backup and restore.

## Project layout

```
src/
  lib/          dates, money formatting, calculations, sample data, import/export, store
  components/   UI kit (cards, sheets, sliders, rings, jars), charts, all forms
  screens/      Onboarding, Home, Activity, Plan, Bills, Goals, Debts, Worth, Settings
```
