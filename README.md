# Tally: money made simple

A friendly budget dashboard built for people with **no finance or tech background**. It answers one question first, "How much can I safely spend?", then helps with bills, saving and debts in plain language.

Built with **React 18 + TypeScript**, **Vite**, **Tailwind CSS**, **Framer Motion** (animations), **three.js / React Three Fiber** (3D scenes, loaded only when shown), **Recharts** (charts), **Zustand + immer** (state), **canvas-confetti** (celebrations), and optionally **Supabase** (accounts and sync) and **Google Gemini** (Tally AI).

**Local-first and private:** accounts are optional and there is no bank login. Without an account, data is kept in this browser's IndexedDB (falling back to localStorage) and never leaves the device. It is **not encrypted** by Tally, so anyone with access to this browser profile can read it. Make regular backups from Settings.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build         # type-check + split, lazy-loaded build in dist/ (host on any static server)
npm run build:single  # one self-contained file: dist-single/index.html (double-click to open)
```

The split build is the fast one: screens, charts, Excel export, three.js, the landing page and Supabase download only when needed. The single file inlines everything, including the landing-page photos, for offline sharing.

## Publish on GitHub Pages

`.github/workflows/pages.yml` builds the app and publishes `dist/` on every push to `main` (or run it by hand from the Actions tab). One-time setup:

1. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. In Supabase, go to **Authentication → URL Configuration**. Set **Site URL** to your Pages address (for example `https://<user>.github.io/<repo>/`) and add the same address under **Redirect URLs**, so sign-up, password-reset and Google links return to the site.

## Accounts, sync and Ask Tally (optional)

Without any setup, Tally runs fully on the device and the landing page's "Log in" explains that accounts aren't switched on. To switch them on:

1. **Create a Supabase project** (free tier is fine) at supabase.com.
2. **Create the table and rules.** In the SQL editor, run `supabase/migrations/20261014000000_tally_data.sql`, or `supabase db push` with the Supabase CLI. It creates one private row per user (`tally_data`), row-level security so each login can only read and change its own row, and `tally_save()`, which refuses a save if another device saved in between.
3. **Turn on sign-in methods** under Authentication → Providers: Email (password sign-up, confirmation emails and password reset) and, if you like, Google (needs a Google OAuth client ID and secret). Add your site's address under Authentication → URL Configuration so email links and Google return to it.
4. **Point Tally at the project.** Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API), then build. The anon key is meant to be public; row-level security protects the data. Alternatively, enter the URL and key in Settings → Account & sync on any copy of Tally.
5. **Tally AI (optional).** Deploy the function and give it a Gemini API key (from aistudio.google.com):
   ```bash
   supabase functions deploy ask-tally
   supabase secrets set GEMINI_API_KEY=AIza...
   # optional: supabase secrets set GEMINI_MODEL=...   (default gemini-flash-latest)
   ```
   No command line? In the Supabase dashboard go to **Edge Functions → Deploy a new function → Via editor**, name it `ask-tally`, paste all of `supabase/dashboard/ask-tally.ts` (the same function in one file; regenerate it with `npm run dashboard-function` after changing the function), and deploy. Then add `GEMINI_API_KEY` under **Edge Functions → Secrets**.
   The function only answers logged-in users of your project, keeps the key on the server, and logs nothing about the question. Note for the owner: on Google's free tier, Google may use requests to improve its products; a paid Gemini plan doesn't.

**How sync behaves.** Changes save on the device first and upload a few seconds later (or when the app is hidden or comes back online). If two devices both changed, Tally asks which copy to keep and sets the other aside on that device, where Settings can bring it back. Example data is never uploaded. The cloud copy is protected by row-level security but is not end-to-end encrypted.

**Ask Tally.** Common questions ("Can I afford ₹1,200 tonight?", "Why is my score low?", "Where can I cut back?", goals, trips, debts, bills, category spending, savings, net worth) are answered instantly on the device: private and offline. Logged-in people can also ask anything else; those questions go to **Tally AI** (the `ask-tally` function above, using Google Gemini) with a summary of the dashboard: this month's totals, plan vs spending, the health score and its checks, bills, accounts, goals, debts, trips, and up to 40 recent entries, with or without their descriptions. Settings → Ask Tally shows the exact text and can switch Tally AI off. It can't change any data.

**Inside claude.ai** pages can't reach other websites, so log in, sync and Tally AI only work when Tally is opened from its own web address.

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
