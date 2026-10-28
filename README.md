# Betwise — Sports Betting Performance Tracker

A private, INR-first record-keeping dashboard built with Next.js, TypeScript, Tailwind CSS, Recharts and Supabase. It tracks historical records and realized outcomes; it does not place bets, accept wagers, or process payments.

## Included in this starter

- Email/password sign-up and sign-in through Supabase Auth
- Dashboard metrics: settled P/L, ROI, win rate, returns, average daily and active-day P/L, pending exposure and tracked bankroll
- Add/edit/delete bet records, sport categories, status, odds, stake, actual return, event/market/selection/bookmaker, notes and timestamps
- Search and filters; CSV export
- Daily P/L chart, sport breakdown, performance report
- Manual bankroll ledger (deposits/withdrawals) and opening bankroll
- Full JSON backup download
- Supabase PostgreSQL schema, indexes, validation constraints and Row Level Security policies
- Unit tests for settlement accounting and summary calculations
- Vercel-compatible deployment

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- Supabase account
- Git and GitHub account for deployment

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a project.
2. Save the database password somewhere secure. The app itself does not need that password.
3. In **Project Settings → API** (or the API keys page), copy the Project URL and publishable/anon key.
4. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and run it.
5. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:3000`. Before production, add your Vercel URL to allowed redirect URLs.
6. For an easy first run, you may disable email confirmation in Auth settings while developing. For public production use, keep email confirmation enabled and configure SMTP as appropriate.

## 2. Configure environment variables

From the project directory:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Use only the publishable/anon key in this browser app. **Never** put a Supabase service-role key in a `NEXT_PUBLIC_` variable or commit secrets to Git.

Restart Next.js after changing env variables.

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, create an account, confirm email if required, then sign in.

## 4. Test and build

```bash
npm test
npm run lint
npm run build
```

Unit tests cover wins, losses, pending bets, voids, cashouts, bankroll movements and daily aggregation.

## 5. Deploy to Vercel

1. Create a private GitHub repository and push this project.
2. Sign in at https://vercel.com and import the repository.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel → Project → Settings → Environment Variables for Production (and Preview if wanted).
4. Deploy.
5. In Supabase Authentication → URL Configuration, set the production Site URL to your deployed domain and add both local and production URLs to allowed redirects.
6. Open the deployed site and test account creation, email confirmation, adding/editing/settling/deleting a bet, filtering, exports and sign-out/sign-in.

## Accounting conventions

- A winning/cashout/partial `actual_return` is the total amount returned, including any returned stake.
- A lost bet's actual return is `0`; its P/L is `-stake`.
- A void bet's P/L is `0`; its stake is returned and excluded from settled stake for ROI.
- Pending bets contribute zero realized P/L and are shown separately as exposure.
- Deposits/withdrawals change the tracked bankroll but do not count as betting profit.
- Average calendar-day P/L divides net settled P/L by calendar days from the first settlement through today. Active-day P/L divides by distinct days with settlements.
- Accumulators are recorded as one aggregate bet in this starter. `bet_legs` is available in the schema for a later per-leg editor.
- The current bankroll calculation is an accounting estimate, not a statement of funds held at any bookmaker.

## Current scope notes

The complete starter covers core records, analytics, security policies, manual ledger, exports and tests. The schema includes `bet_legs`, `limits`, and `bankroll_snapshots`, but per-leg accumulator editing, automated limit enforcement, snapshot scheduling, backup import/restore, and a dedicated calendar heatmap are not wired into the UI yet. Add these before describing those advanced workflows as complete.

## Troubleshooting

- **Configuration error:** check `.env.local`, ensure values have no quotes/spaces, and restart `npm run dev`.
- **Permission denied / RLS error:** verify `supabase/schema.sql` ran successfully. Do not disable RLS.
- **No confirmation email:** check Supabase Auth logs and allowed redirect URLs; configure SMTP for production delivery.
- **Build errors:** use Node.js 20.9+ and run `npm install` again.
- **Wrong ROI:** review whether actual return includes the returned stake; a win at stake ₹100 and odds 2.0 should usually have total return ₹200 and profit ₹100.

## Responsible record-keeping

Use this tool to understand historical records, not as a promise of future results. Betting can cause financial harm; consider setting strict personal limits and taking breaks. Ensure your use complies with local laws.
